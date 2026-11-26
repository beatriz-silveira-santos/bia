import type { Metadata } from "next";
import Link from "next/link";
import { getBrands, hasActivePromotions } from "@/lib/catalog";
import { IconChevron } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Categorias", alternates: { canonical: "/categorias" } };

const PERFUMES = [
  { label: "Femininos", href: "/categoria/perfumes-femininos", tone: "from-blush-100 to-blush-200" },
  { label: "Masculinos", href: "/categoria/perfumes-masculinos", tone: "from-champagne-soft to-champagne" },
  { label: "Árabes", href: "/categoria/perfumes-arabes", tone: "from-blush-50 to-champagne" },
  { label: "Decantes 5 ml", href: "/categoria/decantes-5-ml", tone: "from-blush-100 to-champagne-soft" },
  { label: "Infantis", href: "/categoria/perfumes-infantis", tone: "from-porcelain to-blush-100" },
  { label: "Todos os perfumes", href: "/categoria/perfumes", tone: "from-champagne-soft to-blush-100" },
];

/** Página pensada para o celular: tudo a um toque, em blocos grandes. */
export default async function CategoriesPage() {
  const [brands, promos] = await Promise.all([getBrands(), hasActivePromotions()]);
  const others = [
    { label: "Skincare", href: "/categoria/skincare" },
    { label: "Cabelos", href: "/categoria/cabelos" },
    { label: "Kits e Presentes", href: "/categoria/kits-e-presentes" },
    { label: "Novidades", href: "/novidades" },
    ...(promos ? [{ label: "Ofertas", href: "/ofertas" }] : []),
  ];
  return (
    <div className="container-page py-6 sm:py-12">
      <h1 className="text-4xl">Categorias</h1>

      <section aria-labelledby="cat-perfumes" className="mt-6">
        <h2 id="cat-perfumes" className="eyebrow mb-3">Perfumes</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PERFUMES.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className={`flex h-24 flex-col justify-between rounded-2xl bg-gradient-to-br ${c.tone} p-4 ring-1 ring-line transition active:scale-[0.97]`}>
                <span className="block h-px w-6 bg-rose-gold" aria-hidden />
                <span className="font-display text-xl leading-tight">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cat-outros" className="mt-8">
        <h2 id="cat-outros" className="eyebrow mb-1">Mais da loja</h2>
        <ul className="divide-y divide-line">
          {others.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="flex min-h-14 items-center justify-between text-lg active:bg-blush-50">
                {c.label} <IconChevron className="text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {brands.length > 0 && (
        <section aria-labelledby="cat-marcas" className="mt-8">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="cat-marcas" className="eyebrow">Marcas</h2>
            <Link href="/marcas" className="text-sm font-semibold underline decoration-rose-gold underline-offset-4">Ver todas</Link>
          </div>
          <ul className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <li key={b.id}>
                <Link href={`/marcas/${b.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-porcelain px-4 text-[0.95rem] active:bg-blush-100">{b.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
