"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { SITE } from "@/lib/site";

export type AuthState = { ok: boolean; message: string } | null;

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  // Evita open redirect: apenas caminhos internos
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/conta";
}
async function clientIp() {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "local";
}

const pw = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72);

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { ok: false, message: "Informe e-mail e senha." };
  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 10, 600)) || !(await rateLimit(`login:${parsed.data.email}`, 8, 600))) {
    return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { ok: false, message: "Confirme seu e-mail pelo link que enviamos antes de entrar." };
    return { ok: false, message: "E-mail ou senha incorretos." };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, "Informe seu nome.").max(120),
      email: z.string().trim().toLowerCase().email("E-mail inválido."),
      phone: z.string().trim().max(20).optional(),
      password: pw,
      terms: z.literal("on", { message: "É preciso aceitar os termos e a política de privacidade." }),
    })
    .safeParse({ full_name: form.get("full_name"), email: form.get("email"), phone: form.get("phone") || undefined, password: form.get("password"), terms: form.get("terms") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, 5, 3600))) return { ok: false, message: "Muitas tentativas. Tente mais tarde." };
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) return { ok: false, message: "Não foi possível validar o envio. Recarregue a página." };
  const supabase = await supabaseServer();
  const next = safeNext(form.get("next"));
  // Papel de administradora NUNCA é definido no cadastro (só via user_roles, provisionado no banco)
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, phone: parsed.data.phone ?? null },
      emailRedirectTo: `${SITE.url}/auth/confirmar?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { ok: false, message: "Escolha uma senha mais forte." };
    return { ok: false, message: "Não foi possível criar a conta agora. Tente novamente." };
  }
  // Mensagem neutra (não revela se o e-mail já tinha conta)
  return { ok: true, message: "Pronto! Enviamos um link de confirmação para o seu e-mail. Abra-o para ativar a conta." };
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { ok: false, message: "Informe um e-mail válido." };
  const ip = await clientIp();
  if (!(await rateLimit(`reset:${ip}`, 5, 3600))) return { ok: false, message: "Muitas tentativas. Tente mais tarde." };
  const supabase = await supabaseServer();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${SITE.url}/auth/confirmar?next=/nova-senha` });
  return { ok: true, message: "Se houver uma conta com este e-mail, você receberá um link para criar uma nova senha." };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = pw.safeParse(form.get("password"));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (form.get("password") !== form.get("confirm")) return { ok: false, message: "As senhas não conferem." };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, message: "O link expirou. Solicite uma nova recuperação de senha." };
  return { ok: true, message: "Senha atualizada com sucesso." };
}

export async function signOut(form: FormData) {
  const supabase = await supabaseServer();
  const scope = form.get("scope") === "global" ? "global" : "local";
  await supabase.auth.signOut({ scope });
  redirect("/");
}
