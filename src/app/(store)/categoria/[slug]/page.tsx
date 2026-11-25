import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/catalog";
import { filtersFromSearchParams } from "@/lib/search-params";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CatalogListing } from "@/components/store/CatalogListing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryBySlug(slug);
  if (!data) return {};
  const c = data.category;
  return {
    title: c.seo_title ?? c.name,
    description: c.seo_description ?? `${c.name} na Bia Store Importados. Veja preços, disponibilidade e prazos.`,
    alternates: { canonical: `/categoria/${c.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const data = await getCategoryBySlug(slug);
  if (!data) notFound();
  const { category, parent, children } = data;
  const filters = { ...filtersFromSearchParams(await searchParams), category: category.slug };
  const crumbs = [...(parent ? [{ label: parent.name, href: `/categoria/${parent.slug}` }] : []), { label: category.name }];

  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={crumbs} />
      <header className="mb-8 mt-6 sm:mb-12">
        <h1 className="text-4xl sm:text-5xl">{category.name}</h1>
        {category.description && <p className="mt-3 max-w-2xl text-ink-soft">{category.description}</p>}
        {children.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Subcategorias">
            {children.map((c) => (
              <li key={c.id}>
                <Link href={`/categoria/${c.slug}`} className="inline-flex min-h-10 items-center rounded-full border border-line-strong px-4 text-sm hover:border-ink">{c.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </header>
      <CatalogListing basePath={`/categoria/${category.slug}`} filters={filters} facetCategory={category.slug} />
    </div>
  );
}
