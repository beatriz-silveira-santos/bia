export interface PackageSpec {
  weight_g: number;
  width_cm: number;
  height_cm: number;
  length_cm: number;
}

export interface ShippingOption {
  code: string; // identificador estável dentro da cotação (ex.: "correios:03220")
  kind: "carrier" | "local" | "pickup";
  provider: string; // correios | melhorenvio | local | pickup
  service: string;
  label: string;
  price_cents: number;
  days_min: number | null; // prazo estimado de TRANSPORTE (não inclui preparação/postagem)
  days_max: number | null;
  note?: string;
}

export interface QuoteInput {
  originCep: string;
  destinationCep: string;
  pkg: PackageSpec;
  declaredValueCents: number;
}

export interface ShippingProvider {
  name: string;
  quote(input: QuoteInput): Promise<ShippingOption[]>;
}

export class ShippingUnavailableError extends Error {
  constructor(public reason: "not_configured" | "provider_error" | "no_options" | "missing_dimensions" | "invalid_cep", message?: string) {
    super(message ?? reason);
  }
}
