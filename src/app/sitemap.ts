import type { MetadataRoute } from "next";
import { supabasePublic } from "@/lib/supabase/server";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = supabasePublic();
  const [{ data: products }, { data: cats }, { data: brands }, { data: pages }] = await Promise.all([
    db.from("catalog_products").select("slug,created_at,published_at"),
    db.from("categories").select("slug"),
    db.from("brands").select("slug"),
    db.from("content_pages").select("slug,updated_at"),
  ]);
  const u = (p: string) => `${SITE.url}${p}`;
  return [
    { url: u("/"), changeFrequency: "daily", priority: 1 },
    { url: u("/instagram"), changeFrequency: "daily", priority: 0.8 },
    { url: u("/novidades"), changeFrequency: "daily" },
    { url: u("/marcas"), changeFrequency: "weekly" },
    ...(cats ?? []).map((c) => ({ url: u(`/categoria/${c.slug}`), changeFrequency: "daily" as const, priority: 0.8 })),
    ...(brands ?? []).map((b) => ({ url: u(`/marcas/${b.slug}`), changeFrequency: "weekly" as const })),
    ...(products ?? []).map((p) => ({ url: u(`/produto/${p.slug}`), lastModified: p.published_at ?? p.created_at, priority: 0.7 })),
    ...(pages ?? []).map((p) => ({ url: u(["sobre", "contato"].includes(p.slug) ? `/${p.slug}` : `/ajuda/${p.slug}`), lastModified: p.updated_at })),
  ];
}
