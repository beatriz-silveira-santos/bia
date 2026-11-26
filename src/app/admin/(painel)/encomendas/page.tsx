/* eslint-disable react-hooks/purity -- Server Component renderizado por requisição */
import Link from "next/link";
import { adminContext } from "@/lib/admin";
import { formatDateSP } from "@/lib/leadtime";
import { adminReceiveStock, adminUpdateAllocation } from "@/app/actions/admin";
import { AdminForm } from "@/components/admin/AdminForm";
import { Panel, Stat } from "@/components/admin/ui";
import { formatBRL } from "@/lib/money";

export const metadata = { title: "Encomendas" };

const STATUS: Record<string, string> = {
  awaiting_purchase: "Aguardando compra", purchased: "Comprado do fornecedor", awaiting_receipt: "Aguardando recebimento", received: "Recebido",
  ready_to_ship: "Pronto para postagem", shipped: "Postado", cancelled: "Cancelado", refunded: "Reembolsado",
};

export default async function Preorders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { db } = await adminContext();
  let q = db.from("preorder_allocations").select("*, orders!inner(number,customer_snapshot,status,total_cents), products(name,sku)").order("dispatch_due_at");
  if (sp.status) q = q.eq("status", sp.status);
  else q = q.in("status", ["awaiting_purchase", "purchased", "awaiting_receipt", "received", "ready_to_ship"]);
  if (sp.produto) q = q.eq("product_id", sp.produto);
  if (sp.fornecedor) q = q.ilike("supplier_name", `%${sp.fornecedor.replace(/[%,]/g, "")}%`);
  const { data } = await q.limit(500);
  const rows = data ?? [];
  const now = Date.now();
  const days = (iso: string) => Math.ceil((new Date(iso).getTime() - now) / 86400_000);
  const pending = new Map<string, { name: string; qty: number }>();
  rows.filter((r) => ["awaiting_purchase", "purchased", "awaiting_receipt"].includes(r.status)).forEach((r) => {
    const p = pending.get(r.product_id) ?? { name: (r.products as { name: string }).name, qty: 0 };
    pending.set(r.product_id, { ...p, qty: p.qty + r.quantity - r.quantity_received });
  });
  const totalValue = new Set(rows.map((r) => r.order_id)).size;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Encomendas</h1>
        <a className="btn-secondary !min-h-10" href={`/admin/exportar/encomendas`}>Exportar CSV</a>
      </header>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Pedidos com encomenda em aberto" value={String(totalValue)} />
        <Stat label="Unidades a receber" value={String([...pending.values()].reduce((s, p) => s + p.qty, 0))} />
        <Stat label="Vencem em até 3 dias" value={String(rows.filter((r) => r.status !== "shipped" && days(r.dispatch_due_at) >= 0 && days(r.dispatch_due_at) <= 3).length)} tone="warn" />
        <Stat label="Em atraso" value={String(rows.filter((r) => !["shipped", "cancelled", "refunded"].includes(r.status) && days(r.dispatch_due_at) < 0).length)} tone="danger" />
      </div>
      <form className="flex flex-wrap gap-2" action="/admin/encomendas">
        <select name="status" defaultValue={sp.status ?? ""} className="field !w-60 !py-2" aria-label="Status">
          <option value="">Em aberto</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input name="fornecedor" defaultValue={sp.fornecedor} placeholder="Fornecedor" className="field !w-48 !py-2" aria-label="Fornecedor" />
        <button className="btn-secondary !min-h-10">Filtrar</button>
      </form>

      {pending.size > 0 && (
        <Panel title="Registrar recebimento de mercadoria">
          <p className="mb-3 text-sm text-ink-muted">As unidades recebidas são vinculadas primeiro às encomendas pagas com prazo mais próximo; o que sobrar vai para o estoque físico. Nenhuma unidade é contada duas vezes.</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...pending.entries()].map(([pid, p]) => (
              <AdminForm key={pid} action={adminReceiveStock} submit="Registrar recebimento" className="space-y-2 rounded-xl border border-line p-4">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-ink-muted">Aguardando: {p.qty} un.</p>
                <input type="hidden" name="productId" value={pid} />
                <label className="label" htmlFor={`rq-${pid}`}>Quantidade recebida</label>
                <input id={`rq-${pid}`} name="quantity" type="number" min={1} className="field !py-2" required />
                <input name="note" placeholder="Nota fiscal / observação" className="field !py-2" aria-label="Observação" />
              </AdminForm>
            ))}
          </div>
        </Panel>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
          const d = days(r.dispatch_due_at);
          const late = d < 0 && !["shipped", "cancelled", "refunded"].includes(r.status);
          const o = r.orders as { number: string; customer_snapshot: { name?: string } };
          const editable = ["awaiting_purchase", "purchased", "awaiting_receipt"].includes(r.status);
          return (
            <details key={r.id} className={`rounded-2xl border bg-white p-4 ${late ? "border-danger" : d <= 3 ? "border-warning" : "border-line"}`}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span><strong>{(r.products as { name: string }).name}</strong> × {r.quantity} <span className="text-sm text-ink-muted">· <Link href={`/admin/pedidos/${r.order_id}`} className="underline">{o.number}</Link> · {o.customer_snapshot?.name}</span></span>
                <span className="text-sm">{STATUS[r.status]} · pago {formatDateSP(r.paid_at)} · postar até <strong>{formatDateSP(r.dispatch_due_at)}</strong> {late ? <strong className="text-danger">({-d} dia(s) de atraso)</strong> : <span className="text-ink-muted">({d} dia(s) restantes)</span>}</span>
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="text-sm text-ink-soft">
                  <p>Recebido: {r.quantity_received}/{r.quantity}</p>
                  <p>Fornecedor: {r.supplier_name ?? "—"} · Previsão interna: {r.internal_eta ? formatDateSP(`${r.internal_eta}T12:00:00Z`) : "—"}</p>
                  <p className="mt-2 text-xs">A previsão interna não é informada à cliente como garantia.</p>
                </div>
                {editable && (
                  <AdminForm action={adminUpdateAllocation} submit="Atualizar" className="space-y-2">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status} className="field !py-2" aria-label="Status">
                      {["awaiting_purchase", "purchased", "awaiting_receipt"].map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
                    </select>
                    <label className="label" htmlFor={`eta-${r.id}`}>Previsão interna de chegada</label>
                    <input id={`eta-${r.id}`} type="date" name="eta" className="field !py-2" />
                    <textarea name="note" placeholder="Atualização (registro interno)" className="field" aria-label="Atualização" />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" className="h-5 w-5 accent-ink" /> Enviar esta atualização por e-mail à cliente (somente se for informação real)</label>
                  </AdminForm>
                )}
              </div>
            </details>
          );
        })}
        {!rows.length && <p className="rounded-2xl border border-line bg-white p-6 text-ink-muted">Nenhuma encomenda neste filtro.</p>}
      </div>
      <p className="text-xs text-ink-muted">Valores de pedidos aguardando pagamento não aparecem aqui nem contam como encomenda vendida. {formatBRL(0) && ""}</p>
    </div>
  );
}
