"use client";
import { formatBRL } from "@/lib/money";
import type { ShippingOption } from "@/lib/shipping/types";

export function transitLabel(o: ShippingOption) {
  if (o.note) return o.note;
  if (o.days_min == null) return "Prazo informado no atendimento";
  const d = o.days_min === o.days_max || o.days_max == null ? `${o.days_min}` : `${o.days_min} a ${o.days_max}`;
  return `Transporte estimado: ${d} ${o.days_max === 1 ? "dia útil" : "dias úteis"} após a postagem`;
}

export function ShippingOptionList({ options, name, value, onChange }: { options: ShippingOption[]; name?: string; value?: string; onChange?: (code: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Opções de entrega</legend>
      {options.map((o) => (
        <label key={o.code} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${value === o.code ? "border-ink bg-porcelain" : "border-line hover:border-line-strong"}`}>
          {name ? <input type="radio" name={name} value={o.code} checked={value === o.code} onChange={() => onChange?.(o.code)} className="mt-1 h-5 w-5 accent-ink" required /> : null}
          <span className="flex-1">
            <span className="flex justify-between gap-3 font-medium"><span>{o.label}</span><span>{o.price_cents === 0 ? "Sem custo" : formatBRL(o.price_cents)}</span></span>
            <span className="mt-0.5 block text-sm text-ink-muted">{transitLabel(o)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
