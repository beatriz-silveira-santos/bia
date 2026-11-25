import { notFound } from "next/navigation";
import { adminContext } from "@/lib/admin";
import { formatBRL } from "@/lib/money";
import { formatDateSP, formatLeadTime, type LeadUnit } from "@/lib/leadtime";
import { ORDER_STATUS_LABEL } from "@/lib/types";
import { adminCancelOrder, adminMarkRefunded, adminSetOrderStatus } from "@/app/actions/admin";
import { AdminForm } from "@/components/admin/AdminForm";
import { Panel, Table } from "@/components/admin/ui";

export const metadata = { title: "Pedido" };

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await adminContext();
  const { data: o } = await db.from("orders").select("*, order_items(*), order_status_history(*), payments(*), preorder_allocations(*)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const c = o.customer_snapshot as { name?: string; email?: string; phone?: string };
  const a = o.shipping_address as Record<string, string> | null;
  const items = o.order_items as { id: string; product_name: string; sku: string | null; quantity: number; unit_price_cents: number; line_total_cents: number; fulfillment: string; lead_time_value: number | null; lead_time_unit: LeadUnit | null; bundle_components: unknown }[];
  const hist = (o.order_status_history as { to_status: string; note: string | null; actor: string; created_at: string; visible_to_customer: boolean }[]).sort((x, y) => x.created_at.localeCompare(y.created_at));
  const pays = o.payments as { status: string; amount_cents: number | null; paid_amount_cents: number | null; installments: number | null; capture_method: string | null; transaction_nsu: string | null; receipt_url: string | null; created_at: string }[];
  const next = { paid: ["preparing", "ready_to_ship", "shipped"], preparing: ["ready_to_ship", "shipped"], procurement_received: ["ready_to_ship", "shipped"], ready_to_ship: ["shipped"], shipped: ["delivered"] }[o.status as string] ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-4xl">Pedido {o.number}</h1><p className="text-sm text-ink-muted">Criado em {formatDateSP(o.created_at, true)} · NSU {o.order_nsu}</p></div>
        <span className="rounded-full bg-blush-100 px-4 py-2 font-semibold">{ORDER_STATUS_LABEL[o.status]}</span>
      </header>
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Cliente"><p className="text-sm">{c.name}<br />{c.email}<br />{c.phone}</p></Panel>
        <Panel title="Entrega">
          <p className="text-sm">{(o.shipping_option as { label: string }).label} — {formatBRL(o.shipping_cents)}</p>
          {a && <p className="mt-2 text-sm">{a.recipient_name}<br />{a.street}, {a.number} {a.complement}<br />{a.neighborhood} · {a.city}/{a.state} · {a.cep}</p>}
          {o.tracking_code && <p className="mt-2 text-sm">Rastreio: <strong>{o.tracking_code}</strong></p>}
        </Panel>
        <Panel title="Prazos">
          <p className="text-sm">Pago em: {formatDateSP(o.paid_at, true)}<br />Postagem até: <strong>{formatDateSP(o.dispatch_due_at)}</strong>{o.dispatch_due_at && !o.shipped_at && new Date(o.dispatch_due_at) < new Date() ? <strong className="text-danger"> (vencido)</strong> : null}</p>
          {o.preorder_terms_accepted_at && <details className="mt-2 text-xs"><summary className="cursor-pointer">Aceite de encomenda em {formatDateSP(o.preorder_terms_accepted_at, true)}</summary><p className="mt-1">{o.preorder_terms_text}</p></details>}
        </Panel>
      </div>
      <Panel title="Itens">
        <Table head={["Produto", "SKU", "Modalidade", "Qtd.", "Unitário", "Total"]} rows={items.map((i) => [i.product_name, i.sku ?? "—", i.fulfillment === "preorder" ? `Sob encomenda (${formatLeadTime(i.lead_time_value ?? 0, i.lead_time_unit)})` : "Pronta entrega", String(i.quantity), formatBRL(i.unit_price_cents), formatBRL(i.line_total_cents)])} />
        <p className="mt-3 text-right text-sm">Subtotal {formatBRL(o.subtotal_cents)} · Desconto {formatBRL(o.discount_cents)}{o.coupon_code ? ` (${o.coupon_code})` : ""} · Frete {formatBRL(o.shipping_cents)} · <strong>Total {formatBRL(o.total_cents)}</strong></p>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Pagamentos">
          <Table head={["Status", "Valor", "Pago", "Parcelas", "Meio", "Comprovante"]} rows={pays.map((p) => [p.status, formatBRL(p.amount_cents), formatBRL(p.paid_amount_cents), String(p.installments ?? "—"), p.capture_method ?? "—", p.receipt_url ? <a key="r" href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="underline">abrir</a> : "—"])} empty="Sem pagamentos registrados." />
        </Panel>
        <Panel title="Histórico">
          <ol className="space-y-1 text-sm">{hist.map((h, i) => <li key={i}><span className="text-ink-muted">{formatDateSP(h.created_at, true)}</span> — {ORDER_STATUS_LABEL[h.to_status]} {h.note ? `· ${h.note}` : ""} <span className="text-xs text-ink-muted">({h.actor})</span></li>)}</ol>
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {next.length > 0 && (
          <Panel title="Atualizar status">
            <AdminForm action={adminSetOrderStatus} submit="Atualizar">
              <input type="hidden" name="orderId" value={o.id} />
              <label className="label" htmlFor="to">Novo status</label>
              <select id="to" name="to" className="field">{next.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}</select>
              <label className="label" htmlFor="tr">Código de rastreio (ao postar)</label><input id="tr" name="tracking" className="field" />
              <label className="label" htmlFor="nt">Observação para a cliente</label><input id="nt" name="note" className="field" />
            </AdminForm>
          </Panel>
        )}
        {!["shipped", "delivered", "cancelled", "refunded"].includes(o.status) && (
          <Panel title="Cancelar pedido">
            <AdminForm action={adminCancelOrder} submit="Cancelar pedido" danger>
              <input type="hidden" name="orderId" value={o.id} />
              <label className="label" htmlFor="rs">Motivo (informado à cliente)</label><textarea id="rs" name="reason" className="field" required minLength={5} />
              <p className="text-xs text-ink-muted">Devolve ao estoque os itens não enviados e libera as encomendas. O estorno do valor é feito no painel da InfinitePay.</p>
            </AdminForm>
          </Panel>
        )}
        {o.paid_at && o.status !== "refunded" && (
          <Panel title="Registrar estorno">
            <AdminForm action={adminMarkRefunded} submit="Registrar estorno" danger>
              <input type="hidden" name="orderId" value={o.id} />
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-1 h-5 w-5 accent-ink" /> Confirmo que o estorno foi realizado na InfinitePay.</label>
              <label className="label" htmlFor="rn">Observação</label><input id="rn" name="note" className="field" />
            </AdminForm>
          </Panel>
        )}
      </div>
    </div>
  );
}
