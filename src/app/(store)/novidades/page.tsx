import type { Metadata } from "next";
import { filtersFromSearchParams } from "@/lib/search-params";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CatalogListing } from "@/components/store/CatalogListing";

export const metadata: Metadata = { title: "Novidades", alternates: { canonical: "/novidades" } };

export default async function NewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = { ...filtersFromSearchParams(sp), sort: (sp.ordem ? filtersFromSearchParams(sp).sort : "newest") as "newest" };
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Novidades" }]} />
      <h1 className="mb-10 mt-6 text-4xl sm:text-5xl">Novidades</h1>
      <CatalogListing basePath="/novidades" filters={filters} />
    </div>
  );
}
