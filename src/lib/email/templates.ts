import { formatBRL } from "@/lib/money";
import { formatDateSP, formatLeadTime, type LeadUnit } from "@/lib/leadtime";
import { SITE } from "@/lib/site";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function layout(title: string, bodyHtml: string, footerExtra = "") {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#fbf7f4;font-family:Arial,Helvetica,sans-serif;color:#2a1f22">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf7f4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdfb;border:1px solid #eaddd8;border-radius:16px">
<tr><td style="padding:28px 28px 8px;text-align:center;font-family:Georgia,serif;font-size:26px">Bia Store<div style="font-family:Arial;font-size:10px;letter-spacing:4px;color:#8a5043;margin-top:4px">IMPORTADOS</div></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #eaddd8;font-size:12px;color:#6b5a5f">${esc(SITE.name)} · WhatsApp ${esc(SITE.whatsappDisplay)} · Instagram @${esc(SITE.instagramHandle)}${footerExtra}</td></tr>
</table></td></tr></table></body></html>`;
}

export interface OrderEmailData {
  number: string;
  customerName: string;
  totalCents: number;
  items: { product_name: string; quantity: number; fulfillment: string; lead_time_value: number | null; lead_time_unit: LeadUnit | null }[];
  dispatchDueAt: string | null;
  trackingCode?: string | null;
  note?: string | null;
}

export type OrderTemplate = "order_received" | "payment_confirmed" | "procurement_update" | "procurement_received" | "shipped" | "delivered" | "cancelled" | "refunded";

export function renderOrderEmail(t: OrderTemplate, d: OrderEmailData): { subject: string; html: string; text: string } {
  const link = `${SITE.url}/conta/pedidos/${encodeURIComponent(d.number)}`;
  const items = d.items
    .map((i) => `<li>${i.quantity}× ${esc(i.product_name)}${i.fulfillment === "preorder" ? ` — <strong>sob encomenda</strong>, postagem em até ${esc(formatLeadTime(i.lead_time_value ?? 0, i.lead_time_unit))} após a confirmação do pagamento` : ""}</li>`)
    .join("");
  const hasPre = d.items.some((i) => i.fulfillment === "preorder");
  const map: Record<OrderTemplate, [string, string]> = {
    order_received: [`Recebemos seu pedido ${d.number}`, `<p>Olá, ${esc(d.customerName)}! Recebemos seu pedido <strong>${esc(d.number)}</strong>. Ele será confirmado assim que o pagamento for aprovado.</p>`],
    payment_confirmed: [
      `Pagamento confirmado — pedido ${d.number}`,
      `<p>Olá, ${esc(d.customerName)}! O pagamento do pedido <strong>${esc(d.number)}</strong> (${formatBRL(d.totalCents)}) foi confirmado.</p>${
        hasPre
          ? `<p>Seu pedido contém item(ns) sob encomenda. A postagem ocorrerá até <strong>${formatDateSP(d.dispatchDueAt)}</strong>. O prazo de transporte é adicional e começa após a postagem.</p>`
          : `<p>Vamos preparar seu pedido. Previsão de postagem até <strong>${formatDateSP(d.dispatchDueAt)}</strong>; o transporte é adicional.</p>`
      }`,
    ],
    procurement_update: [`Atualização da sua encomenda — pedido ${d.number}`, `<p>Olá, ${esc(d.customerName)}! Temos uma atualização sobre a encomenda do pedido <strong>${esc(d.number)}</strong>:</p><p>${esc(d.note ?? "")}</p>`],
    procurement_received: [`Produto recebido — pedido ${d.number}`, `<p>Olá, ${esc(d.customerName)}! O(s) item(ns) sob encomenda do pedido <strong>${esc(d.number)}</strong> chegou(aram). Estamos preparando a postagem.</p>`],
    shipped: [`Pedido ${d.number} enviado`, `<p>Olá, ${esc(d.customerName)}! Seu pedido <strong>${esc(d.number)}</strong> foi postado.${d.trackingCode ? ` Código de rastreio: <strong>${esc(d.trackingCode)}</strong>.` : ""}</p>`],
    delivered: [`Pedido ${d.number} entregue`, `<p>Olá, ${esc(d.customerName)}! Seu pedido <strong>${esc(d.number)}</strong> consta como entregue. Se quiser, avalie os produtos na sua conta.</p>`],
    cancelled: [`Pedido ${d.number} cancelado`, `<p>Olá, ${esc(d.customerName)}. O pedido <strong>${esc(d.number)}</strong> foi cancelado.${d.note ? ` Motivo: ${esc(d.note)}.` : ""} Se houve pagamento, o estorno será tratado conforme seus direitos e você será informada.</p>`],
    refunded: [`Estorno do pedido ${d.number}`, `<p>Olá, ${esc(d.customerName)}. O estorno do pedido <strong>${esc(d.number)}</strong> foi registrado. O prazo para aparecer na fatura/conta depende do meio de pagamento.</p>`],
  };
  const [subject, intro] = map[t];
  const html = layout(subject, `${intro}<ul>${items}</ul><p><a href="${link}" style="color:#8a5043">Acompanhar pedido</a></p>`);
  const text = `${subject}\n\n${intro.replace(/<[^>]+>/g, "")}\n\nAcompanhe: ${link}`;
  return { subject, html, text };
}
