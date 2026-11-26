import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyAndConfirm } from "@/lib/payments/confirm";

/**
 * URL de retorno da InfinitePay. Os parâmetros vindos do navegador NÃO são confiáveis:
 * servem apenas para consultar o payment_check no servidor.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const orderNsu = sp.get("order_nsu")?.slice(0, 120);
  const transactionNsu = sp.get("transaction_nsu")?.slice(0, 120);
  const slug = sp.get("slug")?.slice(0, 120);
  if (!orderNsu) return NextResponse.redirect(new URL("/conta/pedidos", req.url));
  const { data: order } = await supabaseAdmin().from("orders").select("number").eq("order_nsu", orderNsu).maybeSingle();
  if (!order) return NextResponse.redirect(new URL("/conta/pedidos", req.url));
  if (transactionNsu && slug) {
    await verifyAndConfirm({ orderNsu, transactionNsu, slug, receiptUrl: sp.get("receipt_url") });
  }
  return NextResponse.redirect(new URL(`/conta/pedidos/${encodeURIComponent(order.number)}?retorno=1`, req.url));
}
