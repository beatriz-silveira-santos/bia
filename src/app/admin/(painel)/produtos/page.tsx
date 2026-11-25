import Link from "next/link";
import { adminContext } from "@/lib/admin";
import { formatBRL } from "@/lib/money";
import { Table } from "@/components/admin/ui";

export const metadata = { title: "Produtos" };
const ST: Record<string, string> = { draft: "Rascunho", active: "Ativo", sold_out: "Esgotado", archived: "Arquivado" };
const MODE: Record<string, string> = { ready_stock: "Pronta entrega", accepts_preorder: "Aceita encomenda", unavailable: "Indisponível" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const { db } = await adminContext();
  let q = db.from("products").select("id,name,sku,status,fulfillment_mode,price_cents,promo_price_cents,stock_on_hand,stock_reserved,preorder_committed,brands(name),product_images(id)").order("name");
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.q) q = q.ilike("name", `%${sp.q.replace(/[%,]/g, "")}%`);
  const { data } = await q;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Produtos</h1>
        <div className="flex gap-2"><Link href="/admin/produtos/importar" className="btn-secondary !min-h-10">Importar CSV</Link><a href={`/admin/exportar/produtos`} className="btn-secondary !min-h-10">Exportar CSV</a><Link href="/admin/produtos/novo" className="btn-primary !min-h-10">Novo produto</Link></div>
      </header>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Buscar por nome" className="field !w-64 !py-2" aria-label="Buscar" />
        <select name="status" defaultValue={sp.status ?? ""} className="field !w-48 !py-2" aria-label="Status"><option value="">Todos</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn-secondary !min-h-10">Filtrar</button>
      </form>
      <div className="rounded-2xl border border-line bg-white p-5">
        <Table head={["Produto", "Marca", "Status", "Modalidade", "Preço", "Físico / reservado", "Encomendado", "Fotos"]} rows={(data ?? []).map((p) => [
          <Link key="n" href={`/admin/produtos/${p.id}`} className="font-medium underline">{p.name}</Link>,
          (p.brands as unknown as { name: string } | null)?.name ?? "—", ST[p.status], MODE[p.fulfillment_mode],
          p.price_cents ? formatBRL(p.promo_price_cents ?? p.price_cents) : <span key="p" className="text-danger">sem preço</span>,
          `${p.stock_on_hand} / ${p.stock_reserved}`, String(p.preorder_committed),
          (p.product_images as unknown[]).length ? String((p.product_images as unknown[]).length) : <span key="f" className="text-danger">sem foto</span>,
        ])} empty="Nenhum produto cadastrado." />
      </div>
    </div>
  );
}
