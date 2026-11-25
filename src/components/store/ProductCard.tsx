import Link from "next/link";
import type { CatalogProduct } from "@/lib/types";
import { AvailabilityBadge } from "./Availability";
import { Price } from "./Price";
import { ProductImage } from "./ProductImage";

export function volumeLabel(p: Pick<CatalogProduct, "volume_ml" | "is_decant">) {
  if (p.is_decant) return "Decante 5 ml";
  if (p.volume_ml == null) return null;
  return `${Number(p.volume_ml).toLocaleString("pt-BR")} ml`;
}

const HIGHLIGHT_LABEL: Record<string, string> = {
  new: "Lançamento", bestseller: "Mais vendido", recommended: "Recomendado", promo: "Promoção",
};

export function ProductCard({ product, priority = false, listName }: { product: CatalogProduct; priority?: boolean; listName?: string }) {
  const vol = volumeLabel(product);
  const highlight = product.highlights.find((h) => h !== "promo" || product.promo_price_cents != null);
  return (
    <article className="group relative flex flex-col">
      <Link
        href={`/produto/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-white ring-1 ring-line/60"
        data-list={listName}
      >
        <ProductImage path={product.cover_image} alt={product.cover_alt ?? product.name} sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" priority={priority} className="transition duration-500 group-hover:scale-[1.03]" />
        {highlight && (
          <span className="absolute left-3 top-3 rounded-full bg-porcelain/95 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-rose-gold-ink shadow-sm">
            {HIGHLIGHT_LABEL[highlight]}
          </span>
        )}
        {product.is_decant && (
          <span className="absolute bottom-3 left-3 rounded-full bg-ink px-2.5 py-1 text-[0.7rem] font-semibold text-ivory">Decante 5 ml</span>
        )}
      </Link>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        {product.brand_name && <p className="eyebrow !tracking-[0.18em]">{product.brand_name}</p>}
        <h3 className="font-sans text-[0.98rem] font-medium leading-snug text-ink">
          <Link href={`/produto/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <p className="text-sm text-ink-muted">
          {[vol, product.subcategory_name ?? product.category_name].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <Price price={product.price_cents} promo={product.promo_price_cents} size="sm" />
          <AvailabilityBadge state={product.sale_state} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, listName, priorityCount = 0 }: { products: CatalogProduct[]; listName?: string; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4" role="list">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} listName={listName} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
