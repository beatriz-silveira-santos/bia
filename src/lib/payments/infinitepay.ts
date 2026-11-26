import "server-only";
import { env } from "@/lib/env";

/**
 * InfinitePay — Checkout Integrado (link externo; sem iframe, sem checkout transparente).
 * Documentação oficial: https://www.infinitepay.io/checkout-documentacao
 * - Criação de link: POST https://api.checkout.infinitepay.io/links
 * - Verificação:     POST https://api.checkout.infinitepay.io/payment_check
 * - Webhook NÃO é assinado: todo evento é confirmado via payment_check antes de qualquer efeito.
 * - Não há sandbox: testes financeiros só com autorização expressa da proprietária.
 */
const API = "https://api.checkout.infinitepay.io";

export interface LinkItem { description: string; price: number; quantity: number }

export interface CreateLinkInput {
  orderNsu: string;
  items: LinkItem[];
  redirectUrl: string;
  webhookUrl: string;
  customer?: { name?: string; email?: string; phone_number?: string };
  address?: { cep: string; street: string; number: string; neighborhood: string; city: string; state: string; complement?: string | null };
  validUntil?: Date;
  pixEnabled: boolean;
  assuredInstallments: number; // 0 = taxas do parcelamento repassadas à cliente
}

export class PaymentConfigError extends Error {}

export function infinitePayConfigured() {
  const e = env();
  return Boolean(e.INFINITEPAY_HANDLE);
}

export async function createPaymentLink(input: CreateLinkInput): Promise<{ url: string; raw: unknown }> {
  const e = env();
  if (!e.INFINITEPAY_HANDLE) throw new PaymentConfigError("INFINITEPAY_HANDLE não configurado");
  const body: Record<string, unknown> = {
    handle: e.INFINITEPAY_HANDLE.replace(/^\$/, ""),
    order_nsu: input.orderNsu,
    items: input.items.map((i) => ({ description: i.description.slice(0, 120), price: i.price, quantity: i.quantity })),
    redirect_url: input.redirectUrl,
    webhook: { url: input.webhookUrl, events: ["paid", "settled", "canceled", "refunded", "payment_failed"] },
    webhook_url: input.webhookUrl,
  };
  if (input.customer) body.customer = input.customer;
  if (input.address) body.address = { ...input.address, complement: input.address.complement ?? undefined };

  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (e.INFINITEPAY_API_KEY) {
    headers["X-Api-Key"] = e.INFINITEPAY_API_KEY;
    body.options = {
      single_payment: true,
      assured_installments: input.assuredInstallments,
      require_delivery_address: false,
      ...(input.validUntil ? { valid_until: input.validUntil.toISOString() } : {}),
      payment_methods_enabled: input.pixEnabled ? ["credit_card", "pix"] : ["credit_card"],
    };
  }

  const res = await fetch(`${API}/links`, { method: "POST", headers, body: JSON.stringify(body) });
  const raw = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`InfinitePay /links respondeu ${res.status}`);
  const url = pickUrl(raw);
  if (!url) throw new Error("InfinitePay não retornou URL de checkout");
  return { url, raw };
}

/** A documentação não fixa o nome do campo da URL na resposta; aceitamos os formatos conhecidos. */
export function pickUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const candidates = [r.url, r.link, r.checkout_url, r.payment_url, (r.data as Record<string, unknown> | undefined)?.url];
  const found = candidates.find((c): c is string => typeof c === "string" && /^https:\/\/[^\s]+$/.test(c));
  if (!found) return null;
  const host = new URL(found).hostname;
  // Só redireciona para domínios da InfinitePay (evita open redirect)
  return /(^|\.)infinitepay\.io$/.test(host) || /(^|\.)infinitepay\.com\.br$/.test(host) ? found : null;
}

export interface PaymentCheckResult {
  success: boolean;
  paid: boolean;
  amount: number | null;
  paid_amount: number | null;
  installments: number | null;
  capture_method: string | null;
}

export async function paymentCheck(params: { orderNsu: string; transactionNsu: string; slug: string }): Promise<PaymentCheckResult> {
  const e = env();
  if (!e.INFINITEPAY_HANDLE) throw new PaymentConfigError("INFINITEPAY_HANDLE não configurado");
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (e.INFINITEPAY_API_KEY) headers["X-Api-Key"] = e.INFINITEPAY_API_KEY;
  const res = await fetch(`${API}/payment_check`, {
    method: "POST",
    headers,
    body: JSON.stringify({ handle: e.INFINITEPAY_HANDLE.replace(/^\$/, ""), order_nsu: params.orderNsu, transaction_nsu: params.transactionNsu, slug: params.slug }),
  });
  if (!res.ok) throw new Error(`InfinitePay /payment_check respondeu ${res.status}`);
  const j = (await res.json()) as Record<string, unknown>;
  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
  return {
    success: j.success === true,
    paid: j.paid === true,
    amount: int(j.amount),
    paid_amount: int(j.paid_amount),
    installments: int(j.installments),
    capture_method: typeof j.capture_method === "string" ? j.capture_method : null,
  };
}
