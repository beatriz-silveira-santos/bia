import { IconCheck, IconClock, IconClose } from "@/components/ui/icons";
import { formatLeadTime, type LeadUnit } from "@/lib/leadtime";
import type { SaleState } from "@/lib/types";

/** Disponibilidade sempre com texto + ícone (nunca só cor). */
export function AvailabilityBadge({ state, size = "sm" }: { state: SaleState; size?: "sm" | "md" }) {
  const cls = size === "md" ? "px-3 py-1.5 text-[0.8rem]" : "px-2.5 py-1 text-[0.7rem]";
  if (state === "ready_stock")
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-success-bg font-semibold text-success ${cls}`}>
        <IconCheck width={14} height={14} /> Pronta entrega
      </span>
    );
  if (state === "preorder")
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-warning-bg font-semibold text-warning ${cls}`}>
        <IconClock width={14} height={14} /> Sob encomenda
      </span>
    );
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-line font-semibold text-ink-soft ${cls}`}>
      <IconClose width={14} height={14} /> Esgotado
    </span>
  );
}

export function PreorderNotice({ value, unit, compact = false }: { value: number; unit: LeadUnit | null; compact?: boolean }) {
  return (
    <div role="note" className={`flex gap-3 rounded-2xl border border-warning/30 bg-warning-bg text-ink ${compact ? "p-3 text-sm" : "p-4"}`}>
      <IconClock className="mt-0.5 shrink-0 text-warning" />
      <p>
        <strong className="font-semibold">Produto sob encomenda.</strong> O pagamento é realizado integralmente no pedido e a
        postagem ocorrerá em até <strong>{formatLeadTime(value, unit)}</strong> após a confirmação do pagamento. O prazo de
        transporte começa após a postagem e é adicional.
      </p>
    </div>
  );
}
