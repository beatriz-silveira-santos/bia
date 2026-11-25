export type LeadUnit = "calendar_days" | "business_days";

export function formatLeadTime(value: number, unit: LeadUnit | null | undefined): string {
  if (!unit) return `${value} dias (unidade a confirmar)`;
  const label = unit === "business_days" ? (value === 1 ? "dia útil" : "dias úteis") : value === 1 ? "dia corrido" : "dias corridos";
  return `${value} ${label}`;
}

export function preorderNotice(value: number, unit: LeadUnit | null | undefined): string {
  return `Produto sob encomenda. O pagamento é realizado integralmente no pedido e a postagem ocorrerá em até ${formatLeadTime(
    value,
    unit,
  )} após a confirmação do pagamento. O prazo de transporte começa após a postagem e é adicional.`;
}

export function preorderShort(value: number, unit: LeadUnit | null | undefined): string {
  return `Sob encomenda — pagamento antecipado. Postagem em até ${formatLeadTime(
    value,
    unit,
  )} após a confirmação do pagamento. O prazo de transporte é adicional e começa após a postagem.`;
}

/** Texto do aceite obrigatório no checkout; é salvo no pedido exatamente como exibido. */
export function preorderAckText(items: { name: string; value: number; unit: LeadUnit }[]): string {
  const list = items.map((i) => `${i.name} (postagem em até ${formatLeadTime(i.value, i.unit)})`).join("; ");
  return `Estou ciente de que estou comprando item(ns) sob encomenda: ${list}. O pagamento é integral e antecipado, e o prazo de postagem é contado a partir da confirmação do pagamento. O prazo de transporte é adicional e começa após a postagem. Por padrão, o pedido inteiro será enviado em uma única remessa quando todos os itens estiverem disponíveis, dentro do prazo de postagem informado. Este aceite não limita meus direitos de consumidora.`;
}

const SP_TZ = "America/Sao_Paulo";
export function formatDateSP(iso: string | Date | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SP_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}
