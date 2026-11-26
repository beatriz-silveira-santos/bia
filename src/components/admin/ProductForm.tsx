import { adminSaveProduct } from "@/app/actions/admin";
import { AdminForm } from "./AdminForm";

type P = Record<string, unknown> | null;
const v = (p: P, k: string) => (p?.[k] == null ? "" : String(p[k]));
const arr = (p: P, k: string) => ((p?.[k] as string[] | undefined) ?? []).join(", ");
const money = (c: unknown) => (typeof c === "number" ? (c / 100).toFixed(2).replace(".", ",") : "");

function F({ p: product, k, label, type = "text", hint, ...rest }: { p: P; k: string; label: string; type?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div><label className="label" htmlFor={`f-${k}`}>{label}</label><input id={`f-${k}`} name={k} type={type} defaultValue={v(product, k)} className="field !py-2.5" {...rest} />{hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}</div>
  );
}
function T({ p: product, k, label, hint, value }: { p: P; k: string; label: string; hint?: string; value?: string }) {
  return (
    <div className="md:col-span-2"><label className="label" htmlFor={`f-${k}`}>{label}</label><textarea id={`f-${k}`} name={k} defaultValue={value ?? v(product, k)} className="field min-h-20" />{hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}</div>
  );
}

export function ProductForm({ product, brands, categories }: { product: P; brands: { id: string; name: string }[]; categories: { id: string; name: string; parent_id: string | null }[] }) {
  const parents = categories.filter((c) => !c.parent_id);
  const subs = categories.filter((c) => c.parent_id);
  const hl = (product?.highlights as string[] | undefined) ?? [];
  return (
    <AdminForm action={adminSaveProduct} submit="Salvar produto" className="space-y-8">
      {product?.id ? <input type="hidden" name="id" value={String(product.id)} /> : null}
      <fieldset className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-2">
        <legend className="px-2 font-semibold">Identificação</legend>
        <F p={product} k="name" label="Nome comercial *" required />
        <F p={product} k="slug" label="Endereço (slug)" hint="Gerado automaticamente a partir do nome se ficar vazio." pattern="[a-z0-9-]+" />
        <div><label className="label" htmlFor="f-brand">Marca</label><select id="f-brand" name="brand_id" defaultValue={v(product, "brand_id")} className="field !py-2.5"><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <F p={product} k="sku" label="SKU / código interno" />
        <div><label className="label" htmlFor="f-cat">Categoria *</label><select id="f-cat" name="category_id" defaultValue={v(product, "category_id")} className="field !py-2.5" required>{parents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="f-sub">Subcategoria</label><select id="f-sub" name="subcategory_id" defaultValue={v(product, "subcategory_id")} className="field !py-2.5"><option value="">—</option>{subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="f-gender">Classificação</label><select id="f-gender" name="gender" defaultValue={v(product, "gender") || "not_applicable"} className="field !py-2.5"><option value="female">Feminino</option><option value="male">Masculino</option><option value="kids">Infantil</option><option value="unisex">Unissex</option><option value="not_applicable">Não se aplica</option></select></div>
        <F p={product} k="product_type" label="Tipo de produto (skincare/cabelos)" hint="Ex.: Sérum, Máscara, Shampoo" />
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-3">
        <legend className="px-2 font-semibold">Preço, volume e status</legend>
        <div><label className="label" htmlFor="f-price">Preço (R$)</label><input id="f-price" name="price" defaultValue={money(product?.price_cents)} inputMode="decimal" placeholder="129,90" className="field !py-2.5" /></div>
        <div><label className="label" htmlFor="f-promo">Preço promocional (R$)</label><input id="f-promo" name="promo_price" defaultValue={money(product?.promo_price_cents)} inputMode="decimal" className="field !py-2.5" /><p className="mt-1 text-xs text-ink-muted">Opcional. Exibido somente se preenchido.</p></div>
        <F p={product} k="volume_ml" label="Volume (ml)" inputMode="decimal" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_decant" defaultChecked={product?.is_decant === true} className="h-5 w-5 accent-ink" /> É decante de 5 ml</label>
        <div><label className="label" htmlFor="f-status">Status</label><select id="f-status" name="status" defaultValue={v(product, "status") || "draft"} className="field !py-2.5"><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="sold_out">Esgotado (forçar)</option><option value="archived">Arquivado</option></select></div>
        <fieldset className="md:col-span-3"><legend className="label">Destaques (somente quando verdadeiros)</legend><div className="flex flex-wrap gap-4 text-sm">{[["new", "Lançamento"], ["bestseller", "Mais vendido"], ["recommended", "Recomendado"], ["promo", "Promoção"]].map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" name="highlights" value={k} defaultChecked={hl.includes(k)} className="h-5 w-5 accent-ink" /> {l}</label>)}</div></fieldset>
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-3">
        <legend className="px-2 font-semibold">Venda e abastecimento</legend>
        <div><label className="label" htmlFor="f-mode">Modalidade</label><select id="f-mode" name="fulfillment_mode" defaultValue={v(product, "fulfillment_mode") || "ready_stock"} className="field !py-2.5"><option value="ready_stock">Pronta entrega (só vende com estoque)</option><option value="accepts_preorder">Aceita encomenda quando o estoque zerar</option><option value="unavailable">Indisponível</option></select></div>
        <F p={product} k="preorder_max_quantity" label="Máximo de encomendas simultâneas" type="number" min={1} hint="Vazio = sem limite." />
        <F p={product} k="preorder_lead_time_value" label="Prazo de postagem da encomenda" type="number" min={1} max={120} hint="Vazio = padrão da loja (20)." />
        <div><label className="label" htmlFor="f-unit">Unidade do prazo</label><select id="f-unit" name="preorder_lead_time_unit" defaultValue={v(product, "preorder_lead_time_unit")} className="field !py-2.5"><option value="">Padrão da loja</option><option value="calendar_days">Dias corridos</option><option value="business_days">Dias úteis</option></select></div>
        <F p={product} k="supplier_name" label="Fornecedor (interno)" />
        <T p={product} k="preorder_internal_notes" label="Instruções internas de compra/abastecimento" hint="Nunca exibido à cliente." />
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-4">
        <legend className="px-2 font-semibold">Embalagem (para cotação de frete)</legend>
        <F p={product} k="weight_g" label="Peso embalado (g)" type="number" min={1} />
        <F p={product} k="width_cm" label="Largura (cm)" inputMode="decimal" />
        <F p={product} k="height_cm" label="Altura (cm)" inputMode="decimal" />
        <F p={product} k="length_cm" label="Comprimento (cm)" inputMode="decimal" />
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-2">
        <legend className="px-2 font-semibold">Descrição e atributos (somente informações verificadas)</legend>
        <T p={product} k="description" label="Descrição" />
        <F p={product} k="olfactory_family" label="Família olfativa" />
        <F p={product} k="accords" label="Acordes principais" defaultValue={arr(product, "accords")} hint="Separados por vírgula." />
        <F p={product} k="top_notes" label="Notas de saída" defaultValue={arr(product, "top_notes")} />
        <F p={product} k="heart_notes" label="Notas de coração" defaultValue={arr(product, "heart_notes")} />
        <F p={product} k="base_notes" label="Notas de fundo" defaultValue={arr(product, "base_notes")} />
        <T p={product} k="olfactory_description" label="Descrição olfativa / inspiração" hint="Não sugerir equivalência a outro perfume sem comprovação." />
        <T p={product} k="contents" label="Conteúdo" />
        <T p={product} k="how_to_use" label="Modo de uso" />
        <T p={product} k="composition" label="Composição (conforme rótulo)" />
        <T p={product} k="warnings" label="Advertências" />
        <T p={product} k="benefits" label="Benefícios (conforme fabricante)" />
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-3">
        <legend className="px-2 font-semibold">Kit e SEO</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_bundle" defaultChecked={product?.is_bundle === true} className="h-5 w-5 accent-ink" /> É um kit/combo</label>
        <F p={product} k="bundle_max_quantity" label="Limite de kits à venda" type="number" min={0} hint="Opcional; o estoque dos componentes sempre limita." />
        <div />
        <F p={product} k="seo_title" label="Título para buscadores" maxLength={70} />
        <div className="md:col-span-2"><F p={product} k="seo_description" label="Descrição para buscadores" maxLength={160} /></div>
      </fieldset>
    </AdminForm>
  );
}
