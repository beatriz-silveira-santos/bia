import Link from "next/link";
import type { CatalogProduct } from "@/lib/types";
import { ProductCard } from "./ProductCard";

/** Vitrine horizontal (rolagem no celular, grade no desktop). Oculta quando não há produtos. */
export function Shelf({ eyebrow, title, href, products, listName }: { eyebrow?: string; title: string; href: string; products: CatalogProduct[]; listName: string }) {
  if (!products.length) return null;
  return (
    <section className="container-page py-10 sm:py-14" aria-labelledby={`shelf-${listName}`}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h2 id={`shelf-${listName}`} className="text-3xl sm:text-4xl">{title}</h2>
        </div>
        <Link href={href} className="shrink-0 text-sm font-semibold text-ink underline decoration-rose-gold underline-offset-[6px] hover:decoration-ink">
          Ver tudo
        </Link>
      </div>
      <ul role="list" className="relative -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {products.slice(0, 8).map((p) => (
          <li key={p.id} className="w-[62vw] max-w-[260px] shrink-0 snap-start sm:w-auto sm:max-w-none">
            <ProductCard product={p} listName={listName} />
          </li>
        ))}
      </ul>
    </section>
  );
}
