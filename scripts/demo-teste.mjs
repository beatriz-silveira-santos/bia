// Catálogo de DEMONSTRAÇÃO para a versão de teste (workers.dev).
// - Imagens: fotos públicas de divulgação dos produtos, usadas SOMENTE no teste,
//   carregadas direto da URL de origem (não são copiadas para o repositório nem para o Storage).
// - Preços e estoques: provisórios, só para navegar pela loja. Não usar em produção.
// - Checkout continua desligado (store_settings.checkout_enabled = false).
// Uso: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/demo-teste.mjs [--admin-email=email]
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SECRET_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const NOTE = "Versão de teste: foto de divulgação, preço e estoque provisórios, apenas para demonstração.";
const JML = "https://www.justmylook.com/cdn/shop/files/";

// [slug, nome, marca, subcategoria|categoria, gênero, preço (centavos), promo, ml, modo, estoque, destaques, imagem, tipo]
const P = [
  ["rabanne-1-million-edt-100", "1 Million Eau de Toilette 100 ml", "rabanne", "perfumes-masculinos", "male", 69990, null, 100, "ready_stock", 3, ["bestseller"], JML + "PAC0043_0413e6b7-e925-4edd-ac37-cc7d4a0ff9e4.png?v=1738168805"],
  ["rabanne-black-xs-edt-100", "Black XS Pour Homme Eau de Toilette 100 ml", "rabanne", "perfumes-masculinos", "male", 59990, 54990, 100, "ready_stock", 2, ["promo"], JML + "PAC0015_785c4756-f1e4-4db6-8529-aa43da8eb4c4.png?v=1769531010"],
  ["ch-good-girl-edp-80", "Good Girl Eau de Parfum 80 ml", "carolina-herrera", "perfumes-femininos", "female", 89990, null, 80, "accepts_preorder", 0, ["bestseller", "recommended"], JML + "CHERR0003_5cdec4df-4b27-4d6e-8f90-8d72641f1343.png?v=1765452782"],
  ["ch-212-vip-men-edt-100", "212 VIP Men Eau de Toilette 100 ml", "carolina-herrera", "perfumes-masculinos", "male", 64990, null, 100, "ready_stock", 2, [], JML + "CHERR0065.png?v=1765452237"],
  ["britney-fantasy-edp-100", "Fantasy Eau de Parfum 100 ml", "britney-spears", "perfumes-femininos", "female", 32990, 29990, 100, "ready_stock", 4, ["promo"], JML + "britney-spears-fantasy-eau-de-parfum-100ml-p22273-49037_image.jpg?v=1721322131"],
  ["lattafa-khamrah-edp-100", "Khamrah Eau de Parfum 100 ml", "lattafa", "perfumes-arabes", "unisex", 32990, null, 100, "ready_stock", 6, ["bestseller", "new"], JML + "LAT0010.png?v=1758900967"],
  ["lattafa-yara-elixir-edp-100", "Yara Elixir Eau de Parfum 100 ml", "lattafa", "perfumes-arabes", "female", 29990, null, 100, "accepts_preorder", 0, ["new"], JML + "LAT0050_d2165e47-749f-43b4-811e-1fbcce4d9b5d.png?v=1780055195"],
  ["lattafa-asad-bourbon-edp-100", "Asad Bourbon Eau de Parfum 100 ml", "lattafa", "perfumes-arabes", "male", 27990, null, 100, "ready_stock", 3, ["new"], JML + "LAT0012.png?v=1758900972"],
  ["armaf-cdn-intense-man-105", "Club de Nuit Intense Man Eau de Toilette 105 ml", "armaf", "perfumes-arabes", "male", 34990, null, 105, "ready_stock", 2, ["recommended"], JML + "ARM0005.png?v=1758900964"],
  ["al-haramain-amber-oud-gold-120", "Amber Oud Gold Edition Eau de Parfum 120 ml", "al-haramain", "perfumes-arabes", "unisex", 54990, null, 120, "accepts_preorder", 1, [], JML + "ALHA0002.png?v=1774622950"],
  ["afnan-9pm-edp-100", "9PM Pour Homme Eau de Parfum 100 ml", "afnan", "perfumes-arabes", "male", 29990, null, 100, "ready_stock", 5, ["bestseller"], JML + "afnan-9pm-pour-homme-eau-de-parfum-100ml-p35649-108050_image.jpg?v=1721322129"],
  ["rasasi-hawas-for-him-100", "Hawas for Him Eau de Parfum 100 ml", "rasasi", "perfumes-arabes", "male", 39990, null, 100, "ready_stock", 2, [], JML + "RAHA0001.png?v=1761047571"],
  ["lattafa-khamrah-decante-5", "Decante Khamrah 5 ml", "lattafa", "decantes-5-ml", "unisex", 4990, null, 5, "ready_stock", 20, ["new"], JML + "LAT0010.png?v=1758900967", null, true],
  ["afnan-9pm-decante-5", "Decante 9PM 5 ml", "afnan", "decantes-5-ml", "male", 4490, null, 5, "ready_stock", 15, [], JML + "afnan-9pm-pour-homme-eau-de-parfum-100ml-p35649-108050_image.jpg?v=1721322129", null, true],
  ["medicube-zero-pore-pad-2", "Zero Pore Pad 2.0 (70 discos)", "medicube", "skincare", "not_applicable", 18990, null, null, "ready_stock", 6, ["recommended"], "https://www.bperfectcosmetics.com/cdn/shop/files/ZeroPorePad2.0_70pcs.webp?v=1789126754", "Discos tonificantes"],
  ["kerasys-advanced-repair-shampoo-600", "Advanced Repair Ampoule Shampoo 600 ml", "kerasys", "cabelos", "not_applicable", 11990, null, 600, "ready_stock", 4, [], ["https://skinsli.com/cdn/shop/files/11408589_1.jpg?v=1742655802", "https://cdn.shopify.com/s/files/1/0824/4015/9562/files/11408589_1.jpg?v=1742655802"], "Shampoo"],
];

// As fotos de divulgação são baixadas uma vez e guardadas no Storage da própria loja,
// para não depender do site de origem (que pode bloquear links de fora). Se o download
// falhar, a loja usa a URL original.
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
async function baixar(origem) {
  const res = await fetch(origem, {
    headers: { "user-agent": "Mozilla/5.0", accept: "image/avif,image/webp,image/png,image/jpeg,*/*" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const tipo = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = EXT[tipo];
  if (!ext) throw new Error(`tipo inesperado: ${tipo || "nenhum"}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 1024) throw new Error("arquivo muito pequeno");
  return { bytes, tipo, ext };
}

// Tenta as origens em ordem. Se nenhuma funcionar, o produto fica sem foto
// (a loja mostra "Imagem em breve") — melhor do que guardar um link quebrado.
async function guardarFoto(slug, origens) {
  for (const origem of [origens].flat()) {
    try {
      const { bytes, tipo, ext } = await baixar(origem);
      const caminho = `demonstracao/${slug}.${ext}`;
      const { error } = await db.storage.from("products").upload(caminho, bytes, { contentType: tipo, upsert: true });
      if (error) throw error;
      return caminho;
    } catch (e) {
      console.warn(`  foto de ${slug}: ${new URL(origem).hostname} falhou (${e instanceof Error ? e.message : e})`);
    }
  }
  console.warn(`  foto de ${slug}: nenhuma origem funcionou; produto fica sem foto`);
  return null;
}

const { data: cats, error: ce } = await db.from("categories").select("id,slug,parent_id");
if (ce) throw ce;
const { data: brands, error: be } = await db.from("brands").select("id,slug");
if (be) throw be;
const cat = (s) => cats.find((c) => c.slug === s);
const brand = (s) => brands.find((b) => b.slug === s)?.id ?? null;

let n = 0;
for (const [i, row] of P.entries()) {
  const [slug, name, brandSlug, catSlug, gender, price, promo, ml, mode, stock, highlights, img, ptype = null, decant = false] = row;
  const c = cat(catSlug);
  if (!c) throw new Error(`Categoria ausente: ${catSlug}`);
  const top = c.parent_id ? cats.find((x) => x.id === c.parent_id) : c;
  const product = {
    slug, name, brand_id: brand(brandSlug), category_id: top.id, subcategory_id: c.parent_id ? c.id : null,
    gender, price_cents: price, promo_price_cents: promo, volume_ml: ml, is_decant: decant,
    description: NOTE, product_type: ptype, status: "active", fulfillment_mode: mode,
    preorder_max_quantity: mode === "accepts_preorder" ? 5 : null,
    weight_g: decant ? 60 : 500, width_cm: decant ? 4 : 12, height_cm: decant ? 10 : 16, length_cm: decant ? 4 : 8,
    highlights, sku: `TESTE-${String(i + 1).padStart(3, "0")}`,
    published_at: new Date(Date.now() - i * 3600_000).toISOString(),
  };
  const { data: existing } = await db.from("products").select("id,stock_on_hand").eq("slug", slug).maybeSingle();
  let id = existing?.id;
  if (id) {
    const { error } = await db.from("products").update(product).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await db.from("products").insert({ ...product, stock_on_hand: stock }).select("id").single();
    if (error) throw error;
    id = data.id;
    if (stock > 0) await db.from("inventory_movements").insert({ product_id: id, kind: "initial", quantity: stock, note: "Estoque provisório da versão de teste" });
  }
  await db.from("product_images").delete().eq("product_id", id);
  const foto = await guardarFoto(slug, img);
  if (foto) {
    const { error: ie } = await db.from("product_images").insert({ product_id: id, storage_path: foto, alt_text: `Foto de divulgação de ${name} (provisória)`, position: 0 });
    if (ie) throw ie;
  }
  n++;
}

// Versão de teste: pagamento desligado; prazo de encomenda 20 dias corridos.
const { error: se } = await db.from("store_settings").update({ checkout_enabled: false, preorder_default_lead_time_value: 20, preorder_default_lead_time_unit: "calendar_days" }).eq("id", 1);
if (se) throw se;
console.log(`Catálogo de teste: ${n} produtos atualizados.`);

const adminArg = process.argv.find((a) => a.startsWith("--admin-email="));
const adminEmail = (adminArg?.split("=")[1] ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
if (adminEmail) {
  let user = null;
  for (let page = 1; page <= 20 && !user; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    user = data.users.find((u) => u.email?.toLowerCase() === adminEmail) ?? null;
    if (data.users.length < 100) break;
  }
  if (!user) console.log("Administradora: conta não encontrada. Cadastre-se na loja de teste e rode de novo.");
  else {
    const { error } = await db.from("user_roles").upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw error;
    console.log("Administradora: acesso de administradora concedido.");
  }
}
