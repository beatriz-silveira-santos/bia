"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { normalizeCep } from "@/lib/shipping/packaging";
import { lookupCep } from "./shipping";
import { MARKETING_CONSENT_TEXT, MARKETING_CONSENT_VERSION } from "@/lib/consent";

export type FormState = { ok: boolean; message: string; id?: string } | null;

const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;
const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().max(40).optional(),
  recipient_name: z.string().trim().min(2, "Informe quem vai receber.").max(120),
  phone: z.string().trim().max(20).optional(),
  cep: z.string().transform((v, ctx) => {
    const c = normalizeCep(v);
    if (!c) ctx.addIssue({ code: "custom", message: "CEP inválido." });
    return c ?? "";
  }),
  street: z.string().trim().min(2, "Informe a rua.").max(160),
  number: z.string().trim().min(1, "Informe o número (ou S/N).").max(20),
  complement: z.string().trim().max(80).optional(),
  neighborhood: z.string().trim().min(2, "Informe o bairro.").max(80),
  city: z.string().trim().min(2, "Informe a cidade.").max(80),
  state: z.enum(UF, { message: "UF inválida." }),
});

export async function saveAddress(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Entre na sua conta." };
  const raw = Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, typeof v === "string" && v === "" ? undefined : v]));
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await supabaseServer();
  const { id, ...data } = parsed.data;
  const q = id
    ? supabase.from("addresses").update(data).eq("id", id).eq("user_id", user.id).select("id").single()
    : supabase.from("addresses").insert({ ...data, user_id: user.id }).select("id").single();
  const { data: row, error } = await q;
  if (error || !row) return { ok: false, message: "Não foi possível salvar o endereço." };
  revalidatePath("/checkout");
  revalidatePath("/conta/enderecos");
  return { ok: true, message: "Endereço salvo.", id: row.id };
}

export async function deleteAddress(form: FormData) {
  const user = await getSessionUser();
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!user || !id.success) return;
  await (await supabaseServer()).from("addresses").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/conta/enderecos");
}

export async function cepLookupAction(cep: string) {
  try {
    return await lookupCep(cep);
  } catch {
    return null;
  }
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Entre na sua conta." };
  const parsed = z.object({ full_name: z.string().trim().min(2).max(120), phone: z.string().trim().max(20).optional() }).safeParse({ full_name: form.get("full_name"), phone: form.get("phone") || undefined });
  if (!parsed.success) return { ok: false, message: "Confira os dados." };
  const { error } = await (await supabaseServer()).from("profiles").update({ full_name: parsed.data.full_name, phone: parsed.data.phone ?? null }).eq("id", user.id);
  if (error) return { ok: false, message: "Não foi possível salvar." };
  revalidatePath("/conta");
  return { ok: true, message: "Dados atualizados." };
}

/** Preferências de comunicação: inscrição/descadastro com registro de consentimento. */
export async function updateMarketingPreference(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user?.email) return { ok: false, message: "Entre na sua conta." };
  const optIn = form.get("marketing") === "on";
  const db = supabaseAdmin();
  const email = user.email.toLowerCase();
  if (optIn) {
    await db.from("email_suppression_list").delete().eq("email", email);
    await db.from("email_subscribers").upsert({ email, user_id: user.id, status: "subscribed", consent_text: MARKETING_CONSENT_TEXT, consent_version: MARKETING_CONSENT_VERSION, consent_source: "conta", consented_at: new Date().toISOString(), unsubscribed_at: null }, { onConflict: "email" });
  } else {
    await db.from("email_subscribers").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }).eq("email", email);
    await db.from("email_suppression_list").upsert({ email, reason: "descadastro pela conta" }, { onConflict: "email" });
  }
  revalidatePath("/conta");
  return { ok: true, message: optIn ? "Você receberá novidades por e-mail." : "Você não receberá mais e-mails promocionais." };
}

export async function createSupportRequest(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Entre na sua conta." };
  const parsed = z.object({ order_id: z.string().uuid().optional(), subject: z.string().trim().min(3).max(200), message: z.string().trim().min(10, "Descreva sua solicitação.").max(4000) }).safeParse({ order_id: form.get("order_id") || undefined, subject: form.get("subject"), message: form.get("message") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { error } = await (await supabaseServer()).from("support_requests").insert({ ...parsed.data, user_id: user.id });
  if (error) return { ok: false, message: "Não foi possível enviar. Tente pelo WhatsApp." };
  return { ok: true, message: "Recebemos sua solicitação. Responderemos pelo e-mail da sua conta." };
}
