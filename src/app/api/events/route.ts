import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { classifyChannel, type Touch } from "@/lib/attribution";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  event: z.enum(["page_view", "view_item", "search", "add_to_cart", "remove_from_cart", "begin_checkout", "newsletter_signup", "whatsapp_click", "instagram_click"]),
  path: z.string().max(300).startsWith("/"),
  product_id: z.string().uuid().optional(),
  value_cents: z.number().int().min(0).max(100_000_000).optional(),
  label: z.string().max(60).optional(),
  search_term: z.string().max(80).optional(),
});

/** Eventos próprios, sem dados pessoais; só com consentimento de medição (cookie bs_consent). */
export async function POST(req: NextRequest) {
  const consent = req.cookies.get("bs_consent")?.value;
  try {
    if (!consent || JSON.parse(decodeURIComponent(consent)).analytics !== true) return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  if (!(await rateLimit(`ev:${ip}`, 120, 60))) return new NextResponse(null, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const e = parsed.data;
  let last: Touch | null = null;
  try {
    last = JSON.parse(req.cookies.get("bs_lt")?.value ?? "null");
  } catch {
    last = null;
  }
  await supabaseAdmin().from("analytics_events").insert({
    event_name: e.event,
    visitor_id: req.cookies.get("bs_vid")?.value?.slice(0, 64) ?? null,
    path: e.path.split("?")[0],
    product_id: e.product_id ?? null,
    value_cents: e.value_cents ?? null,
    channel: classifyChannel(last),
    utm_source: last?.utm_source ?? null,
    utm_medium: last?.utm_medium ?? null,
    utm_campaign: last?.utm_campaign ?? null,
    props: { label: e.label, search_term: e.search_term },
  });
  return new NextResponse(null, { status: 204 });
}
