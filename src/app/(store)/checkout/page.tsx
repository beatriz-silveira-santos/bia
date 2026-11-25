import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCart, summarizeCart } from "@/lib/cart";
import { getStoreSettingsPublic } from "@/lib/catalog";
import { formatLeadTime, preorderAckText } from "@/lib/leadtime";
import { formatBRL } from "@/lib/money";
import { supabaseServer } from "@/lib/supabase/server";
import { whatsappLink } from "@/lib/whatsapp";
import { AvailabilityBadge, PreorderNotice } from "@/components/store/Availability";
import { CheckoutForm } from "@/components/store/CheckoutForm";
import type { AddressRow } from "@/components/store/AddressForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const supabase = await supabaseServer();
  const [lines, settings, { data: addresses }, { data: profile }] = await Promise.all([
    getCart(user.id),
    getStoreSettingsPublic(),
    supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!lines.length) redirect("/carrinho");
  const sum = summarizeCart(lines);
  if (sum.blocked.length) redirect("/carrinho");

  const ack = sum.hasPreorder
    ? preorderAckText(sum.preorderLines.map((l) => ({ name: l.product.name, value: l.product.preorder_lead_time_value, unit: l.product.preorder_lead_time_unit! })))
    : null;
  const methods = [settings?.payment_pix_enabled && "Pix", settings?.payment_credit_card_enabled && `cartão de crédito em até ${settings.max_installments}x`].filter(Boolean).join(" ou ");
  const paymentNote = `Pagamento por ${methods}. No parcelamento, os juros são informados pela InfinitePay antes da confirmação.`;

  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="mb-8 text-4xl sm:text-5xl">Checkout</h1>
      {!settings?.checkout_enabled && (
        <p role="alert" className="mb-8 rounded-2xl bg-warning-bg p-4">As compras pelo site ainda não foram liberadas. Você pode montar o carrinho e falar com a gente pelo WhatsApp.</p>
      )}
      <section aria-labelledby="h-itens" className="mb-10">
        <h2 id="h-itens" className="sr-only">Itens</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-porcelain">
          {lines.map(({ product: p, quantity }) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span><strong className="font-medium">{quantity}× {p.name}</strong>{p.sale_state === "preorder" && <span className="block text-sm text-ink-soft">Postagem em até {formatLeadTime(p.preorder_lead_time_value, p.preorder_lead_time_unit)} após a confirmação do pagamento</span>}</span>
              <span className="flex items-center gap-3"><AvailabilityBadge state={p.sale_state} />{formatBRL(p.effective_price_cents * quantity)}</span>
            </li>
          ))}
        </ul>
        {sum.hasPreorder && (
          <div className="mt-4 space-y-2">
            <PreorderNotice value={Math.max(...sum.preorderLines.map((l) => l.product.preorder_lead_time_value))} unit={sum.preorderLines[0].product.preorder_lead_time_unit} compact />
            {sum.mixed && <p className="text-sm text-ink-soft">Por padrão, todo o pedido (inclusive os itens de pronta entrega) será enviado em uma única remessa quando todos os itens estiverem disponíveis, dentro do prazo de postagem da encomenda.</p>}
          </div>
        )}
        {!sum.hasPreorder && <p className="mt-3 text-sm text-ink-soft">Preparação em até {settings?.preparation_business_days ?? 3} dias úteis após a confirmação do pagamento. O transporte é adicional.</p>}
      </section>
      <CheckoutForm
        addresses={(addresses ?? []) as AddressRow[]}
        defaultName={profile?.full_name ?? ""}
        subtotalCents={sum.subtotal}
        preorderAckText={ack}
        hasPreorder={sum.hasPreorder}
        paymentNote={paymentNote}
        whatsappHref={whatsappLink("Olá! Preciso de ajuda com o frete do meu pedido na Bia Store Importados.")}
      />
    </div>
  );
}
