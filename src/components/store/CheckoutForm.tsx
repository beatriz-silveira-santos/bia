"use client";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeOrder, type CheckoutState } from "@/app/actions/checkout";
import { quoteCartShipping, type QuoteState } from "@/app/actions/shipping";
import { formatBRL } from "@/lib/money";
import { track } from "@/lib/analytics/client";
import { IconLock } from "@/components/ui/icons";
import { AddressForm, type AddressRow } from "./AddressForm";
import { ShippingOptionList } from "./ShippingOptions";

export function CheckoutForm({
  addresses, defaultName, subtotalCents, preorderAckText, hasPreorder, paymentNote, whatsappHref,
}: { addresses: AddressRow[]; defaultName: string; subtotalCents: number; preorderAckText: string | null; hasPreorder: boolean; paymentNote: string; whatsappHref: string }) {
  const router = useRouter();
  const [addressId, setAddressId] = useState<string | undefined>(addresses[0]?.id);
  const [showNew, setShowNew] = useState(addresses.length === 0);
  const [quote, setQuote] = useState<QuoteState>(null);
  const [option, setOption] = useState<string>();
  const [quoting, startQuote] = useTransition();
  const [s, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, null);

  const selected = addresses.find((a) => a.id === addressId);
  const requote = useCallback((cep: string) => {
    startQuote(async () => {
      const fd = new FormData();
      fd.set("cep", cep);
      const r = await quoteCartShipping(null, fd);
      setQuote(r);
      setOption(r?.options?.[0]?.code);
    });
  }, []);
  useEffect(() => {
    if (selected) requote(selected.cep);
  }, [selected, requote]);
  useEffect(() => track("begin_checkout", { value_cents: subtotalCents }), [subtotalCents]);

  const opt = quote?.options?.find((o) => o.code === option);
  const total = subtotalCents + (opt?.price_cents ?? 0);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
      <div className="space-y-10">
        <section aria-labelledby="h-end">
          <h2 id="h-end" className="mb-4 text-2xl">1. Endereço de entrega</h2>
          {addresses.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="sr-only">Escolha o endereço</legend>
              {addresses.map((a) => (
                <label key={a.id} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${addressId === a.id ? "border-ink bg-porcelain" : "border-line"}`}>
                  <input type="radio" name="addr" checked={addressId === a.id} onChange={() => { setAddressId(a.id); setShowNew(false); }} className="mt-1 h-5 w-5 accent-ink" />
                  <span className="text-sm">
                    <strong className="block text-base">{a.label ?? a.recipient_name}</strong>
                    {a.street}, {a.number}{a.complement ? ` — ${a.complement}` : ""} · {a.neighborhood} · {a.city}/{a.state} · CEP {a.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {showNew ? (
            <div className="card mt-4 p-5">
              <AddressForm defaultName={defaultName} onSaved={(id) => { setAddressId(id); setShowNew(false); router.refresh(); }} />
            </div>
          ) : (
            <button type="button" className="mt-3 text-sm font-semibold underline underline-offset-4" onClick={() => setShowNew(true)}>+ Adicionar novo endereço</button>
          )}
        </section>

        <section aria-labelledby="h-frete" aria-busy={quoting}>
          <h2 id="h-frete" className="mb-4 text-2xl">2. Entrega</h2>
          {!selected && <p className="text-ink-muted">Escolha ou cadastre um endereço para ver as opções.</p>}
          {quoting && <p role="status" className="text-ink-muted">Calculando frete…</p>}
          {!quoting && quote && !quote.ok && (
            <div role="alert" className="space-y-3 rounded-2xl bg-warning-bg p-4 text-sm">
              <p>{quote.message}</p>
              <div className="flex gap-2">
                {selected && <button type="button" className="btn-secondary !min-h-10" onClick={() => requote(selected.cep)}>Tentar novamente</button>}
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-whatsapp !min-h-10">Falar no WhatsApp</a>
              </div>
            </div>
          )}
          {!quoting && quote?.ok && quote.options && (
            <>
              <ShippingOptionList options={quote.options} name="shipping" value={option} onChange={setOption} />
              {quote.carrierUnavailable && <p className="mt-2 text-xs text-ink-muted">{quote.carrierUnavailable}</p>}
            </>
          )}
        </section>

        {hasPreorder && preorderAckText && (
          <section aria-labelledby="h-enc">
            <h2 id="h-enc" className="mb-4 text-2xl">3. Ciência do prazo da encomenda</h2>
            <label className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-bg p-4 text-sm">
              <input type="checkbox" name="preorderAck" form="checkout-form" required className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
              <span>{preorderAckText}</span>
            </label>
          </section>
        )}
      </div>

      <aside className="lg:sticky lg:top-36 lg:self-start" aria-label="Resumo do pedido">
        <form id="checkout-form" action={action} className="card space-y-4 p-6">
          <input type="hidden" name="addressId" value={opt?.kind === "pickup" ? "" : addressId ?? ""} />
          <input type="hidden" name="quoteId" value={quote?.quoteId ?? ""} />
          <input type="hidden" name="optionCode" value={option ?? ""} />
          <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(subtotalCents)}</span></div>
          <div className="flex justify-between"><span>Frete</span><span>{opt ? (opt.price_cents ? formatBRL(opt.price_cents) : "Sem custo") : "—"}</span></div>
          <div>
            <label htmlFor="coupon" className="label">Cupom (opcional)</label>
            <input id="coupon" name="coupon" className="field !py-2.5 uppercase" autoComplete="off" />
            <p className="mt-1 text-xs text-ink-muted">O desconto é validado ao confirmar e aparece no valor final do pagamento.</p>
          </div>
          <div className="flex justify-between border-t border-line pt-4 text-lg"><strong>Total</strong><strong>{formatBRL(total)}</strong></div>
          <p className="text-xs text-ink-muted">{paymentNote}</p>
          {s && !s.ok && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{s.message}</p>}
          <button className="btn-primary w-full" disabled={pending || !quote?.ok || !option || (!addressId && opt?.kind !== "pickup")}>
            <IconLock width={18} height={18} /> {pending ? "Gerando pagamento…" : "Ir para o pagamento"}
          </button>
          <p className="text-center text-xs text-ink-muted">Você será redirecionada para o ambiente seguro da InfinitePay para pagar. O pedido só é confirmado após a aprovação do pagamento.</p>
        </form>
      </aside>
    </div>
  );
}
