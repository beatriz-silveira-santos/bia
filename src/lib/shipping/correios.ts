import "server-only";
import type { QuoteInput, ShippingOption, ShippingProvider } from "./types";
import { ShippingUnavailableError } from "./types";

/**
 * API oficial dos Correios (CWS). Exige contrato com os serviços 38202 (API Preços) e
 * 38210 (API Prazos) habilitados. Credenciais somente no servidor.
 * Docs: https://www.correios.com.br/atendimento/developers/manuais/manual-api-preco-1
 */
const BASE = "https://api.correios.com.br";
const SERVICE_NAMES: Record<string, string> = { "03220": "SEDEX", "03298": "PAC", "03158": "SEDEX 10", "03140": "SEDEX 12" };

let tokenCache: { token: string; exp: number } | null = null;

export function correiosProvider(cfg: { user: string; accessCode: string; postcard: string; contract?: string; services: string[] }): ShippingProvider {
  async function token(): Promise<string> {
    if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
    const res = await fetch(`${BASE}/token/v1/autentica/cartaopostagem`, {
      method: "POST",
      headers: { authorization: `Basic ${btoa(`${cfg.user}:${cfg.accessCode}`)}`, "content-type": "application/json" },
      body: JSON.stringify({ numero: cfg.postcard }),
    });
    if (!res.ok) throw new ShippingUnavailableError("provider_error", `token ${res.status}`);
    const j = (await res.json()) as { token: string; expiraEm?: string };
    tokenCache = { token: j.token, exp: j.expiraEm ? Date.parse(j.expiraEm) : Date.now() + 30 * 60_000 };
    return j.token;
  }
  const toCents = (s: string) => {
    const [r, c = "0"] = s.replace(/\./g, "").split(",");
    return Number.parseInt(r, 10) * 100 + Number.parseInt(c.padEnd(2, "0").slice(0, 2), 10);
  };

  return {
    name: "correios",
    async quote(input: QuoteInput): Promise<ShippingOption[]> {
      const t = await token();
      const headers = { authorization: `Bearer ${t}`, accept: "application/json" };
      const results = await Promise.all(
        cfg.services.map(async (svc): Promise<ShippingOption | null> => {
          const p = new URLSearchParams({
            cepOrigem: input.originCep,
            cepDestino: input.destinationCep,
            psObjeto: String(input.pkg.weight_g),
            tpObjeto: "2",
            comprimento: String(input.pkg.length_cm),
            largura: String(input.pkg.width_cm),
            altura: String(input.pkg.height_cm),
          });
          if (cfg.contract) p.set("nuContrato", cfg.contract);
          const [preco, prazo] = await Promise.all([
            fetch(`${BASE}/preco/v1/nacional/${svc}?${p}`, { headers }),
            fetch(`${BASE}/prazo/v1/nacional/${svc}?${new URLSearchParams({ cepOrigem: input.originCep, cepDestino: input.destinationCep })}`, { headers }),
          ]);
          if (!preco.ok) return null; // serviço indisponível para a rota
          const pj = (await preco.json()) as { pcFinal?: string; txErro?: string };
          if (!pj.pcFinal || pj.txErro) return null;
          const dj = prazo.ok ? ((await prazo.json()) as { prazoEntrega?: number }) : {};
          return {
            code: `correios:${svc}`,
            kind: "carrier",
            provider: "correios",
            service: svc,
            label: `Correios ${SERVICE_NAMES[svc] ?? svc}`,
            price_cents: toCents(pj.pcFinal),
            days_min: dj.prazoEntrega ?? null,
            days_max: dj.prazoEntrega ?? null,
          };
        }),
      );
      return results.filter((r): r is ShippingOption => r !== null);
    },
  };
}
