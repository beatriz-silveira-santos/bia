import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { paymentCheck } from "./infinitepay";
import { sendOrderEmail } from "@/lib/email";

export type ConfirmOutcome = "confirmed" | "already_processed" | "not_paid" | "unknown_order" | "amount_mismatch" | "late_payment" | "check_failed";

/**
 * Fluxo único de confirmação (usado pelo webhook e pela página de retorno):
 * 1) consulta oficial payment_check; 2) valida pedido e valor no banco (função transacional, idempotente).
 * Voltar à página de sucesso NUNCA marca o pedido como pago sozinho.
 */
export async function verifyAndConfirm(p: { orderNsu: string; transactionNsu: string; slug: string; receiptUrl?: string | null }): Promise<ConfirmOutcome> {
  let check;
  try {
    check = await paymentCheck({ orderNsu: p.orderNsu, transactionNsu: p.transactionNsu, slug: p.slug });
  } catch {
    return "check_failed";
  }
  if (!check.success || !check.paid) return "not_paid";
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("svc_confirm_payment", {
    p_order_nsu: p.orderNsu,
    p_invoice_slug: p.slug,
    p_transaction_nsu: p.transactionNsu,
    p_amount_cents: check.amount,
    p_paid_amount_cents: check.paid_amount,
    p_installments: check.installments,
    p_capture_method: check.capture_method,
    p_receipt_url: p.receiptUrl && /^https:\/\//.test(p.receiptUrl) ? p.receiptUrl.slice(0, 500) : null,
  });
  if (error) return "check_failed";
  const outcome = data as ConfirmOutcome;
  if (outcome === "confirmed") {
    const { data: order } = await db.from("orders").select("id").eq("order_nsu", p.orderNsu).single();
    if (order) await sendOrderEmail(order.id, "payment_confirmed").catch(() => undefined);
  }
  return outcome;
}
