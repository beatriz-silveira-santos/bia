import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { CatalogProduct } from "@/lib/types";

export interface CartLine {
  product: CatalogProduct;
  quantity: number;
}

export async function getCartCount(userId: string | null): Promise<number> {
  if (!userId) return 0;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("carts").select("cart_items(quantity)").eq("user_id", userId).maybeSingle();
  const items = (data?.cart_items ?? []) as { quantity: number }[];
  return items.reduce((s, i) => s + i.quantity, 0);
}

/** Carrinho com dados de catálogo atuais (preço e disponibilidade vêm do banco, nunca do navegador). */
export async function getCart(userId: string): Promise<CartLine[]> {
  const supabase = await supabaseServer();
  const { data: cart } = await supabase.from("carts").select("id, cart_items(product_id, quantity, added_at)").eq("user_id", userId).maybeSingle();
  const items = ((cart?.cart_items ?? []) as { product_id: string; quantity: number; added_at: string }[]).sort((a, b) => a.added_at.localeCompare(b.added_at));
  if (!items.length) return [];
  const { data: products } = await supabase.from("catalog_products").select("*").in("id", items.map((i) => i.product_id));
  const map = new Map((products ?? []).map((p) => [p.id, p as CatalogProduct]));
  return items.filter((i) => map.has(i.product_id)).map((i) => ({ product: map.get(i.product_id)!, quantity: i.quantity }));
}

export async function ensureCartId(userId: string): Promise<string> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
  if (data?.id) return data.id;
  const { data: created, error } = await supabase.from("carts").insert({ user_id: userId }).select("id").single();
  if (error || !created) {
    const { data: again } = await supabase.from("carts").select("id").eq("user_id", userId).single();
    if (!again) throw new Error("Não foi possível criar o carrinho");
    return again.id;
  }
  return created.id;
}

export function summarizeCart(lines: CartLine[]) {
  const subtotal = lines.reduce((s, l) => s + l.product.effective_price_cents * l.quantity, 0);
  const preorderLines = lines.filter((l) => l.product.sale_state === "preorder");
  const readyLines = lines.filter((l) => l.product.sale_state === "ready_stock");
  const blocked = lines.filter((l) => l.product.sale_state === "sold_out" || l.quantity > l.product.max_purchasable);
  return { subtotal, preorderLines, readyLines, blocked, hasPreorder: preorderLines.length > 0, mixed: preorderLines.length > 0 && readyLines.length > 0 };
}
