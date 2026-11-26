import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Tarefas periódicas: expira reservas, sinaliza prazos de encomenda e aplica retenção de analytics. */
export async function POST(req: NextRequest) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  const { data: expired } = await db.rpc("svc_expire_pending_orders");

  // Alertas de prazo de postagem (uma vez por alocação e tipo)
  const soon = new Date(Date.now() + 3 * 86400_000).toISOString();
  const { data: due } = await db
    .from("preorder_allocations")
    .select("id,order_id,dispatch_due_at")
    .in("status", ["awaiting_purchase", "purchased", "awaiting_receipt", "received"])
    .lte("dispatch_due_at", soon);
  let alerts = 0;
  for (const a of due ?? []) {
    const kind = new Date(a.dispatch_due_at) < new Date() ? "preorder_overdue" : "preorder_due_soon";
    const { count } = await db.from("admin_alerts").select("id", { count: "exact", head: true }).eq("kind", kind).eq("order_id", a.order_id).is("resolved_at", null);
    if (!count) {
      await db.from("admin_alerts").insert({ kind, order_id: a.order_id, details: { allocation_id: a.id, dispatch_due_at: a.dispatch_due_at } });
      alerts++;
    }
  }

  const { data: s } = await db.from("store_settings").select("analytics_retention_days").eq("id", 1).single();
  const cutoff = new Date(Date.now() - (s?.analytics_retention_days ?? 395) * 86400_000).toISOString();
  await db.from("analytics_events").delete().lt("created_at", cutoff);
  await db.from("shipping_quotes").delete().lt("expires_at", new Date(Date.now() - 86400_000).toISOString());

  return NextResponse.json({ expired, alerts });
}
