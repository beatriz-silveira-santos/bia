import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { toggleFavorite } from "@/app/actions/cart";
import { ProductCard } from "@/components/store/ProductCard";
import type { CatalogProduct } from "@/lib/types";

export const metadata: Metadata = { title: "Favoritos", robots: { index: false } };

export default async function FavoritesPage() {
  const user = await requireUser("/favoritos");
  const supabase = await supabaseServer();
  const { data: favs } = await supabase.from("favorites").select("product_id").eq("user_id", user.id).order("created_at", { ascending: false });
  const ids = (favs ?? []).map((f) => f.product_id);
  const { data: products } = ids.length ? await supabase.from("catalog_products").select("*").in("id", ids) : { data: [] };
  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="mb-8 text-4xl sm:text-5xl">Favoritos</h1>
      {!products?.length ? (
        <div className="card p-10 text-center"><p className="text-ink-soft">Você ainda não favoritou produtos.</p><Link href="/categoria/perfumes" className="btn-primary mt-6">Explorar produtos</Link></div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {(products as CatalogProduct[]).map((p) => (
            <li key={p.id} className="space-y-2">
              <ProductCard product={p} />
              <form action={toggleFavorite}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="returnTo" value="/favoritos" /><button className="relative z-10 text-sm text-ink-muted underline">Remover dos favoritos</button></form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
