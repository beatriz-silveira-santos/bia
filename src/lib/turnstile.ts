import "server-only";
import { env } from "@/lib/env";

/** Valida Cloudflare Turnstile quando configurado; sem chave (dev), não bloqueia. */
export async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) return env().APP_ENV !== "production" || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!token) return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
  return json?.success === true;
}
