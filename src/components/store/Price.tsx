import { formatBRL } from "@/lib/money";

export function Price({ price, promo, size = "md" }: { price: number; promo?: number | null; size?: "sm" | "md" | "lg" }) {
  const main = size === "lg" ? "text-3xl" : size === "md" ? "text-lg" : "text-base";
  if (promo != null && promo < price) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        <span className={`${main} font-semibold text-ink`}>
          <span className="sr-only">Preço promocional: </span>
          {formatBRL(promo)}
        </span>
        <s className="text-sm text-ink-muted">
          <span className="sr-only">Preço anterior: </span>
          {formatBRL(price)}
        </s>
      </span>
    );
  }
  return <span className={`${main} font-semibold text-ink`}>{formatBRL(price)}</span>;
}
