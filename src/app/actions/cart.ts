"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { ensureCartId } from "@/lib/cart";
import { supabaseServer } from "@/lib/supabase/server";

const addSchema = z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(20), returnTo: z.string().startsWith("/").max(200).default("/carrinho") });

export type CartActionState = { ok: boolean; message: string } | null;

export async function addToCart(_: CartActionState, form: FormData): Promise<CartActionState> {
  const parsed = addSchema.safeParse({ productId: form.get("productId"), quantity: form.get("quantity") ?? 1, returnTo: form.get("returnTo") ?? "/carrinho" });
  if (!parsed.success) return { ok: false, message: "Quantidade inválida." };
  const { productId, quantity } = parsed.data;
  const user = await getSessionUser();
  if (!user) {
    // Compra exige conta: após o login, o item é adicionado automaticamente
    redirect(`/entrar?next=${encodeURIComponent(`/carrinho/adicionar?p=${productId}&q=${quantity}`)}`);
  }
  return addForUser(user.id, productId, quantity);
}

export async function addForUser(userId: string, productId: string, quantity: number): Promise<CartActionState> {
  const supabase = await supabaseServer();
  const { data: product } = await supabase.from("catalog_products").select("id,name,sale_state,max_purchasable").eq("id", productId).maybeSingle();
  if (!product || product.sale_state === "sold_out") return { ok: false, message: "Este produto está indisponível no momento." };
  const cartId = await ensureCartId(userId);
  const { data: existing } = await supabase.from("cart_items").select("quantity").eq("cart_id", cartId).eq("product_id", productId).maybeSingle();
  const desired = (existing?.quantity ?? 0) + quantity;
  if (desired > product.max_purchasable) {
    return { ok: false, message: product.max_purchasable > 0 ? `Quantidade máxima disponível: ${product.max_purchasable}.` : "Este produto está indisponível no momento." };
  }
  const { error } = await supabase.from("cart_items").upsert({ cart_id: cartId, product_id: productId, quantity: desired }, { onConflict: "cart_id,product_id" });
  if (error) return { ok: false, message: "Não foi possível adicionar agora. Tente novamente." };
  await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
  revalidatePath("/", "layout");
  return { ok: true, message: product.sale_state === "preorder" ? "Encomenda adicionada ao carrinho." : "Produto adicionado ao carrinho." };
}

const updSchema = z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().min(0).max(20) });

export async function updateCartItem(form: FormData) {
  const parsed = updSchema.safeParse({ productId: form.get("productId"), quantity: form.get("quantity") });
  const user = await getSessionUser();
  if (!parsed.success || !user) return;
  const supabase = await supabaseServer();
  const cartId = await ensureCartId(user.id);
  if (parsed.data.quantity === 0) {
    await supabase.from("cart_items").delete().eq("cart_id", cartId).eq("product_id", parsed.data.productId);
  } else {
    const { data: p } = await supabase.from("catalog_products").select("max_purchasable").eq("id", parsed.data.productId).maybeSingle();
    const q = Math.min(parsed.data.quantity, Math.max(p?.max_purchasable ?? 0, 1));
    await supabase.from("cart_items").update({ quantity: q }).eq("cart_id", cartId).eq("product_id", parsed.data.productId);
  }
  await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
  revalidatePath("/", "layout");
}

export async function toggleFavorite(form: FormData) {
  const productId = z.string().uuid().safeParse(form.get("productId"));
  const returnTo = String(form.get("returnTo") ?? "/favoritos");
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(returnTo.startsWith("/") ? returnTo : "/favoritos")}`);
  if (!productId.success) return;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("favorites").select("product_id").eq("user_id", user.id).eq("product_id", productId.data).maybeSingle();
  if (data) await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", productId.data);
  else await supabase.from("favorites").insert({ user_id: user.id, product_id: productId.data });
  revalidatePath(returnTo.startsWith("/") ? returnTo : "/favoritos");
  revalidatePath("/favoritos");
}
