import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrands } from "@/lib/catalog";
import { filtersFromSearchParams } from "@/lib/search-params";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CatalogListing } from "@/components/store/CatalogListing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = (await getBrands()).find((b) => b.slug === slug);
  return brand ? { title: brand.name, alternates: { canonical: `/marcas/${slug}` } } : {};
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const brand = (await getBrands()).find((b) => b.slug === slug);
  if (!brand) notFound();
  const filters = { ...filtersFromSearchParams(await searchParams), brand: [slug] };
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Marcas", href: "/marcas" }, { label: brand.name }]} />
      <h1 className="mb-10 mt-6 text-4xl sm:text-5xl">{brand.name}</h1>
      <CatalogListing basePath={`/marcas/${slug}`} filters={filters} />
    </div>
  );
}
