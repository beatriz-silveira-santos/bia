"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminContext, audit } from "@/lib/admin";
import { parseBRLToCents } from "@/lib/money";
import { sendOrderEmail, sendOnce } from "@/lib/email";
import { renderOrderEmail } from "@/lib/email/templates";

export type AdminState = { ok: boolean; message: string } | null;
const fail = (message: string): AdminState => ({ ok: false, message });
const errMsg = (e: { message?: string } | null) => (e?.message ?? "erro").split("\n")[0].slice(0, 200);

// ---------------------------------------------------------------- Pedidos
export async function adminSetOrderStatus(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const p = z.object({ orderId: z.string().uuid(), to: z.enum(["preparing", "ready_to_ship", "shipped", "delivered"]), note: z.string().max(500).optional(), tracking: z.string().max(60).optional() })
    .safeParse({ orderId: form.get("orderId"), to: form.get("to"), note: form.get("note") || undefined, tracking: form.get("tracking") || undefined });
  if (!p.success) return fail("Dados inválidos.");
  const { error } = await db.rpc("svc_admin_set_order_status", { p_actor: user.id, p_order_id: p.data.orderId, p_to: p.data.to, p_note: p.data.note ?? null, p_tracking: p.data.tracking ?? null });
  if (error) return fail(error.message.includes("preorder_not_received") ? "Registre o recebimento das encomendas antes de postar." : `Transição não permitida (${errMsg(error)}).`);
  if (p.data.to === "shipped" || p.data.to === "delivered") await sendOrderEmail(p.data.orderId, p.data.to).catch(() => undefined);
  revalidatePath(`/admin/pedidos/${p.data.orderId}`);
  return { ok: true, message: "Status atualizado." };
}

export async function adminCancelOrder(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const orderId = z.string().uuid().safeParse(form.get("orderId"));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
  if (!orderId.success || reason.length < 5) return fail("Informe o motivo do cancelamento.");
  const { error } = await db.rpc("svc_admin_cancel_order", { p_actor: user.id, p_order_id: orderId.data, p_reason: reason });
  if (error) return fail(`Não foi possível cancelar (${errMsg(error)}).`);
  await sendOrderEmail(orderId.data, "cancelled", { note: reason }).catch(() => undefined);
  revalidatePath(`/admin/pedidos/${orderId.data}`);
  return { ok: true, message: "Pedido cancelado. Se houve pagamento, faça o estorno no painel da InfinitePay e depois registre aqui." };
}

export async function adminMarkRefunded(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const orderId = z.string().uuid().safeParse(form.get("orderId"));
  if (!orderId.success || form.get("confirm") !== "on") return fail("Confirme que o estorno foi realizado na InfinitePay.");
  const { error } = await db.rpc("svc_admin_mark_refunded", { p_actor: `admin:${user.id}`, p_order_id: orderId.data, p_note: String(form.get("note") ?? "Estorno realizado.").slice(0, 500) });
  if (error) return fail(`Não foi possível registrar (${errMsg(error)}).`);
  await audit(user.id, "order.refunded", "order", orderId.data);
  await sendOrderEmail(orderId.data, "refunded").catch(() => undefined);
  revalidatePath(`/admin/pedidos/${orderId.data}`);
  return { ok: true, message: "Estorno registrado." };
}

// ---------------------------------------------------------------- Encomendas
export async function adminUpdateAllocation(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const p = z.object({ id: z.string().uuid(), status: z.enum(["awaiting_purchase", "purchased", "awaiting_receipt"]).optional(), eta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), note: z.string().max(1000).optional(), notify: z.literal("on").optional() })
    .safeParse({ id: form.get("id"), status: form.get("status") || undefined, eta: form.get("eta") || undefined, note: form.get("note") || undefined, notify: form.get("notify") || undefined });
  if (!p.success) return fail("Dados inválidos.");
  const { error } = await db.rpc("svc_admin_update_allocation", { p_actor: user.id, p_allocation_id: p.data.id, p_status: p.data.status ?? null, p_eta: p.data.eta ?? null, p_note: p.data.note ?? null, p_notify: !!p.data.notify });
  if (error) return fail(`Não foi possível atualizar (${errMsg(error)}).`);
  if (p.data.notify && p.data.note) {
    const { data: a } = await db.from("preorder_allocations").select("order_id").eq("id", p.data.id).single();
    if (a) await sendOrderEmail(a.order_id, "procurement_update", { note: p.data.note, dedupeSuffix: String(Date.now()) }).catch(() => undefined);
  }
  revalidatePath("/admin/encomendas");
  return { ok: true, message: "Encomenda atualizada." };
}

export async function adminReceiveStock(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const p = z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(10000), note: z.string().max(300).optional() })
    .safeParse({ productId: form.get("productId"), quantity: form.get("quantity"), note: form.get("note") || undefined });
  if (!p.success) return fail("Informe a quantidade recebida.");
  const { data, error } = await db.rpc("svc_admin_receive_stock", { p_actor: user.id, p_product_id: p.data.productId, p_quantity: p.data.quantity, p_note: p.data.note ?? null });
  if (error) return fail(`Não foi possível registrar (${errMsg(error)}).`);
  const r = data as { allocated: number; to_stock: number; orders: string[] };
  for (const orderId of r.orders ?? []) {
    const { data: o } = await db.from("orders").select("status").eq("id", orderId).single();
    if (o?.status === "procurement_received") await sendOrderEmail(orderId, "procurement_received").catch(() => undefined);
  }
  revalidatePath("/admin/encomendas");
  revalidatePath("/admin/estoque");
  return { ok: true, message: `Recebimento registrado: ${r.allocated} un. vinculadas a encomendas pagas, ${r.to_stock} un. para o estoque.` };
}

export async function adminAdjustStock(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const p = z.object({ productId: z.string().uuid(), delta: z.coerce.number().int().min(-10000).max(10000).refine((n) => n !== 0), kind: z.enum(["initial", "adjustment", "return", "loss"]), note: z.string().min(3).max(300) })
    .safeParse({ productId: form.get("productId"), delta: form.get("delta"), kind: form.get("kind"), note: form.get("note") });
  if (!p.success) return fail("Informe quantidade (diferente de zero) e motivo.");
  const { error } = await db.rpc("svc_admin_adjust_stock", { p_actor: user.id, p_product_id: p.data.productId, p_delta: p.data.delta, p_kind: p.data.kind, p_note: p.data.note });
  if (error) return fail(error.message.includes("check") ? "O ajuste deixaria o estoque negativo ou abaixo do reservado." : `Erro: ${errMsg(error)}`);
  revalidatePath("/admin/estoque");
  return { ok: true, message: "Estoque ajustado." };
}

// ---------------------------------------------------------------- Produtos
const list = (v: FormDataEntryValue | null) => String(v ?? "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 30);
const optText = (v: FormDataEntryValue | null, max = 4000) => { const s = String(v ?? "").trim(); return s ? s.slice(0, max) : null; };
const optNum = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim().replace(",", "."); if (!s) return null; const n = Number(s); return Number.isFinite(n) && n > 0 ? n : NaN; };
const slugify = async (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export async function adminSaveProduct(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const id = optText(form.get("id"));
  const name = optText(form.get("name"), 160);
  if (!name) return fail("Informe o nome.");
  const price = optText(form.get("price")) ? parseBRLToCents(String(form.get("price"))) : null;
  const promo = optText(form.get("promo_price")) ? parseBRLToCents(String(form.get("promo_price"))) : null;
  if (optText(form.get("price")) && price == null) return fail("Preço inválido. Use o formato 129,90.");
  if (optText(form.get("promo_price")) && promo == null) return fail("Preço promocional inválido.");
  const dims = ["volume_ml", "width_cm", "height_cm", "length_cm"].map((k) => optNum(form.get(k)));
  if (dims.some((d) => Number.isNaN(d))) return fail("Volume e dimensões devem ser números positivos.");
  const weight = optText(form.get("weight_g")) ? Number.parseInt(String(form.get("weight_g")), 10) : null;
  const status = String(form.get("status"));
  const mode = String(form.get("fulfillment_mode"));
  const leadUnit = optText(form.get("preorder_lead_time_unit"));
  const highlights = form.getAll("highlights").map(String).filter((h) => ["new", "bestseller", "recommended", "promo"].includes(h));

  // Produto sem foto não pode ser publicado (fica em rascunho até a proprietária incluir a imagem correta)
  if (status === "active" && id) {
    const { count } = await db.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", id).eq("kind", "image");
    if (!count) return fail("Inclua ao menos uma foto real do produto antes de ativá-lo.");
  }
  if (status === "active" && !id) return fail("Salve como rascunho, inclua as fotos e depois ative o produto.");
  if (status === "active" && (weight == null || dims.slice(1).some((d) => d == null))) return fail("Para ativar, informe peso embalado e dimensões (necessários para o frete).");

  const row = {
    name,
    slug: optText(form.get("slug"), 80) ?? (await slugify(name)),
    brand_id: optText(form.get("brand_id")),
    category_id: String(form.get("category_id")),
    subcategory_id: optText(form.get("subcategory_id")),
    gender: String(form.get("gender") ?? "not_applicable"),
    price_cents: price,
    promo_price_cents: promo,
    volume_ml: dims[0],
    is_decant: form.get("is_decant") === "on",
    description: optText(form.get("description")),
    top_notes: list(form.get("top_notes")),
    heart_notes: list(form.get("heart_notes")),
    base_notes: list(form.get("base_notes")),
    accords: list(form.get("accords")),
    olfactory_family: optText(form.get("olfactory_family"), 60),
    olfactory_description: optText(form.get("olfactory_description")),
    product_type: optText(form.get("product_type"), 60),
    contents: optText(form.get("contents")),
    how_to_use: optText(form.get("how_to_use")),
    composition: optText(form.get("composition")),
    warnings: optText(form.get("warnings")),
    benefits: optText(form.get("benefits")),
    sku: optText(form.get("sku"), 60),
    status,
    fulfillment_mode: mode,
    preorder_max_quantity: optText(form.get("preorder_max_quantity")) ? Number.parseInt(String(form.get("preorder_max_quantity")), 10) : null,
    preorder_lead_time_value: optText(form.get("preorder_lead_time_value")) ? Number.parseInt(String(form.get("preorder_lead_time_value")), 10) : null,
    preorder_lead_time_unit: leadUnit,
    preorder_internal_notes: optText(form.get("preorder_internal_notes")),
    supplier_name: optText(form.get("supplier_name"), 120),
    weight_g: weight,
    width_cm: dims[1],
    height_cm: dims[2],
    length_cm: dims[3],
    highlights,
    is_bundle: form.get("is_bundle") === "on",
    bundle_max_quantity: optText(form.get("bundle_max_quantity")) ? Number.parseInt(String(form.get("bundle_max_quantity")), 10) : null,
    seo_title: optText(form.get("seo_title"), 70),
    seo_description: optText(form.get("seo_description"), 160),
  };
  if (row.is_decant && row.volume_ml == null) row.volume_ml = 5;
  const q = id ? db.from("products").update(row).eq("id", id).select("id").single() : db.from("products").insert(row).select("id").single();
  const { data, error } = await q;
  if (error || !data) {
    const m = error?.message ?? "";
    if (m.includes("products_slug_key")) return fail("Já existe produto com este endereço (slug).");
    if (m.includes("products_sku_key")) return fail("SKU já utilizado.");
    if (m.includes("promo_lt_price")) return fail("O preço promocional deve ser menor que o preço normal.");
    if (m.includes("active_requires_price")) return fail("Informe o preço para ativar.");
    return fail(`Não foi possível salvar (${errMsg(error)}).`);
  }
  if (status === "active") await db.from("products").update({ published_at: new Date().toISOString() }).eq("id", data.id).is("published_at", null);
  await audit(user.id, id ? "product.update" : "product.create", "product", data.id, { name, status, price_cents: price });
  revalidatePath("/admin/produtos");
  if (!id) redirect(`/admin/produtos/${data.id}?criado=1`);
  return { ok: true, message: "Produto salvo." };
}

export async function adminSaveBundle(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const bundleId = z.string().uuid().parse(form.get("bundleId"));
  const comps = form.getAll("component").map(String);
  const qtys = form.getAll("componentQty").map((q) => Number.parseInt(String(q), 10));
  const rows = comps.map((c, i) => ({ bundle_product_id: bundleId, component_product_id: c, quantity: qtys[i] })).filter((r) => r.component_product_id && r.quantity > 0 && r.component_product_id !== bundleId);
  await db.from("bundle_items").delete().eq("bundle_product_id", bundleId);
  if (rows.length) {
    const { error } = await db.from("bundle_items").insert(rows);
    if (error) return fail("Composição inválida (produto repetido?).");
  }
  await audit(user.id, "bundle.update", "product", bundleId, { rows });
  revalidatePath(`/admin/produtos/${bundleId}`);
  return { ok: true, message: "Composição do kit salva." };
}

export async function adminUploadMedia(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const productId = z.string().uuid().parse(form.get("productId"));
  const file = form.get("file");
  const alt = String(form.get("alt") ?? "").trim().slice(0, 200);
  if (!(file instanceof File) || file.size === 0) return fail("Escolha um arquivo.");
  if (alt.length < 3) return fail("Descreva a imagem (texto alternativo) para acessibilidade.");
  const allowed: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm" };
  const ext = allowed[file.type];
  if (!ext) return fail("Formato não permitido. Use JPG, PNG, WebP, AVIF, MP4 ou WebM.");
  const isVideo = file.type.startsWith("video/");
  if (file.size > (isVideo ? 8 : 4) * 1024 * 1024) return fail(isVideo ? "Vídeo acima de 8 MB." : "Imagem acima de 4 MB. Exporte em WebP/JPG otimizado.");
  const { count } = await db.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if ((count ?? 0) >= 12) return fail("Limite de 12 mídias por produto.");
  // Confere a assinatura do arquivo (não confia só no tipo declarado)
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sig = Array.from(head.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const okSig = isVideo || sig.startsWith("ffd8ff") || sig === "89504e47" || (sig === "52494646" && String.fromCharCode(...head.slice(8, 12)) === "WEBP") || String.fromCharCode(...head.slice(4, 12)).includes("ftypavi");
  if (!okSig) return fail("O conteúdo do arquivo não corresponde a uma imagem válida.");
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await db.storage.from("products").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (upErr) return fail("Falha no envio do arquivo.");
  await db.from("product_images").insert({ product_id: productId, kind: isVideo ? "video" : "image", storage_path: path, alt_text: alt, position: count ?? 0 });
  await audit(user.id, "media.upload", "product", productId, { path });
  revalidatePath(`/admin/produtos/${productId}`);
  return { ok: true, message: "Mídia enviada." };
}

export async function adminDeleteMedia(form: FormData) {
  const { user, db } = await adminContext();
  const id = z.string().uuid().parse(form.get("id"));
  const { data } = await db.from("product_images").select("storage_path,product_id").eq("id", id).single();
  if (data) {
    if (!/^https?:\/\//.test(data.storage_path)) await db.storage.from("products").remove([data.storage_path]);
    await db.from("product_images").delete().eq("id", id);
    await audit(user.id, "media.delete", "product", data.product_id, { id });
    revalidatePath(`/admin/produtos/${data.product_id}`);
  }
}

// ---------------------------------------------------------------- Configurações e cadastros auxiliares
export async function adminSaveSettings(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const t = (k: string, max = 300) => optText(form.get(k), max);
  const n = (k: string) => Number.parseInt(String(form.get(k) ?? ""), 10);
  const unit = t("preorder_default_lead_time_unit");
  const patch = {
    legal_name: t("legal_name"), document_id: t("document_id", 30), contact_email: t("contact_email"), business_hours: t("business_hours"),
    public_address_line: t("public_address_line"), public_address_city: t("public_address_city"), public_address_state: t("public_address_state", 2),
    public_address_cep: t("public_address_cep", 9)?.replace(/\D/g, "") ?? null, address_publication_authorized: form.get("address_publication_authorized") === "on",
    origin_cep: (t("origin_cep", 9) ?? "15054160").replace(/\D/g, ""), preparation_business_days: n("preparation_business_days"),
    preorder_default_lead_time_value: n("preorder_default_lead_time_value"), preorder_default_lead_time_unit: unit === "calendar_days" || unit === "business_days" ? unit : null,
    pickup_enabled: form.get("pickup_enabled") === "on", pickup_instructions: t("pickup_instructions", 1000),
    reservation_minutes: n("reservation_minutes"), low_stock_threshold: n("low_stock_threshold"),
    payment_pix_enabled: form.get("payment_pix_enabled") === "on", max_installments: n("max_installments"), assured_installments: n("assured_installments"),
    checkout_enabled: form.get("checkout_enabled") === "on", about_text: t("about_text", 1000), hero_image_alt: t("hero_image_alt", 200),
    logo_path: t("logo_path"), hero_image_path: t("hero_image_path"),
  };
  const { error } = await db.from("store_settings").update(patch).eq("id", 1);
  if (error) return fail(`Não foi possível salvar (${errMsg(error)}).`);
  await audit(user.id, "settings.update", "store_settings", "1", patch);
  revalidatePath("/", "layout");
  return { ok: true, message: "Configurações salvas." };
}

export async function adminUploadBrandAsset(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const kind = form.get("kind") === "hero" ? "hero" : "logo";
  const file = form.get("file");
  if (!(file instanceof File) || !["image/png", "image/webp", "image/jpeg", "image/svg+xml", "image/avif"].includes(file.type) || file.size > 4 * 1024 * 1024) return fail("Envie PNG, SVG, WebP, AVIF ou JPG de até 4 MB.");
  const path = `marca/${kind}-${Date.now()}.${file.type.split("/")[1].replace("svg+xml", "svg")}`;
  const { error } = await db.storage.from("products").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) return fail("Falha no envio.");
  await db.from("store_settings").update(kind === "logo" ? { logo_path: path } : { hero_image_path: path }).eq("id", 1);
  await audit(user.id, `brand.${kind}`, "store_settings", "1", { path });
  revalidatePath("/", "layout");
  return { ok: true, message: kind === "logo" ? "Logo atualizada." : "Foto principal atualizada." };
}

export async function adminSaveCoupon(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const t = (k: string) => optText(form.get(k), 200);
  const type = String(form.get("discount_type"));
  const value = type === "fixed" ? parseBRLToCents(String(form.get("discount_value") ?? "")) : Number.parseInt(String(form.get("discount_value")), 10);
  if (!value || value <= 0) return fail("Valor do desconto inválido.");
  const row = {
    code: String(form.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30),
    description: t("description"), discount_type: type, discount_value: value,
    starts_at: t("starts_at") ? new Date(`${t("starts_at")}:00-03:00`).toISOString() : null,
    ends_at: t("ends_at") ? new Date(`${t("ends_at")}:00-03:00`).toISOString() : null,
    max_uses: t("max_uses") ? Number(t("max_uses")) : null, per_customer_limit: t("per_customer_limit") ? Number(t("per_customer_limit")) : null,
    min_subtotal_cents: t("min_subtotal") ? parseBRLToCents(t("min_subtotal")!) : null,
    category_ids: form.getAll("category_ids").map(String).filter(Boolean), product_ids: form.getAll("product_ids").map(String).filter(Boolean),
    bundles_only: form.get("bundles_only") === "on", active: form.get("active") === "on",
  };
  if (row.code.length < 3) return fail("Código do cupom muito curto.");
  const id = t("id");
  const { error } = id ? await db.from("coupons").update(row).eq("id", id) : await db.from("coupons").insert(row);
  if (error) return fail(error.message.includes("coupons_code_key") ? "Código já existe." : `Erro: ${errMsg(error)}`);
  await audit(user.id, "coupon.save", "coupon", id ?? row.code, row);
  revalidatePath("/admin/promocoes");
  return { ok: true, message: "Cupom salvo." };
}

export async function adminSaveZone(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const ranges = String(form.get("cep_ranges") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [a, b] = l.split(/\s*[-–a]\s*/).map((s) => s.replace(/\D/g, ""));
    return { from: a, to: b || a };
  });
  if (!ranges.length || ranges.some((r) => !/^\d{8}$/.test(r.from) || !/^\d{8}$/.test(r.to) || r.from > r.to)) return fail("Faixas de CEP inválidas. Use uma por linha, ex.: 15000-000 - 15099-999");
  const fee = parseBRLToCents(String(form.get("fee") ?? ""));
  if (fee == null) return fail("Taxa inválida.");
  const row = { name: String(form.get("name") ?? "").slice(0, 80), cep_ranges: ranges, fee_cents: fee, lead_time_text: String(form.get("lead_time_text") ?? "").slice(0, 120), active: form.get("active") === "on" };
  if (!row.name || !row.lead_time_text) return fail("Informe nome e prazo.");
  const id = optText(form.get("id"));
  const { error } = id ? await db.from("local_delivery_zones").update(row).eq("id", id) : await db.from("local_delivery_zones").insert(row);
  if (error) return fail(`Erro: ${errMsg(error)}`);
  await audit(user.id, "zone.save", "local_delivery_zone", id, row);
  revalidatePath("/admin/frete");
  return { ok: true, message: "Área de entrega salva." };
}

export async function adminModerateReview(form: FormData) {
  const { user, db } = await adminContext();
  const id = z.string().uuid().parse(form.get("id"));
  const status = z.enum(["approved", "rejected", "hidden"]).parse(form.get("status"));
  await db.from("reviews").update({ status, moderated_at: new Date().toISOString() }).eq("id", id);
  await audit(user.id, "review.moderate", "review", id, { status });
  revalidatePath("/admin/avaliacoes");
}

export async function adminSavePage(_: AdminState, form: FormData): Promise<AdminState> {
  const { user, db } = await adminContext();
  const slug = String(form.get("slug"));
  const { error } = await db.from("content_pages").update({ title: String(form.get("title")).slice(0, 120), body_markdown: String(form.get("body")).slice(0, 30000), reviewed_by_owner: form.get("reviewed") === "on", updated_at: new Date().toISOString() }).eq("slug", slug);
  if (error) return fail("Erro ao salvar.");
  await audit(user.id, "page.update", "content_page", slug);
  revalidatePath("/", "layout");
  return { ok: true, message: "Página salva." };
}

export async function adminResolveAlert(form: FormData) {
  const { user, db } = await adminContext();
  const id = z.string().uuid().parse(form.get("id"));
  await db.from("admin_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", id);
  await audit(user.id, "alert.resolve", "admin_alert", id);
  revalidatePath("/admin/alertas");
}

export async function adminSaveHoliday(form: FormData) {
  const { user, db } = await adminContext();
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(form.get("day"));
  const name = String(form.get("name") ?? "").slice(0, 80);
  if (form.get("remove") === "1") await db.from("holidays").delete().eq("day", day);
  else await db.from("holidays").upsert({ day, name, scope: String(form.get("scope") ?? "municipal") });
  await audit(user.id, "holiday.save", "holiday", day);
  revalidatePath("/admin/configuracoes");
}

/** Envio de teste do template (para conferir o provedor de e-mail sem afetar pedidos). */
export async function adminSendTestEmail(_: AdminState, form: FormData): Promise<AdminState> {
  const { user } = await adminContext();
  const to = z.string().email().safeParse(form.get("to"));
  if (!to.success) return fail("E-mail inválido.");
  const msg = renderOrderEmail("payment_confirmed", { number: "TESTE", customerName: "Bia", totalCents: 100, items: [], dispatchDueAt: new Date().toISOString() });
  const r = await sendOnce(`test:${user.id}:${Date.now()}`, "test", { ...msg, to: to.data, kind: "transactional" });
  return { ok: r === "sent", message: r === "sent" ? "E-mail de teste enviado." : r === "skipped" ? "Provedor de e-mail não configurado." : "Falha no envio; verifique as credenciais." };
}
