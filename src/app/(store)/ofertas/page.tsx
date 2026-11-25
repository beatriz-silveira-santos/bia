import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasActivePromotions } from "@/lib/catalog";
import { filtersFromSearchParams } from "@/lib/search-params";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CatalogListing } from "@/components/store/CatalogListing";

export const metadata: Metadata = { title: "Ofertas", alternates: { canonical: "/ofertas" } };

/** Só existe quando há campanha ativa configurada no painel. */
export default async function OffersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await hasActivePromotions())) notFound();
  const filters = { ...filtersFromSearchParams(await searchParams), highlight: "promo" as const };
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Ofertas" }]} />
      <h1 className="mb-10 mt-6 text-4xl sm:text-5xl">Ofertas</h1>
      <CatalogListing basePath="/ofertas" filters={filters} />
    </div>
  );
}
