"use server";
import { revalidatePath } from "next/cache";
import { adminContext, audit } from "@/lib/admin";
import { parseCsv } from "@/lib/csv";
import { parseBRLToCents } from "@/lib/money";

export type ImportState = { ok: boolean; message: string; errors?: string[] } | null;

const GENDER: Record<string, string> = { feminino: "female", masculino: "male", infantil: "kids", unissex: "unisex", "": "not_applicable", "nao_aplicavel": "not_applicable" };
const MODE: Record<string, string> = { pronta_entrega: "ready_stock", "": "ready_stock", sob_encomenda: "accepts_preorder", aceita_encomenda: "accepts_preorder", indisponivel: "unavailable" };
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const list = (s: string) => s.split(/[,|]/).map((x) => x.trim()).filter(Boolean);
const num = (s: string) => (s ? Number(s.replace(",", ".")) : null);

/** Importa/atualiza produtos (sempre como RASCUNHO; ativação só após fotos e conferência no painel). */
export async function importProducts(_: ImportState, form: FormData): Promise<ImportState> {
  const { user, db } = await adminContext();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024) return { ok: false, message: "Envie um arquivo CSV de até 2 MB." };
  const rows = parseCsv(await file.text());
  if (!rows.length) return { ok: false, message: "Arquivo vazio ou sem cabeçalho." };
  if (rows.length > 1000) return { ok: false, message: "Máximo de 1000 linhas por importação." };
  const [{ data: brands }, { data: cats }] = await Promise.all([db.from("brands").select("id,slug,name"), db.from("categories").select("id,slug")]);
  const brandBy = (v: string) => brands?.find((b) => b.slug === slugify(v) || b.name.toLowerCase() === v.toLowerCase())?.id;
  const catBy = (v: string) => cats?.find((c) => c.slug === slugify(v))?.id;
  const errors: string[] = [];
  let created = 0, updated = 0;

  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    if (r.nome?.startsWith("Nome do produto (exemplo)")) continue;
    if (!r.nome) { errors.push(`Linha ${line}: nome obrigatório.`); continue; }
    const category_id = catBy(r.categoria ?? "");
    if (!category_id) { errors.push(`Linha ${line}: categoria "${r.categoria}" não encontrada.`); continue; }
    const brand_id = r.marca ? brandBy(r.marca) : null;
    if (r.marca && !brand_id) { errors.push(`Linha ${line}: marca "${r.marca}" não cadastrada.`); continue; }
    const price = r.preco ? parseBRLToCents(r.preco) : null;
    const promo = r.preco_promocional ? parseBRLToCents(r.preco_promocional) : null;
    if ((r.preco && price == null) || (r.preco_promocional && promo == null)) { errors.push(`Linha ${line}: preço inválido.`); continue; }
    const decant = ["sim", "s", "true", "1"].includes((r.decante ?? "").toLowerCase());
    const row = {
      name: r.nome.slice(0, 160), sku: r.sku || null, brand_id, category_id, subcategory_id: r.subcategoria ? catBy(r.subcategoria) ?? null : null,
      gender: GENDER[(r.classificacao ?? "").toLowerCase()] ?? "not_applicable", price_cents: price, promo_price_cents: promo,
      volume_ml: decant ? 5 : num(r.volume_ml ?? ""), is_decant: decant, description: r.descricao || null, olfactory_family: r.familia_olfativa || null,
      accords: list(r.acordes ?? ""), top_notes: list(r.notas_saida ?? ""), heart_notes: list(r.notas_coracao ?? ""), base_notes: list(r.notas_fundo ?? ""),
      product_type: r.tipo_produto || null, how_to_use: r.modo_de_uso || null, composition: r.composicao || null, warnings: r.advertencias || null,
      benefits: r.beneficios || null, contents: r.conteudo || null, weight_g: r.peso_g ? Number.parseInt(r.peso_g, 10) : null,
      width_cm: num(r.largura_cm ?? ""), height_cm: num(r.altura_cm ?? ""), length_cm: num(r.comprimento_cm ?? ""),
      fulfillment_mode: MODE[(r.modalidade ?? "").toLowerCase()] ?? "ready_stock", preorder_max_quantity: r.encomenda_max ? Number.parseInt(r.encomenda_max, 10) : null,
      supplier_name: r.fornecedor || null,
    };
    const existing = row.sku ? (await db.from("products").select("id").eq("sku", row.sku).maybeSingle()).data : null;
    if (existing) {
      const { error } = await db.from("products").update(row).eq("id", existing.id);
      if (error) errors.push(`Linha ${line}: ${error.message.slice(0, 120)}`); else updated++;
    } else {
      const { data, error } = await db.from("products").insert({ ...row, slug: `${slugify(r.nome)}${row.sku ? `-${slugify(row.sku)}` : ""}`.slice(0, 80), status: "draft" }).select("id").single();
      if (error || !data) { errors.push(`Linha ${line}: ${(error?.message ?? "").slice(0, 120)}`); continue; }
      created++;
      const qty = Number.parseInt(r.estoque_inicial ?? "", 10);
      if (qty > 0) await db.rpc("svc_admin_adjust_stock", { p_actor: user.id, p_product_id: data.id, p_delta: qty, p_kind: "initial", p_note: "Importação CSV" });
    }
  }
  await audit(user.id, "product.import", "product", null, { created, updated, errors: errors.length });
  revalidatePath("/admin/produtos");
  return { ok: errors.length === 0, message: `${created} criados, ${updated} atualizados (todos como rascunho/sem alterar status).`, errors };
}
