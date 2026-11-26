import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyAndConfirm } from "@/lib/payments/confirm";

const payloadSchema = z.object({
  event: z.string().max(40).optional(),
  type: z.string().max(40).optional(),
  invoice_slug: z.string().max(120).optional(),
  transaction_nsu: z.string().max(120).optional(),
  order_nsu: z.string().max(120).optional(),
  amount: z.number().int().optional(),
  paid_amount: z.number().int().optional(),
  capture_method: z.string().max(40).optional(),
  receipt_url: z.string().max(500).optional(),
}).passthrough();

/**
 * Webhook da InfinitePay. Não é assinado, então:
 * - nunca confiamos no conteúdo: cada evento de pagamento é revalidado via payment_check;
 * - eventos são registrados com chave de deduplicação (idempotência);
 * - 2xx = processado; 5xx = falha temporária (o provedor reenvia); 400 = payload inválido.
 */
export async function POST(req: NextRequest) {
  const text = await req.text();
  if (text.length > 20_000) return NextResponse.json({ error: "payload_too_large" }, { status: 400 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const p = parsed.data;
  const eventType = (p.event ?? p.type ?? (p.transaction_nsu ? "paid" : "unknown")).toLowerCase();
  const dedupeKey = `${eventType}:${p.order_nsu ?? "-"}:${p.transaction_nsu ?? "-"}:${p.invoice_slug ?? "-"}`;

  const db = supabaseAdmin();
  const { data: ev, error: insErr } = await db
    .from("payment_webhook_events")
    .insert({ dedupe_key: dedupeKey, event_type: eventType, order_nsu: p.order_nsu ?? null, payload: p })
    .select("id")
    .single();
  let eventId = ev?.id as string | undefined;
  if (insErr) {
    // Duplicado: se já processado, responde OK; se não, reprocessa (idempotente)
    const { data: prev } = await db.from("payment_webhook_events").select("id,processed_at").eq("provider", "infinitepay").eq("dedupe_key", dedupeKey).maybeSingle();
    if (prev?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
    eventId = prev?.id;
  }

  let result = "ignored";
  if (["paid", "settled", "approved"].includes(eventType) && p.order_nsu && p.transaction_nsu && p.invoice_slug) {
    result = await verifyAndConfirm({ orderNsu: p.order_nsu, transactionNsu: p.transaction_nsu, slug: p.invoice_slug, receiptUrl: p.receipt_url });
    if (result === "check_failed") return NextResponse.json({ error: "retry" }, { status: 503 });
  } else if (eventType === "payment_failed" && p.order_nsu) {
    const { data } = await db.rpc("svc_mark_payment_failed", { p_order_nsu: p.order_nsu });
    result = String(data);
  } else if (["refunded", "canceled", "cancelled"].includes(eventType)) {
    // Estorno/cancelamento: registra alerta para a administradora conferir e concluir no painel
    const { data: order } = p.order_nsu ? await db.from("orders").select("id").eq("order_nsu", p.order_nsu).maybeSingle() : { data: null };
    await db.from("admin_alerts").insert({ kind: `provider_${eventType}`, order_id: order?.id ?? null, details: { order_nsu: p.order_nsu, transaction_nsu: p.transaction_nsu } });
    result = "alerted";
  }

  if (eventId) await db.from("payment_webhook_events").update({ processed_at: new Date().toISOString(), result }).eq("id", eventId);
  return NextResponse.json({ ok: true });
}
