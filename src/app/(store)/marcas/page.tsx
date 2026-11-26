import type { Metadata } from "next";
import Link from "next/link";
import { getBrands } from "@/lib/catalog";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = { title: "Marcas", alternates: { canonical: "/marcas" } };

export default async function BrandsPage() {
  const brands = await getBrands();
  const groups = brands.reduce<Record<string, typeof brands>>((acc, b) => {
    const k = b.name[0].toUpperCase();
    (acc[k] ??= []).push(b);
    return acc;
  }, {});
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Marcas" }]} />
      <h1 className="mb-10 mt-6 text-4xl sm:text-5xl">Marcas</h1>
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(groups).map(([letter, list]) => (
          <section key={letter} aria-labelledby={`l-${letter}`}>
            <h2 id={`l-${letter}`} className="mb-3 font-display text-3xl text-rose-gold-ink">{letter}</h2>
            <ul className="space-y-1">
              {list.map((b) => (
                <li key={b.id}><Link href={`/marcas/${b.slug}`} className="flex min-h-10 items-center text-ink-soft hover:text-ink">{b.name}</Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
