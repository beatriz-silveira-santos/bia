import Link from "next/link";
import { getFacetValues, listProducts, SORT_OPTIONS, type ProductFilters } from "@/lib/catalog";
import { hasActiveFilters } from "@/lib/search-params";
import { GENDER_LABEL, type Gender } from "@/lib/types";
import { ProductGrid } from "./ProductCard";

const AVAIL_LABEL = { ready_stock: "Pronta entrega", preorder: "Sob encomenda", sold_out: "Esgotado" } as const;

/**
 * Listagem com filtros por formulário GET (funciona sem JavaScript, acessível por teclado
 * e gera URLs compartilháveis). Facetas vêm apenas do que está cadastrado.
 */
export async function CatalogListing({ basePath, filters, facetCategory, hidden = {} }: { basePath: string; filters: ProductFilters; facetCategory?: string; hidden?: Record<string, string> }) {
  const [{ products, total, page, pageSize }, facets] = await Promise.all([listProducts(filters), getFacetValues(facetCategory)]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const active = hasActiveFilters(filters);

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(hidden).forEach(([k, v]) => sp.set(k, v));
    filters.brand?.forEach((v) => sp.append("marca", v));
    filters.gender?.forEach((v) => sp.append("genero", v));
    filters.volume?.forEach((v) => sp.append("volume", String(v)));
    filters.family?.forEach((v) => sp.append("familia", v));
    filters.productType?.forEach((v) => sp.append("tipo", v));
    filters.availability?.forEach((v) => sp.append("disponibilidade", v));
    if (filters.minPrice != null) sp.set("min", String(filters.minPrice / 100));
    if (filters.maxPrice != null) sp.set("max", String(filters.maxPrice / 100));
    if (filters.sort && filters.sort !== "price_asc") sp.set("ordem", filters.sort);
    if (p > 1) sp.set("pagina", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const Check = ({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) => (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-ink-soft">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="h-5 w-5 accent-ink" />
      {label}
    </label>
  );

  const filterForm = (
    <form action={basePath} method="get" className="space-y-6" aria-label="Filtrar produtos">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div>
        <label htmlFor="ordem" className="label">Ordenar por</label>
        <select id="ordem" name="ordem" defaultValue={filters.sort ?? "price_asc"} className="field !py-2.5">
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      {facets.availability.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Disponibilidade</legend>
          {(["ready_stock", "preorder", "sold_out"] as const).filter((a) => facets.availability.includes(a)).map((a) => (
            <Check key={a} name="disponibilidade" value={a} label={AVAIL_LABEL[a]} checked={!!filters.availability?.includes(a)} />
          ))}
        </fieldset>
      )}
      {facets.brands.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Marca</legend>
          <div className="max-h-56 overflow-y-auto pr-2">
            {facets.brands.map((b) => <Check key={b.slug} name="marca" value={b.slug} label={b.name} checked={!!filters.brand?.includes(b.slug)} />)}
          </div>
        </fieldset>
      )}
      {facets.genders.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Para quem</legend>
          {facets.genders.map((g) => <Check key={g} name="genero" value={g} label={GENDER_LABEL[g as Gender]} checked={!!filters.gender?.includes(g)} />)}
        </fieldset>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Faixa de preço (R$)</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="min">Preço mínimo</label>
          <input id="min" name="min" inputMode="numeric" pattern="[0-9]*" placeholder="Mín." defaultValue={filters.minPrice != null ? filters.minPrice / 100 : ""} className="field !py-2" />
          <span aria-hidden>–</span>
          <label className="sr-only" htmlFor="max">Preço máximo</label>
          <input id="max" name="max" inputMode="numeric" pattern="[0-9]*" placeholder="Máx." defaultValue={filters.maxPrice != null ? filters.maxPrice / 100 : ""} className="field !py-2" />
        </div>
      </fieldset>
      {facets.volumes.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Volume</legend>
          <div className="grid grid-cols-2">
            {facets.volumes.map((v) => <Check key={v} name="volume" value={String(v)} label={`${v.toLocaleString("pt-BR")} ml`} checked={!!filters.volume?.includes(v)} />)}
          </div>
        </fieldset>
      )}
      {facets.families.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Família olfativa</legend>
          {facets.families.map((f) => <Check key={f} name="familia" value={f} label={f} checked={!!filters.family?.includes(f)} />)}
        </fieldset>
      )}
      {facets.productTypes.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Tipo de produto</legend>
          {facets.productTypes.map((t) => <Check key={t} name="tipo" value={t} label={t} checked={!!filters.productType?.includes(t)} />)}
        </fieldset>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 !min-h-11">Aplicar</button>
        {active && <Link href={basePath + (hidden.q ? `?q=${encodeURIComponent(hidden.q)}` : "")} className="btn-secondary !min-h-11">Limpar</Link>}
      </div>
    </form>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-12">
      <aside className="lg:sticky lg:top-36 lg:self-start">
        <details className="card group p-5 lg:hidden">
          <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between font-semibold">
            Filtrar e ordenar {active && <span className="rounded-full bg-ink px-2 py-0.5 text-xs text-ivory">ativos</span>}
          </summary>
          <div className="mt-5">{filterForm}</div>
        </details>
        <div className="hidden lg:block">{filterForm}</div>
      </aside>
      <div>
        <p className="mb-5 text-sm text-ink-muted" role="status" aria-live="polite">
          {total === 1 ? "1 produto encontrado" : `${total} produtos encontrados`}
        </p>
        {products.length ? (
          <ProductGrid products={products} listName={basePath} priorityCount={4} />
        ) : (
          <div className="card p-10 text-center">
            <p className="font-display text-2xl">Nenhum produto por aqui ainda</p>
            <p className="mt-2 text-ink-soft">{active ? "Tente remover alguns filtros." : "Novos produtos serão cadastrados em breve."}</p>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Paginação" className="mt-12 flex items-center justify-center gap-2">
            {page > 1 && <Link className="btn-secondary !min-h-11" href={pageHref(page - 1)} rel="prev">Anterior</Link>}
            <span className="px-4 text-sm text-ink-soft">Página {page} de {pages}</span>
            {page < pages && <Link className="btn-secondary !min-h-11" href={pageHref(page + 1)} rel="next">Próxima</Link>}
          </nav>
        )}
      </div>
    </div>
  );
}
