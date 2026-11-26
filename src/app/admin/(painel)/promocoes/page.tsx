import { adminContext } from "@/lib/admin";
import { formatBRL } from "@/lib/money";
import { formatDateSP } from "@/lib/leadtime";
import { adminSaveCoupon } from "@/app/actions/admin";
import { AdminForm } from "@/components/admin/AdminForm";
import { Panel, Table } from "@/components/admin/ui";

export const metadata = { title: "Promoções" };
export default async function Coupons() {
  const { db } = await adminContext();
  const [{ data: coupons }, { data: cats }, { data: reds }] = await Promise.all([
    db.from("coupons").select("*").order("created_at", { ascending: false }),
    db.from("categories").select("id,name").order("position"),
    db.from("coupon_redemptions").select("coupon_id,status"),
  ]);
  const used = (id: string) => (reds ?? []).filter((r) => r.coupon_id === id && r.status === "confirmed").length;
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Promoções e cupons</h1>
      <p className="text-sm text-ink-muted">Nenhum desconto é aplicado automaticamente. Cupons começam desativados; frete grátis permanece desligado. Para preço promocional de produto, edite o produto.</p>
      <Panel title="Cupons">
        <Table head={["Código", "Desconto", "Período", "Usos", "Ativo"]} rows={(coupons ?? []).map((c) => [c.code, c.discount_type === "percent" ? `${c.discount_value}%` : formatBRL(c.discount_value), `${formatDateSP(c.starts_at)} – ${formatDateSP(c.ends_at)}`, `${used(c.id)}${c.max_uses ? `/${c.max_uses}` : ""}`, c.active ? "Sim" : "Não"])} empty="Nenhum cupom criado." />
      </Panel>
      <Panel title="Novo cupom">
        <AdminForm action={adminSaveCoupon} submit="Criar cupom" className="grid gap-3 md:grid-cols-3">
          <div><label className="label" htmlFor="c-code">Código</label><input id="c-code" name="code" className="field !py-2 uppercase" required /></div>
          <div><label className="label" htmlFor="c-type">Tipo</label><select id="c-type" name="discount_type" className="field !py-2"><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></div>
          <div><label className="label" htmlFor="c-val">Valor</label><input id="c-val" name="discount_value" className="field !py-2" required placeholder="10 ou 15,00" /></div>
          <div><label className="label" htmlFor="c-st">Início</label><input id="c-st" name="starts_at" type="datetime-local" className="field !py-2" /></div>
          <div><label className="label" htmlFor="c-en">Fim</label><input id="c-en" name="ends_at" type="datetime-local" className="field !py-2" /></div>
          <div><label className="label" htmlFor="c-min">Valor mínimo (R$)</label><input id="c-min" name="min_subtotal" className="field !py-2" /></div>
          <div><label className="label" htmlFor="c-max">Usos no total</label><input id="c-max" name="max_uses" type="number" min={1} className="field !py-2" /></div>
          <div><label className="label" htmlFor="c-pc">Usos por cliente</label><input id="c-pc" name="per_customer_limit" type="number" min={1} className="field !py-2" /></div>
          <div><label className="label" htmlFor="c-cat">Categorias participantes</label><select id="c-cat" name="category_ids" multiple className="field !py-2">{(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="md:col-span-3"><label className="label" htmlFor="c-desc">Descrição interna</label><input id="c-desc" name="description" className="field !py-2" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bundles_only" className="h-5 w-5 accent-ink" /> Somente kits</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" className="h-5 w-5 accent-ink" /> Ativar agora</label>
        </AdminForm>
      </Panel>
    </div>
  );
}
