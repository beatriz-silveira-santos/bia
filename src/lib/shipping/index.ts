import "server-only";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { correiosProvider } from "./correios";
import { melhorEnvioProvider } from "./melhorenvio";
import { consolidatePackage, exceedsCarrierLimits, type ItemDims } from "./packaging";
import { ShippingUnavailableError, type ShippingOption, type ShippingProvider } from "./types";

export function getCarrierProvider(): ShippingProvider | null {
  const e = env();
  if (e.SHIPPING_PROVIDER === "correios" && e.CORREIOS_USER && e.CORREIOS_ACCESS_CODE && e.CORREIOS_POSTCARD) {
    return correiosProvider({ user: e.CORREIOS_USER, accessCode: e.CORREIOS_ACCESS_CODE, postcard: e.CORREIOS_POSTCARD, contract: e.CORREIOS_CONTRACT, services: e.CORREIOS_SERVICES.split(",").map((s) => s.trim()).filter(Boolean) });
  }
  if (e.SHIPPING_PROVIDER === "melhorenvio" && e.MELHORENVIO_TOKEN) {
    return melhorEnvioProvider({ token: e.MELHORENVIO_TOKEN, sandbox: e.MELHORENVIO_SANDBOX === "true", userAgent: e.MELHORENVIO_USER_AGENT });
  }
  return null; // sem provedor: frete aparece como indisponível (nunca valores inventados)
}

function cepInRanges(cep: string, ranges: { from: string; to: string }[]) {
  return ranges.some((r) => cep >= r.from && cep <= r.to);
}

export interface QuoteResult {
  options: ShippingOption[];
  package: ReturnType<typeof consolidatePackage>;
  carrierError: ShippingUnavailableError | null;
}

/** Cota transporte (provedor real), entrega local (regras do painel) e retirada (se ativada). */
export async function quoteShipping(params: { destinationCep: string; items: ItemDims[]; declaredValueCents: number }): Promise<QuoteResult> {
  const db = supabaseAdmin();
  const [{ data: settings }, { data: zones }] = await Promise.all([
    db.from("store_settings").select("origin_cep,pickup_enabled,pickup_instructions,free_shipping_enabled").eq("id", 1).single(),
    db.from("local_delivery_zones").select("id,name,cep_ranges,fee_cents,lead_time_text").eq("active", true).order("position"),
  ]);
  const options: ShippingOption[] = [];
  let carrierError: ShippingUnavailableError | null = null;
  const pkg = consolidatePackage(params.items);

  for (const z of zones ?? []) {
    if (cepInRanges(params.destinationCep, z.cep_ranges as { from: string; to: string }[])) {
      options.push({ code: `local:${z.id}`, kind: "local", provider: "local", service: z.id, label: `Entrega local — ${z.name}`, price_cents: z.fee_cents, days_min: null, days_max: null, note: z.lead_time_text });
      break;
    }
  }
  if (settings?.pickup_enabled) {
    options.push({ code: "pickup", kind: "pickup", provider: "pickup", service: "pickup", label: "Retirada presencial", price_cents: 0, days_min: null, days_max: null, note: settings.pickup_instructions ?? undefined });
  }

  const provider = getCarrierProvider();
  if (!pkg) carrierError = new ShippingUnavailableError("missing_dimensions");
  else if (exceedsCarrierLimits(pkg)) carrierError = new ShippingUnavailableError("no_options", "Pacote acima dos limites");
  else if (!provider) carrierError = new ShippingUnavailableError("not_configured");
  else {
    try {
      const carrier = await provider.quote({ originCep: settings!.origin_cep, destinationCep: params.destinationCep, pkg, declaredValueCents: params.declaredValueCents });
      if (!carrier.length) carrierError = new ShippingUnavailableError("no_options");
      options.push(...carrier.sort((a, b) => a.price_cents - b.price_cents));
    } catch (e) {
      carrierError = e instanceof ShippingUnavailableError ? e : new ShippingUnavailableError("provider_error");
    }
  }
  return { options, package: pkg, carrierError };
}
