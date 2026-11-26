import "server-only";
import { cache } from "react";
import { supabasePublic } from "@/lib/supabase/server";
import type { Brand, CatalogProduct, Category } from "@/lib/types";

export type SortKey = "price_asc" | "price_desc" | "newest" | "featured";
export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "price_asc", label: "Menor preço" },
  { key: "price_desc", label: "Maior preço" },
  { key: "newest", label: "Mais recentes" },
  { key: "featured", label: "Destaques" },
];

export interface ProductFilters {
  category?: string; // slug (categoria-mãe ou subcategoria)
  brand?: string[]; // slugs
  gender?: string[];
  minPrice?: number; // centavos
  maxPrice?: number;
  volume?: number[];
  family?: string[];
  availability?: ("ready_stock" | "preorder" | "sold_out")[];
  productType?: string[];
  q?: string;
  highlight?: "new" | "bestseller" | "recommended" | "promo";
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const { data, error } = await supabasePublic()
    .from("categories")
    .select("id,parent_id,name,slug,description,image_path,seo_title,seo_description,position")
    .order("position");
  if (error) throw new Error("Falha ao carregar categorias");
  return data ?? [];
});

export const getBrands = cache(async (): Promise<Brand[]> => {
  const { data, error } = await supabasePublic().from("brands").select("id,name,slug").order("name");
  if (error) throw new Error("Falha ao carregar marcas");
  return data ?? [];
});

export async function getCategoryBySlug(slug: string) {
  const cats = await getCategories();
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) return null;
  const parent = cat.parent_id ? cats.find((c) => c.id === cat.parent_id) ?? null : null;
  const children = cats.filter((c) => c.parent_id === cat.id);
  return { category: cat, parent, children };
}

function escapeLike(s: string) {
  return s.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export function normalizeSearch(q: string) {
  return q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function listProducts(f: ProductFilters) {
  const pageSize = Math.min(f.pageSize ?? 24, 48);
  const page = Math.max(1, f.page ?? 1);
  let q = supabasePublic().from("catalog_products").select("*", { count: "exact" });

  if (f.category) {
    q = q.or(`category_slug.eq.${f.category},subcategory_slug.eq.${f.category}`);
  }
  if (f.brand?.length) q = q.in("brand_slug", f.brand);
  if (f.gender?.length) q = q.in("gender", f.gender);
  if (f.minPrice != null) q = q.gte("effective_price_cents", f.minPrice);
  if (f.maxPrice != null) q = q.lte("effective_price_cents", f.maxPrice);
  if (f.volume?.length) q = q.in("volume_ml", f.volume);
  if (f.family?.length) q = q.in("olfactory_family", f.family);
  if (f.productType?.length) q = q.in("product_type", f.productType);
  if (f.availability?.length) q = q.in("sale_state", f.availability);
  if (f.highlight) q = q.contains("highlights", [f.highlight]);
  if (f.q) {
    const terms = normalizeSearch(f.q).split(" ").filter(Boolean).slice(0, 5);
    for (const t of terms) {
      const like = `%${escapeLike(t)}%`;
      q = q.or(`search_text.ilike.${like},brand_slug.ilike.${like}`);
    }
  }

  switch (f.sort ?? "price_asc") {
    case "price_desc":
      q = q.order("effective_price_cents", { ascending: false });
      break;
    case "newest":
      q = q.order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      break;
    case "featured":
      // Somente destaques definidos pela administradora; desempate por menor preço
      q = q.order("highlights", { ascending: false }).order("effective_price_cents", { ascending: true });
      break;
    default:
      q = q.order("effective_price_cents", { ascending: true });
  }
  q = q.order("id").range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw new Error("Falha ao carregar produtos");
  return { products: (data ?? []) as CatalogProduct[], total: count ?? 0, page, pageSize };
}

export const getProductBySlug = cache(async (slug: string) => {
  const db = supabasePublic();
  const { data, error } = await db.from("catalog_products").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error("Falha ao carregar produto");
  if (!data) return null;
  const product = data as CatalogProduct;
  const [{ data: media }, { data: bundle }, { data: reviews }] = await Promise.all([
    db.from("product_images").select("id,kind,storage_path,alt_text,width,height,position").eq("product_id", product.id).order("position"),
    product.is_bundle
      ? db.from("bundle_items").select("quantity, component:catalog_products!inner(id,slug,name,brand_name,volume_ml)").eq("bundle_product_id", product.id)
      : Promise.resolve({ data: [] }),
    db.from("reviews").select("id,rating,comment,author_display_name,verified_purchase,created_at").eq("product_id", product.id).eq("status", "approved").order("created_at", { ascending: false }).limit(20),
  ]);
  return { product, media: media ?? [], bundle: bundle ?? [], reviews: reviews ?? [] };
});

export async function getRelatedProducts(p: CatalogProduct, limit = 4) {
  const { data } = await supabasePublic()
    .from("catalog_products")
    .select("*")
    .neq("id", p.id)
    .or(`category_id.eq.${p.category_id}${p.brand_id ? `,brand_id.eq.${p.brand_id}` : ""}`)
    .neq("sale_state", "sold_out")
    .order("effective_price_cents")
    .limit(limit);
  return (data ?? []) as CatalogProduct[];
}

/** Valores distintos para montar filtros a partir do que está realmente cadastrado. */
export async function getFacetValues(categorySlug?: string) {
  let q = supabasePublic().from("catalog_products").select("brand_slug,brand_name,gender,volume_ml,olfactory_family,product_type,sale_state,effective_price_cents");
  if (categorySlug) q = q.or(`category_slug.eq.${categorySlug},subcategory_slug.eq.${categorySlug}`);
  const { data } = await q.limit(1000);
  const rows = data ?? [];
  const uniq = <T,>(arr: (T | null | undefined)[]) => [...new Set(arr.filter((v): v is T => v != null && v !== ""))];
  const brands = new Map<string, string>();
  rows.forEach((r) => r.brand_slug && brands.set(r.brand_slug, r.brand_name));
  return {
    brands: [...brands.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
    genders: uniq<string>(rows.map((r) => r.gender)).filter((g) => g !== "not_applicable"),
    volumes: uniq<number>(rows.map((r) => (r.volume_ml != null ? Number(r.volume_ml) : null))).sort((a, b) => a - b),
    families: uniq<string>(rows.map((r) => r.olfactory_family)).sort(),
    productTypes: uniq<string>(rows.map((r) => r.product_type)).sort(),
    availability: uniq<string>(rows.map((r) => r.sale_state)),
  };
}

export async function getStoreSettingsPublic() {
  const { data } = await supabasePublic().from("store_settings").select("*").eq("id", 1).maybeSingle();
  return data as null | {
    store_name: string;
    contact_email: string | null;
    business_hours: string | null;
    whatsapp_e164: string;
    instagram_handle: string;
    public_address_line: string | null;
    public_address_city: string | null;
    public_address_state: string | null;
    public_address_cep: string | null;
    address_publication_authorized: boolean;
    legal_name: string | null;
    document_id: string | null;
    preparation_business_days: number;
    preorder_default_lead_time_value: number;
    preorder_default_lead_time_unit: "calendar_days" | "business_days" | null;
    payment_pix_enabled: boolean;
    payment_credit_card_enabled: boolean;
    max_installments: number;
    checkout_enabled: boolean;
    pickup_enabled: boolean;
    logo_path: string | null;
    hero_image_path: string | null;
    hero_image_alt: string | null;
    about_text: string | null;
  };
}

export async function hasActivePromotions() {
  const { count } = await supabasePublic()
    .from("catalog_products")
    .select("id", { count: "exact", head: true })
    .contains("highlights", ["promo"])
    .not("promo_price_cents", "is", null)
    .neq("sale_state", "sold_out");
  return (count ?? 0) > 0;
}
