const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata centavos (inteiro) em reais. Nunca usar float para cálculo financeiro. */
export function formatBRL(cents: number | null | undefined): string {
  if (cents == null) return "—";
  if (!Number.isInteger(cents)) throw new Error("Valor monetário deve ser inteiro em centavos");
  return brl.format(cents / 100);
}

/** Converte "129,90" / "129.90" / "1.299,90" em centavos inteiros, sem ponto flutuante. */
export function parseBRLToCents(input: string): number | null {
  const s = input.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (!s) return null;
  let normalized = s;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  const m = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const reais = Number.parseInt(m[1], 10);
  const cents = Number.parseInt((m[2] ?? "0").padEnd(2, "0"), 10);
  return reais * 100 + cents;
}
