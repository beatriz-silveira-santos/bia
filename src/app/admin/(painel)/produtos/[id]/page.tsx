import { notFound } from "next/navigation";
import { adminContext } from "@/lib/admin";
import { productImageUrl } from "@/lib/images";
import { formatDateSP } from "@/lib/leadtime";
import { adminAdjustStock, adminDeleteMedia, adminSaveBundle, adminUploadMedia } from "@/app/actions/admin";
import { AdminForm } from "@/components/admin/AdminForm";
import { ProductForm } from "@/components/admin/ProductForm";
import { Panel, Table } from "@/components/admin/ui";

export const metadata = { title: "Editar produto" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  const { id } = await params;
  const { criado } = await searchParams;
  const { db } = await adminContext();
  const [{ data: p }, { data: brands }, { data: categories }, { data: media }, { data: bundle }, { data: all }, { data: moves }] = await Promise.all([
    db.from("products").select("*").eq("id", id).maybeSingle(),
    db.from("brands").select("id,name").order("name"),
    db.from("categories").select("id,name,parent_id").order("position"),
    db.from("product_images").select("*").eq("product_id", id).order("position"),
    db.from("bundle_items").select("component_product_id,quantity").eq("bundle_product_id", id),
    db.from("products").select("id,name").eq("is_bundle", false).neq("id", id).order("name"),
    db.from("inventory_movements").select("kind,quantity,note,created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!p) notFound();
  const comps = [...(bundle ?? []), { component_product_id: "", quantity: 1 }, { component_product_id: "", quantity: 1 }];
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">{p.name}</h1>
        {p.status === "active" && <a href={`/produto/${p.slug}`} target="_blank" className="btn-secondary !min-h-10">Ver na loja</a>}
      </header>
      {criado && <p role="status" className="rounded-xl bg-success-bg p-3 text-sm text-success">Rascunho criado. Agora inclua as fotos e o estoque.</p>}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Fotos e vídeos">
          {!media?.length && <p className="mb-3 rounded-xl bg-warning-bg p-3 text-sm">Sem fotos: o produto permanece em rascunho até a inclusão de imagens reais.</p>}
          <ul className="mb-4 grid grid-cols-3 gap-3">
            {(media ?? []).map((m) => (
              <li key={m.id} className="space-y-1 text-xs">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-blush-50">
                  {m.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImageUrl(m.storage_path)!} alt={m.alt_text} className="h-full w-full object-cover" />) : <span className="flex h-full items-center justify-center">Vídeo</span>}
                </div>
                <p className="line-clamp-2">{m.alt_text}</p>
                <form action={adminDeleteMedia}><input type="hidden" name="id" value={m.id} /><button className="text-danger underline">Remover</button></form>
              </li>
            ))}
          </ul>
          <AdminForm action={adminUploadMedia} submit="Enviar mídia" className="space-y-2">
            <input type="hidden" name="productId" value={p.id} />
            <label className="label" htmlFor="file">Arquivo (JPG, PNG, WebP, AVIF até 4 MB; MP4/WebM até 8 MB)</label>
            <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" className="block text-sm" required />
            <label className="label" htmlFor="alt">Texto alternativo (descreva a imagem)</label>
            <input id="alt" name="alt" className="field !py-2" required placeholder={p.is_decant ? "Ex.: Frasco de decante 5 ml com etiqueta" : "Ex.: Frasco do perfume em fundo claro"} />
            {p.is_decant && <p className="text-xs text-ink-muted">Para decantes, use foto do frasco de 5 ml. Se usar foto do frasco original, identifique no texto: “frasco original (não é o frasco de 5 ml enviado)”.</p>}
          </AdminForm>
        </Panel>
        <Panel title="Estoque">
          <p className="mb-3 text-sm">Físico: <strong>{p.stock_on_hand}</strong> · Reservado em pagamentos pendentes: {p.stock_reserved} · Encomendas pagas a receber: {p.preorder_committed} · Encomendas em pagamento: {p.preorder_reserved}</p>
          <AdminForm action={adminAdjustStock} submit="Lançar movimentação" className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="productId" value={p.id} />
            <div><label className="label" htmlFor="delta">Quantidade (+ entra, − sai)</label><input id="delta" name="delta" type="number" className="field !py-2" required /></div>
            <div><label className="label" htmlFor="kind">Tipo</label><select id="kind" name="kind" className="field !py-2"><option value="initial">Estoque inicial</option><option value="adjustment">Ajuste/inventário</option><option value="return">Devolução</option><option value="loss">Perda/avaria</option></select></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="note">Motivo</label><input id="note" name="note" className="field !py-2" required /></div>
          </AdminForm>
          <p className="mt-2 text-xs text-ink-muted">Para mercadoria comprada para encomendas, use “Registrar recebimento” em Encomendas (vincula as unidades aos pedidos pagos).</p>
          <div className="mt-4"><Table head={["Data", "Tipo", "Qtd.", "Nota"]} rows={(moves ?? []).map((m) => [formatDateSP(m.created_at, true), m.kind, String(m.quantity), m.note ?? ""])} empty="Sem movimentações." /></div>
        </Panel>
      </div>
      {p.is_bundle && (
        <Panel title="Composição do kit">
          <AdminForm action={adminSaveBundle} submit="Salvar composição" className="space-y-2">
            <input type="hidden" name="bundleId" value={p.id} />
            {comps.map((c, i) => (
              <div key={i} className="flex gap-2">
                <select name="component" defaultValue={c.component_product_id} className="field !py-2" aria-label={`Produto ${i + 1}`}><option value="">—</option>{(all ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                <input name="componentQty" type="number" min={1} defaultValue={c.quantity} className="field !w-24 !py-2" aria-label={`Quantidade ${i + 1}`} />
              </div>
            ))}
            <p className="text-xs text-ink-muted">A venda do kit reserva e baixa o estoque de cada componente na mesma transação.</p>
          </AdminForm>
        </Panel>
      )}
      <ProductForm product={p} brands={brands ?? []} categories={categories ?? []} />
    </div>
  );
}
