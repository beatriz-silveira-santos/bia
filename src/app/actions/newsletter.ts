"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { MARKETING_CONSENT_TEXT, MARKETING_CONSENT_VERSION } from "@/lib/consent";
import { getSessionUser } from "@/lib/auth";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  consent: z.literal("on"),
  source: z.string().max(40).default("site"),
  interests: z.array(z.enum(["perfumes-femininos", "perfumes-masculinos", "perfumes-arabes", "decantes", "skincare", "cabelos"])).default([]),
});

export type NewsletterState = { ok: boolean; message: string } | null;

export async function subscribeNewsletter(_: NewsletterState, form: FormData): Promise<NewsletterState> {
  const parsed = schema.safeParse({
    email: form.get("email"),
    consent: form.get("consent"),
    source: form.get("source") ?? "site",
    interests: form.getAll("interests"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Informe um e-mail válido e marque a caixa de consentimento para se inscrever." };
  }
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "local";
  if (!(await rateLimit(`nl:${ip}`, 5, 3600))) return { ok: false, message: "Muitas tentativas. Tente novamente mais tarde." };
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) {
    return { ok: false, message: "Não foi possível validar o envio. Recarregue a página e tente novamente." };
  }

  const db = supabaseAdmin();
  const { email, source, interests } = parsed.data;
  const { data: suppressed } = await db.from("email_suppression_list").select("email").eq("email", email).maybeSingle();
  // Quem se descadastrou e volta a se inscrever explicitamente pode ser reinscrita; removemos da supressão
  if (suppressed) await db.from("email_suppression_list").delete().eq("email", email);
  const user = await getSessionUser();
  const { error } = await db.from("email_subscribers").upsert(
    {
      email,
      user_id: user?.id ?? null,
      status: "subscribed",
      interests,
      consent_text: MARKETING_CONSENT_TEXT,
      consent_version: MARKETING_CONSENT_VERSION,
      consent_source: source,
      consented_at: new Date().toISOString(),
      unsubscribed_at: null,
    },
    { onConflict: "email" },
  );
  if (error) return { ok: false, message: "Não foi possível concluir agora. Tente novamente em instantes." };
  return { ok: true, message: "Inscrição confirmada. Você pode cancelar quando quiser pelo link nos e-mails." };
}
