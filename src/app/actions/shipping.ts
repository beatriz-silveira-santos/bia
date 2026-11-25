"use server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { quoteShipping } from "@/lib/shipping";
import { normalizeCep } from "@/lib/shipping/packaging";
import type { ShippingOption } from "@/lib/shipping/types";
import { supabaseAdmin } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";

export type QuoteState = {
  ok: boolean;
  message?: string;
  quoteId?: string;
  cep?: string;
  options?: ShippingOption[];
  carrierUnavailable?: string;
} | null;

const CARRIER_MSG: Record<string, string> = {
  not_configured: "A cotação automática de transporte ainda não está ativa. Fale com a gente pelo WhatsApp para combinar o envio.",
  provider_error: "Não conseguimos consultar o frete agora. Tente novamente em instantes ou fale com a gente pelo WhatsApp.",
  no_options: "Não há modalidade de transporte disponível para este CEP e pacote. Fale com a gente pelo WhatsApp.",
  missing_dimensions: "Um dos produtos ainda não tem peso e dimensões cadastrados, então não é possível cotar o transporte. Fale com a gente pelo WhatsApp.",
};

/** Cota frete no servidor e grava a cotação (o checkout só aceita cotações gravadas aqui). */
export async function quoteCartShipping(_: QuoteState, form: FormData): Promise<QuoteState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Entre na sua conta para calcular o frete." };
  const cep = normalizeCep(String(form.get("cep") ?? ""));
  if (!cep) return { ok: false, message: "CEP inválido. Confira os 8 números." };
  if (!(await rateLimit(`quote:${user.id}`, 30, 600))) return { ok: false, message: "Muitas cotações seguidas. Aguarde um pouco." };

  const lines = await getCart(user.id);
  if (!lines.length) return { ok: false, message: "Seu carrinho está vazio." };

  const db = supabaseAdmin();
  const { data: dims } = await db.from("products").select("id,weight_g,width_cm,height_cm,length_cm").in("id", lines.map((l) => l.product.id));
  const dimMap = new Map((dims ?? []).map((d) => [d.id, d]));
  const items = lines.map((l) => ({ ...(dimMap.get(l.product.id) ?? { weight_g: null, width_cm: null, height_cm: null, length_cm: null }), quantity: l.quantity }));
  const subtotal = lines.reduce((s, l) => s + l.product.effective_price_cents * l.quantity, 0);

  const result = await quoteShipping({ destinationCep: cep, items, declaredValueCents: subtotal });
  if (!result.options.length) {
    return { ok: false, cep, message: CARRIER_MSG[result.carrierError?.reason ?? "no_options"] ?? CARRIER_MSG.no_options };
  }
  const { data: fingerprint } = await db.rpc("cart_fingerprint", { p_user: user.id });
  const { data: saved, error } = await db
    .from("shipping_quotes")
    .insert({ user_id: user.id, destination_cep: cep, cart_fingerprint: fingerprint, package: result.package ?? {}, options: result.options })
    .select("id")
    .single();
  if (error || !saved) return { ok: false, message: "Não foi possível registrar a cotação. Tente novamente." };
  return {
    ok: true,
    cep,
    quoteId: saved.id,
    options: result.options,
    carrierUnavailable: result.carrierError ? CARRIER_MSG[result.carrierError.reason] : undefined,
  };
}

export async function lookupCep(cepRaw: string) {
  const cep = z.string().parse(normalizeCep(cepRaw) ?? "");
  // ViaCEP: serviço público gratuito para preencher endereço (a cliente confere e edita)
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { next: { revalidate: 86400 } }).catch(() => null);
  if (!res?.ok) return null;
  const j = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
  if (j.erro) return null;
  return { street: j.logradouro ?? "", neighborhood: j.bairro ?? "", city: j.localidade ?? "", state: j.uf ?? "" };
}
