"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { preorderAckText } from "@/lib/leadtime";
import { createPaymentLink, infinitePayConfigured } from "@/lib/payments/infinitepay";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { readTouches } from "@/lib/attribution";
import { SITE } from "@/lib/site";
import { rateLimit } from "@/lib/ratelimit";
import { sendOrderEmail } from "@/lib/email";

export type CheckoutState = { ok: false; message: string } | null;

const ERRORS: Record<string, string> = {
  checkout_disabled: "As compras pelo site ainda não foram liberadas. Fale com a gente pelo WhatsApp.",
  cart_empty: "Seu carrinho está vazio.",
  shipping_quote_invalid: "A cotação de frete expirou. Calcule o frete novamente.",
  shipping_quote_stale: "Seu carrinho mudou depois da cotação. Calcule o frete novamente.",
  shipping_option_invalid: "Escolha uma opção de entrega válida.",
  shipping_quote_cep_mismatch: "O CEP do endereço é diferente do CEP cotado. Calcule o frete para este endereço.",
  address_invalid: "Escolha um endereço de entrega.",
  pickup_disabled: "A retirada não está disponível.",
  product_unavailable: "Um produto do carrinho ficou indisponível. Revise o carrinho.",
  insufficient_stock: "Não há estoque suficiente de um dos produtos. Ajuste a quantidade no carrinho.",
  preorder_unit_not_configured: "As encomendas ainda não foram liberadas pela loja. Remova o item sob encomenda ou fale com a gente.",
  preorder_capacity_exceeded: "O limite de encomendas de um produto foi atingido. Ajuste a quantidade.",
  preorder_ack_required: "Para continuar, confirme que está ciente do prazo de postagem do item sob encomenda.",
  coupon_invalid: "Cupom inválido ou fora do período.",
  coupon_exhausted: "Este cupom atingiu o limite de usos.",
  coupon_customer_limit: "Você já utilizou este cupom o máximo de vezes permitido.",
  coupon_min_subtotal: "O cupom exige um valor mínimo de compra.",
  coupon_not_applicable: "O cupom não se aplica aos produtos do carrinho.",
  order_total_below_minimum: "O valor mínimo para pagamento é R$ 1,00.",
};

const schema = z.object({
  addressId: z.string().uuid().optional(),
  quoteId: z.string().uuid(),
  optionCode: z.string().min(1).max(80),
  coupon: z.string().trim().max(40).optional(),
  preorderAck: z.literal("on").optional(),
});

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/checkout");
  const parsed = schema.safeParse({
    addressId: form.get("addressId") || undefined,
    quoteId: form.get("quoteId"),
    optionCode: form.get("optionCode"),
    coupon: form.get("coupon") || undefined,
    preorderAck: form.get("preorderAck") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Revise o endereço e a forma de entrega." };
  if (!(await rateLimit(`checkout:${user.id}`, 10, 600))) return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos." };
  if (!infinitePayConfigured()) return { ok: false, message: "O pagamento online ainda não está configurado. Fale com a gente pelo WhatsApp." };

  // O texto do aceite é reconstruído no servidor a partir do carrinho atual (o mesmo exibido na tela)
  const lines = await getCart(user.id);
  const pre = lines.filter((l) => l.product.sale_state === "preorder");
  const ackText = pre.length
    ? preorderAckText(pre.map((l) => ({ name: l.product.name, value: l.product.preorder_lead_time_value, unit: l.product.preorder_lead_time_unit! })))
    : null;

  const supabase = await supabaseServer();
  const { data: profile } = await supabase.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle();
  const touches = await readTouches();
  const db = supabaseAdmin();

  const { data: order, error } = await db.rpc("svc_create_order", {
    p_user_id: user.id,
    p_address_id: parsed.data.addressId ?? null,
    p_shipping_quote_id: parsed.data.quoteId,
    p_shipping_option_code: parsed.data.optionCode,
    p_coupon_code: parsed.data.coupon ?? null,
    p_preorder_ack: parsed.data.preorderAck === "on",
    p_preorder_terms_text: ackText,
    p_customer: { name: profile?.full_name ?? null, email: user.email, phone: profile?.phone ?? null },
    p_attribution: { first: touches.first, last: touches.last, first_channel: touches.firstChannel, last_channel: touches.lastChannel, visitor_id: touches.visitorId },
  });
  if (error || !order) {
    const code = (error?.message ?? "").split(":")[0];
    return { ok: false, message: ERRORS[code] ?? "Não foi possível criar o pedido. Tente novamente." };
  }

  const o = order as {
    id: string; number: string; order_nsu: string; total_cents: number; shipping_cents: number; discount_cents: number; payment_expires_at: string;
    shipping_address: { cep: string; street: string; number: string; neighborhood: string; city: string; state: string; complement: string | null } | null;
    shipping_option: { label: string };
    items: { product_name: string; unit_price_cents: number; quantity: number; fulfillment: string }[];
  };

  const { data: settings } = await db.from("store_settings").select("payment_pix_enabled,assured_installments").eq("id", 1).single();
  // Itens enviados à InfinitePay: com desconto, enviamos um item consolidado para que a soma bata exatamente com o total
  const linkItems =
    o.discount_cents > 0
      ? [{ description: `Pedido ${o.number} (${o.items.length} itens, frete e desconto incluídos)`, price: o.total_cents, quantity: 1 }]
      : [
          ...o.items.map((i) => ({ description: `${i.product_name}${i.fulfillment === "preorder" ? " (sob encomenda)" : ""}`, price: i.unit_price_cents, quantity: i.quantity })),
          ...(o.shipping_cents > 0 ? [{ description: `Frete — ${o.shipping_option.label}`, price: o.shipping_cents, quantity: 1 }] : []),
        ];

  let url: string;
  try {
    const phone = profile?.phone?.replace(/\D/g, "");
    const link = await createPaymentLink({
      orderNsu: o.order_nsu,
      items: linkItems,
      redirectUrl: `${SITE.url}/pedido/retorno`,
      webhookUrl: `${SITE.url}/api/webhooks/infinitepay`,
      customer: { name: profile?.full_name ?? undefined, email: user.email ?? undefined, phone_number: phone && phone.length >= 10 ? `+55${phone.replace(/^55/, "")}` : undefined },
      address: o.shipping_address ? { ...o.shipping_address } : undefined,
      validUntil: new Date(o.payment_expires_at),
      pixEnabled: settings?.payment_pix_enabled ?? true,
      assuredInstallments: settings?.assured_installments ?? 0,
    });
    url = link.url;
  } catch {
    // Falha ao gerar link: libera a reserva imediatamente
    await db.rpc("svc_admin_cancel_order", { p_actor: null, p_order_id: o.id, p_reason: "Falha ao gerar link de pagamento" });
    return { ok: false, message: "Não foi possível abrir o pagamento agora. Nenhuma cobrança foi feita. Tente novamente em instantes." };
  }
  await db.from("orders").update({ payment_link_url: url }).eq("id", o.id);
  await db.from("payments").insert({ order_id: o.id, order_nsu: o.order_nsu, status: "link_created", amount_cents: o.total_cents });
  await sendOrderEmail(o.id, "order_received").catch(() => undefined);
  redirect(url);
}
