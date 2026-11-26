import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

/**
 * Chaves do Supabase LOCAL. Nunca ficam no repositório: vêm de variáveis de ambiente
 * ou, se ausentes, de `supabase status -o env` (ambiente local criado por `supabase start`).
 */
function localStatus(): Record<string, string> {
  try {
    const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return Object.fromEntries(
      out.split("\n").map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
    );
  } catch {
    return {};
  }
}
const st: Record<string, string> = process.env.TEST_SUPABASE_SECRET_KEY && process.env.TEST_SUPABASE_ANON_KEY ? {} : localStatus();
export const URL = process.env.TEST_SUPABASE_URL ?? st.API_URL ?? "http://127.0.0.1:54321";
export const ANON = process.env.TEST_SUPABASE_ANON_KEY ?? st.PUBLISHABLE_KEY ?? "";
export const SECRET = process.env.TEST_SUPABASE_SECRET_KEY ?? st.SECRET_KEY ?? "";

export const service = () => createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
export const anon = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

export async function dbAvailable() {
  let ok = false;
  if (ANON && SECRET) {
    try {
      const r = await fetch(`${URL}/rest/v1/`, { headers: { apikey: ANON } });
      ok = r.status < 500;
    } catch {
      ok = false;
    }
  }
  // Na CI os testes de banco são obrigatórios: nunca pular em silêncio
  if (!ok && process.env.REQUIRE_DB_TESTS === "1") throw new Error("Supabase local indisponível para os testes de banco");
  return ok;
}

let n = 0;
export async function makeUser(prefix = "cliente"): Promise<{ id: string; email: string; client: SupabaseClient }> {
  const email = `${prefix}-${Date.now()}-${n++}@teste.local`;
  const password = "senha-de-teste-123";
  const { data, error } = await service().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Teste ${prefix}` } });
  if (error || !data.user) throw error;
  const client = anon();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, email, client };
}

export async function categoryId(slug: string) {
  const { data } = await service().from("categories").select("id").eq("slug", slug).single();
  return data!.id as string;
}

let p = 0;
export async function makeProduct(over: Record<string, unknown> = {}) {
  const db = service();
  const slug = `teste-${Date.now()}-${p++}`;
  const { data, error } = await db
    .from("products")
    .insert({ slug, name: `Produto ${slug}`, category_id: await categoryId("perfumes"), price_cents: 10000, status: "active", stock_on_hand: 0, weight_g: 400, width_cm: 10, height_cm: 15, length_cm: 6, ...over })
    .select("*")
    .single();
  if (error) throw error;
  return data as { id: string; slug: string; stock_on_hand: number };
}

export async function setSettings(patch: Record<string, unknown>) {
  await service().from("store_settings").update(patch).eq("id", 1);
}

/** Monta carrinho + endereço + cotação válida e devolve parâmetros para svc_create_order. */
export async function prepareCheckout(userId: string, items: { productId: string; qty: number }[], shippingCents = 2500) {
  const db = service();
  await db.from("carts").upsert({ user_id: userId }, { onConflict: "user_id" });
  const { data: cart } = await db.from("carts").select("id").eq("user_id", userId).single();
  await db.from("cart_items").delete().eq("cart_id", cart!.id);
  if (items.length) await db.from("cart_items").insert(items.map((i) => ({ cart_id: cart!.id, product_id: i.productId, quantity: i.qty })));
  const { data: addr } = await db.from("addresses").insert({ user_id: userId, recipient_name: "Teste", cep: "01001000", street: "Praça da Sé", number: "1", neighborhood: "Sé", city: "São Paulo", state: "SP" }).select("id").single();
  const { data: fp } = await db.rpc("cart_fingerprint", { p_user: userId });
  const { data: quote } = await db.from("shipping_quotes").insert({ user_id: userId, destination_cep: "01001000", cart_fingerprint: fp, package: {}, options: [{ code: "test:pac", kind: "carrier", provider: "test", service: "pac", label: "Teste PAC", price_cents: shippingCents, days_min: 3, days_max: 5 }] }).select("id").single();
  return { p_user_id: userId, p_address_id: addr!.id, p_shipping_quote_id: quote!.id, p_shipping_option_code: "test:pac", p_coupon_code: null, p_preorder_ack: false, p_preorder_terms_text: null, p_customer: { name: "Teste", email: "t@t.local" }, p_attribution: null };
}

export async function product(id: string) {
  const { data } = await service().from("products").select("stock_on_hand,stock_reserved,preorder_reserved,preorder_committed").eq("id", id).single();
  return data!;
}
