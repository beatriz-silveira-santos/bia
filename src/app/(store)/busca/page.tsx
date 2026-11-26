import type { Metadata } from "next";
import { filtersFromSearchParams } from "@/lib/search-params";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CatalogListing } from "@/components/store/CatalogListing";
import { TrackView } from "@/components/store/TrackedLink";

export const metadata: Metadata = { title: "Buscar", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = filtersFromSearchParams(await searchParams);
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Busca" }]} />
      <h1 className="mb-6 mt-6 text-4xl sm:text-5xl">{filters.q ? <>Resultados para “{filters.q}”</> : "Buscar produtos"}</h1>
      <form action="/busca" role="search" className="mb-10 flex max-w-xl gap-2">
        <label htmlFor="q-page" className="sr-only">Buscar</label>
        <input id="q-page" name="q" type="search" defaultValue={filters.q} className="field" placeholder="Nome, marca, família olfativa…" autoFocus={!filters.q} />
        <button className="btn-primary shrink-0" type="submit">Buscar</button>
      </form>
      {filters.q && <TrackView event="search" searchTerm={filters.q} />}
      <CatalogListing basePath="/busca" filters={filters} hidden={filters.q ? { q: filters.q } : {}} />
    </div>
  );
}
