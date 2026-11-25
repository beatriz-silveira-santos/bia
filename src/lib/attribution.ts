import "server-only";
import { cookies } from "next/headers";

export interface Touch { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string; ref?: string; path?: string; at?: number }

/** Classifica o canal a partir de UTM/referrer. Sem identificação => "direto/desconhecido". */
export function classifyChannel(t: Touch | null): string {
  if (!t) return "direto";
  const src = (t.utm_source ?? "").toLowerCase();
  const med = (t.utm_medium ?? "").toLowerCase();
  const ref = (t.ref ?? "").toLowerCase();
  if (src.includes("instagram") || ref.includes("instagram")) {
    if (med === "bio") return "instagram_bio";
    if (med.includes("stor")) return "instagram_stories";
    if (["cpc", "paid", "ads", "paid_social"].includes(med)) return "meta_ads";
    if (med.includes("post") || med.includes("reel")) return "instagram_post";
    return "instagram";
  }
  if (src.includes("facebook") || src === "fb" || ref.includes("facebook")) return ["cpc", "paid", "ads", "paid_social"].includes(med) ? "meta_ads" : "facebook";
  if (src.includes("google") || ref.includes("google.")) return ["cpc", "paid", "ads"].includes(med) ? "google_ads" : "google";
  if (src.includes("whatsapp") || ref.includes("whatsapp") || ref === "wa.me") return "whatsapp";
  if (src.includes("email") || med === "email") return "email";
  if (src) return `utm:${src}`.slice(0, 60);
  if (ref) return "referencia";
  return "direto";
}

export async function readTouches() {
  const c = await cookies();
  const parse = (v?: string): Touch | null => {
    try {
      return v ? (JSON.parse(v) as Touch) : null;
    } catch {
      return null;
    }
  };
  const first = parse(c.get("bs_ft")?.value);
  const last = parse(c.get("bs_lt")?.value);
  return { first, last, visitorId: c.get("bs_vid")?.value ?? null, firstChannel: classifyChannel(first), lastChannel: classifyChannel(last) };
}
