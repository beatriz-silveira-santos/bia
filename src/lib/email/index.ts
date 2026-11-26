import "server-only";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { renderOrderEmail, type OrderTemplate } from "./templates";

export interface EmailMessage { to: string; subject: string; html: string; text: string; kind: "transactional" | "marketing"; unsubscribeUrl?: string }
interface EmailProvider { send(m: EmailMessage): Promise<{ id: string | null }> }

/** Camada substituível. Brevo implementado; outros provedores seguem a mesma interface. */
function provider(): EmailProvider | null {
  const e = env();
  if (e.EMAIL_PROVIDER === "brevo" && e.BREVO_API_KEY && e.EMAIL_FROM) {
    return {
      async send(m) {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": e.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { email: e.EMAIL_FROM, name: e.EMAIL_FROM_NAME },
            to: [{ email: m.to }],
            subject: m.subject,
            htmlContent: m.html,
            textContent: m.text,
            headers: m.unsubscribeUrl ? { "List-Unsubscribe": `<${m.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
          }),
        });
        if (!res.ok) throw new Error(`brevo ${res.status}`);
        const j = (await res.json().catch(() => ({}))) as { messageId?: string };
        return { id: j.messageId ?? null };
      },
    };
  }
  return null;
}

/** Envia no máximo uma vez por chave (idempotente via email_log.dedupe_key). */
export async function sendOnce(dedupeKey: string, template: string, m: EmailMessage) {
  const db = supabaseAdmin();
  if (m.kind === "marketing") {
    const { data: sup } = await db.from("email_suppression_list").select("email").eq("email", m.to.toLowerCase()).maybeSingle();
    if (sup) return "suppressed";
  }
  const { data: row, error } = await db.from("email_log").insert({ dedupe_key: dedupeKey, to_email: m.to, template, kind: m.kind }).select("id").single();
  if (error) return "duplicate";
  const p = provider();
  if (!p) {
    await db.from("email_log").update({ status: "skipped", error: "provedor de e-mail não configurado" }).eq("id", row.id);
    return "skipped";
  }
  try {
    const r = await p.send(m);
    await db.from("email_log").update({ status: "sent", provider_message_id: r.id }).eq("id", row.id);
    return "sent";
  } catch (e) {
    await db.from("email_log").update({ status: "failed", error: String(e).slice(0, 300) }).eq("id", row.id);
    return "failed";
  }
}

export async function sendOrderEmail(orderId: string, template: OrderTemplate, opts: { dedupeSuffix?: string; note?: string } = {}) {
  const db = supabaseAdmin();
  const { data: o } = await db
    .from("orders")
    .select("number,total_cents,customer_snapshot,dispatch_due_at,tracking_code,order_items(product_name,quantity,fulfillment,lead_time_value,lead_time_unit)")
    .eq("id", orderId)
    .single();
  if (!o) return "not_found";
  const c = o.customer_snapshot as { name?: string; email?: string };
  if (!c.email) return "no_email";
  const msg = renderOrderEmail(template, {
    number: o.number,
    customerName: (c.name ?? "").split(" ")[0] || "cliente",
    totalCents: o.total_cents,
    items: o.order_items as never,
    dispatchDueAt: o.dispatch_due_at,
    trackingCode: o.tracking_code,
    note: opts.note ?? null,
  });
  return sendOnce(`order:${orderId}:${template}${opts.dedupeSuffix ? `:${opts.dedupeSuffix}` : ""}`, template, { ...msg, to: c.email, kind: "transactional" });
}
