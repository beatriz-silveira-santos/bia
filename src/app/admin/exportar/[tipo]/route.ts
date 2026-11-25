import { NextResponse, type NextRequest } from "next/server";
import { adminContext, audit, resolvePeriod, toCsv } from "@/lib/admin";

/** Exportações CSV (abrem no Excel). Exige administradora com MFA. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const { user, db } = await adminContext();
  const sp = req.nextUrl.searchParams;
  const period = resolvePeriod(sp.get("periodo") ?? "30d", sp.get("de") ?? undefined, sp.get("ate") ?? undefined);
  let rows: Record<string, unknown>[] = [];
  if (tipo === "pedidos") {
    const { data } = await db.from("orders").select("number,status,created_at,paid_at,dispatch_due_at,subtotal_cents,discount_cents,shipping_cents,total_cents,coupon_code,has_preorder,shipping_option,attribution,customer_snapshot").gte("created_at", period.from.toISOString()).lt("created_at", period.to.toISOString()).order("created_at");
    rows = (data ?? []).map((o) => ({
      pedido: o.number, status: o.status, criado_em: o.created_at, pago_em: o.paid_at, postagem_ate: o.dispatch_due_at,
      subtotal: (o.subtotal_cents / 100).toFixed(2).replace(".", ","), desconto: (o.discount_cents / 100).toFixed(2).replace(".", ","),
      frete: (o.shipping_cents / 100).toFixed(2).replace(".", ","), total: (o.total_cents / 100).toFixed(2).replace(".", ","), cupom: o.coupon_code,
      encomenda: o.has_preorder ? "sim" : "nao", entrega: (o.shipping_option as { label?: string })?.label, cliente: (o.customer_snapshot as { name?: string })?.name,
      origem_ultimo_toque: (o.attribution as { last_channel?: string } | null)?.last_channel, origem_primeiro_toque: (o.attribution as { first_channel?: string } | null)?.first_channel,
    }));
  } else if (tipo === "encomendas") {
    const { data } = await db.from("preorder_allocations").select("status,quantity,quantity_received,paid_at,dispatch_due_at,supplier_name,internal_eta,orders(number,customer_snapshot),products(name,sku)").order("dispatch_due_at");
    rows = (data ?? []).map((a) => ({ pedido: (a.orders as unknown as { number: string }).number, cliente: (a.orders as unknown as { customer_snapshot: { name?: string } }).customer_snapshot?.name, produto: (a.products as unknown as { name: string }).name, sku: (a.products as unknown as { sku: string | null }).sku, quantidade: a.quantity, recebido: a.quantity_received, status: a.status, pago_em: a.paid_at, postar_ate: a.dispatch_due_at, fornecedor: a.supplier_name, previsao_interna: a.internal_eta }));
  } else if (tipo === "produtos") {
    const { data } = await db.from("products").select("sku,name,status,fulfillment_mode,price_cents,promo_price_cents,volume_ml,stock_on_hand,weight_g,width_cm,height_cm,length_cm,brands(slug),categories!products_category_id_fkey(slug)").order("name");
    rows = (data ?? []).map((p) => ({ sku: p.sku, nome: p.name, marca: (p.brands as unknown as { slug: string } | null)?.slug, categoria: (p.categories as unknown as { slug: string } | null)?.slug, status: p.status, modalidade: p.fulfillment_mode, preco: p.price_cents ? (p.price_cents / 100).toFixed(2).replace(".", ",") : "", preco_promocional: p.promo_price_cents ? (p.promo_price_cents / 100).toFixed(2).replace(".", ",") : "", volume_ml: p.volume_ml, estoque: p.stock_on_hand, peso_g: p.weight_g, largura_cm: p.width_cm, altura_cm: p.height_cm, comprimento_cm: p.length_cm }));
  } else if (tipo === "estoque") {
    const { data } = await db.from("inventory_movements").select("created_at,kind,quantity,note,products(name,sku)").gte("created_at", period.from.toISOString()).lt("created_at", period.to.toISOString()).order("created_at");
    rows = (data ?? []).map((m) => ({ data: m.created_at, produto: (m.products as unknown as { name: string }).name, sku: (m.products as unknown as { sku: string | null }).sku, tipo: m.kind, quantidade: m.quantity, nota: m.note }));
  } else if (tipo === "inscritas") {
    const { data } = await db.from("email_subscribers").select("email,status,interests,consent_source,consent_version,consented_at").eq("status", "subscribed");
    rows = (data ?? []).map((s) => ({ ...s, interests: s.interests.join("|") }));
  } else {
    return NextResponse.json({ error: "tipo inválido" }, { status: 404 });
  }
  await audit(user.id, "export", tipo, null, { rows: rows.length, period: period.key });
  return new NextResponse(toCsv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bia-${tipo}-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
}
