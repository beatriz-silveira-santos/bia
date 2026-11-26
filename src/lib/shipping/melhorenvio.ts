import "server-only";
import type { QuoteInput, ShippingOption, ShippingProvider } from "./types";
import { ShippingUnavailableError } from "./types";

/**
 * Melhor Envio (agregador). Usa o endpoint oficial de cálculo de frete.
 * As tarifas são as da plataforma (podem diferir das tarifas diretas dos Correios).
 * Docs: https://docs.melhorenvio.com.br/
 */
export function melhorEnvioProvider(cfg: { token: string; sandbox: boolean; userAgent: string }): ShippingProvider {
  const base = cfg.sandbox ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br";
  return {
    name: "melhorenvio",
    async quote(input: QuoteInput): Promise<ShippingOption[]> {
      const res = await fetch(`${base}/api/v2/me/shipment/calculate`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${cfg.token}`,
          "user-agent": cfg.userAgent,
        },
        body: JSON.stringify({
          from: { postal_code: input.originCep },
          to: { postal_code: input.destinationCep },
          package: {
            weight: input.pkg.weight_g / 1000,
            width: input.pkg.width_cm,
            height: input.pkg.height_cm,
            length: input.pkg.length_cm,
          },
          options: { insurance_value: input.declaredValueCents / 100, receipt: false, own_hand: false },
        }),
      });
      if (!res.ok) throw new ShippingUnavailableError("provider_error", `melhorenvio ${res.status}`);
      const list = (await res.json()) as {
        id: number; name: string; price?: string; custom_price?: string; error?: string;
        delivery_range?: { min: number; max: number }; custom_delivery_range?: { min: number; max: number };
        company?: { name: string };
      }[];
      return list
        .filter((o) => !o.error && (o.custom_price ?? o.price))
        .map((o) => {
          const price = o.custom_price ?? o.price!;
          const [r, c = "0"] = price.split(".");
          const range = o.custom_delivery_range ?? o.delivery_range;
          return {
            code: `melhorenvio:${o.id}`,
            kind: "carrier" as const,
            provider: "melhorenvio",
            service: String(o.id),
            label: `${o.company?.name ?? ""} ${o.name}`.trim(),
            price_cents: Number.parseInt(r, 10) * 100 + Number.parseInt(c.padEnd(2, "0").slice(0, 2), 10),
            days_min: range?.min ?? null,
            days_max: range?.max ?? null,
          };
        });
    },
  };
}
