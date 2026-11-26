"use client";
import { useActionState } from "react";
import { quoteCartShipping, type QuoteState } from "@/app/actions/shipping";
import { ShippingOptionList } from "./ShippingOptions";

export function CartQuote() {
  const [s, action, pending] = useActionState<QuoteState, FormData>(quoteCartShipping, null);
  return (
    <div className="space-y-3">
      <form action={action} className="flex gap-2">
        <label htmlFor="cep-cart" className="sr-only">CEP</label>
        <input id="cep-cart" name="cep" inputMode="numeric" autoComplete="postal-code" placeholder="Seu CEP" maxLength={9} className="field !py-2.5" defaultValue={s?.cep ?? ""} />
        <button className="btn-secondary !min-h-11 shrink-0" disabled={pending}>{pending ? "Calculando…" : "Calcular"}</button>
      </form>
      <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener noreferrer" className="text-xs text-ink-muted underline underline-offset-4">Não sei meu CEP</a>
      {s && !s.ok && <p role="alert" className="rounded-xl bg-warning-bg p-3 text-sm text-ink">{s.message}</p>}
      {s?.ok && s.options && (
        <div className="space-y-2" aria-live="polite">
          <ShippingOptionList options={s.options} />
          {s.carrierUnavailable && <p className="text-xs text-ink-muted">{s.carrierUnavailable}</p>}
          <p className="text-xs text-ink-muted">Você escolhe a forma de entrega no checkout.</p>
        </div>
      )}
    </div>
  );
}
