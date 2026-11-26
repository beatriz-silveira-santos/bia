import type { ProductFilters, SortKey } from "@/lib/catalog";

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]).map((s) => s.slice(0, 60)).slice(0, 20);
const num = (v: string | string[] | undefined) => {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function filtersFromSearchParams(sp: SP): ProductFilters {
  const sort = (Array.isArray(sp.ordem) ? sp.ordem[0] : sp.ordem) as SortKey | undefined;
  const reais = (v: number | undefined) => (v == null ? undefined : v * 100);
  return {
    brand: arr(sp.marca),
    gender: arr(sp.genero).filter((g) => ["female", "male", "kids", "unisex"].includes(g)),
    volume: arr(sp.volume).map(Number).filter((n) => Number.isFinite(n) && n > 0),
    family: arr(sp.familia),
    productType: arr(sp.tipo),
    availability: arr(sp.disponibilidade).filter((a): a is "ready_stock" | "preorder" | "sold_out" => ["ready_stock", "preorder", "sold_out"].includes(a)),
    minPrice: reais(num(sp.min)),
    maxPrice: reais(num(sp.max)),
    q: (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 80) || undefined,
    sort: sort && ["price_asc", "price_desc", "newest", "featured"].includes(sort) ? sort : "price_asc",
    page: num(sp.pagina) ?? 1,
  };
}

export function hasActiveFilters(f: ProductFilters) {
  return Boolean(f.brand?.length || f.gender?.length || f.volume?.length || f.family?.length || f.productType?.length || f.availability?.length || f.minPrice != null || f.maxPrice != null);
}
