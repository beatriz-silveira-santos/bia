import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatDateSP, formatLeadTime, type LeadUnit } from "@/lib/leadtime";
import { formatBRL } from "@/lib/money";
import { supabaseServer } from "@/lib/supabase/server";
import { ORDER_STATUS_LABEL } from "@/lib/types";
import { ReviewForm, SupportForm } from "@/components/store/AccountForms";
import { IconCheck, IconClock } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

const PREORDER_STEPS = ["Pagamento confirmado", "Aguardando abastecimento", "Produto recebido", "Preparando postagem", "Enviado", "Entregue"];
function preorderStep(status: string) {
  return { awaiting_procurement: 1, procurement_received: 3, ready_to_ship: 3, shipped: 4, delivered: 5 }[status] ?? (status === "paid" ? 0 : -1);
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ retorno?: string }> }) {
  const { number } = await params;
  const { retorno } = await searchParams;
  const user = await requireUser(`/conta/pedidos/${number}`);
  const supabase = await supabaseServer();
  // RLS garante que só a dona do pedido o lê
  const { data: o } = await supabase
    .from("orders")
    .select("*, order_items(*), order_status_history(to_status,note,created_at)")
    .eq("number", decodeURIComponent(number))
    .eq("user_id", user.id)
    .maybeSingle();
  if (!o) notFound();
  const items = o.order_items as { id: string; product_id: string; product_name: string; quantity: number; unit_price_cents: number; line_total_cents: number; fulfillment: string; lead_time_value: number | null; lead_time_unit: LeadUnit | null }[];
  const history = (o.order_status_history as { to_status: string; note: string | null; created_at: string }[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const { data: myReviews } = await supabase.from("reviews").select("product_id").eq("order_id", o.id);
  const reviewed = new Set((myReviews ?? []).map((r) => r.product_id));
  const step = o.has_preorder ? preorderStep(o.status) : -1;
  const addr = o.shipping_address as Record<string, string> | null;
  const ship = o.shipping_option as { label: string; note?: string };

  return (
    <div className="space-y-6">
      {retorno && o.status === "awaiting_payment" && (
        <p role="status" className="rounded-2xl bg-info-bg p-4 text-info">Estamos aguardando a confirmação do pagamento pela InfinitePay. Isso pode levar alguns instantes; atualize a página em seguida.</p>
      )}
      {retorno && o.paid_at && <p role="status" className="rounded-2xl bg-success-bg p-4 text-success">Pagamento confirmado. Obrigada pela compra!</p>}
      <header className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-3xl">Pedido {o.number}</h2>
          <p className="text-sm text-ink-muted">Feito em {formatDateSP(o.created_at, true)}</p>
        </div>
        <p className="rounded-full bg-blush-100 px-4 py-2 font-semibold">{ORDER_STATUS_LABEL[o.status]}</p>
      </header>

      {o.status === "awaiting_payment" && o.payment_link_url && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-ink-soft">O pagamento ainda não foi concluído. A reserva vale até {formatDateSP(o.payment_expires_at, true)}.</p>
          <a href={o.payment_link_url} className="btn-primary !min-h-11">Concluir pagamento</a>
        </div>
      )}

      {o.has_preorder && o.paid_at && (
        <section className="card p-6" aria-labelledby="h-enc">
          <h3 id="h-enc" className="mb-2 text-2xl">Acompanhamento da encomenda</h3>
          <p className="mb-5 text-sm text-ink-soft">Postagem prevista até <strong>{formatDateSP(o.dispatch_due_at)}</strong> (prazo contado a partir da confirmação do pagamento em {formatDateSP(o.paid_at)}). O transporte é adicional.</p>
          <ol className="grid gap-3 sm:grid-cols-6">
            {PREORDER_STEPS.map((label, i) => (
              <li key={label} className={`flex items-center gap-2 text-sm sm:flex-col sm:text-center ${i <= step ? "text-ink" : "text-ink-muted"}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${i <= step ? "bg-ink text-ivory" : "border border-line-strong"}`}>{i <= step ? <IconCheck width={16} height={16} /> : i + 1}</span>
                <span>{label}{i <= step ? <span className="sr-only"> (concluído)</span> : null}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card p-6" aria-labelledby="h-itens">
        <h3 id="h-itens" className="mb-4 text-2xl">Itens</h3>
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="py-4">
              <div className="flex flex-wrap justify-between gap-3">
                <span>
                  {i.quantity}× {i.product_name}
                  <span className="block text-sm text-ink-muted">
                    {i.fulfillment === "preorder" ? <><IconClock width={14} height={14} className="inline" /> Sob encomenda — postagem em até {formatLeadTime(i.lead_time_value ?? 0, i.lead_time_unit)} após a confirmação do pagamento</> : "Pronta entrega"}
                  </span>
                </span>
                <span>{formatBRL(i.line_total_cents)}</span>
              </div>
              {o.status === "delivered" && i.product_id && !reviewed.has(i.product_id) && (
                <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold underline underline-offset-4">Avaliar produto</summary><div className="mt-3"><ReviewForm productId={i.product_id} orderId={o.id} productName={i.product_name} /></div></details>
              )}
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(o.subtotal_cents)}</dd></div>
          {o.discount_cents > 0 && <div className="flex justify-between"><dt>Desconto {o.coupon_code ? `(${o.coupon_code})` : ""}</dt><dd>−{formatBRL(o.discount_cents)}</dd></div>}
          <div className="flex justify-between"><dt>Frete — {ship.label}</dt><dd>{formatBRL(o.shipping_cents)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatBRL(o.total_cents)}</dd></div>
        </dl>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-6" aria-labelledby="h-ent">
          <h3 id="h-ent" className="mb-3 text-2xl">Entrega</h3>
          {addr ? <p className="text-sm text-ink-soft">{addr.recipient_name}<br />{addr.street}, {addr.number}{addr.complement ? ` — ${addr.complement}` : ""}<br />{addr.neighborhood} · {addr.city}/{addr.state} · CEP {addr.cep}</p> : <p className="text-sm text-ink-soft">{ship.label}{ship.note ? ` — ${ship.note}` : ""}</p>}
          {o.tracking_code && <p className="mt-3 text-sm">Rastreio: <strong>{o.tracking_code}</strong></p>}
        </section>
        <section className="card p-6" aria-labelledby="h-hist">
          <h3 id="h-hist" className="mb-3 text-2xl">Histórico</h3>
          <ol className="space-y-2 text-sm">
            {history.map((h, i) => <li key={i}><span className="text-ink-muted">{formatDateSP(h.created_at, true)}</span> — {h.note ?? ORDER_STATUS_LABEL[h.to_status]}</li>)}
          </ol>
        </section>
      </div>

      {o.preorder_terms_text && (
        <details className="card p-6"><summary className="cursor-pointer font-semibold">Ciência do prazo aceita em {formatDateSP(o.preorder_terms_accepted_at, true)}</summary><p className="mt-3 text-sm text-ink-soft">{o.preorder_terms_text}</p></details>
      )}
      <section className="card p-6" aria-labelledby="h-aj">
        <h3 id="h-aj" className="mb-3 text-2xl">Precisa de ajuda com este pedido?</h3>
        <SupportForm orderId={o.id} />
      </section>
    </div>
  );
}
