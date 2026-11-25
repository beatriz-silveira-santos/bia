import { beforeAll, describe, expect, it } from "vitest";
import { dbAvailable, makeProduct, makeUser, prepareCheckout, product, service, setSettings } from "./helpers";

const ok = await dbAvailable();
const db = () => service();
type Order = { id: string; order_nsu: string; total_cents: number; status: string; has_preorder: boolean };

async function createOrder(params: Record<string, unknown>) {
  const { data, error } = await db().rpc("svc_create_order", params);
  return { order: data as Order | null, error };
}
async function pay(o: Order, tx = `tx-${o.id}`, amount = o.total_cents) {
  const { data } = await db().rpc("svc_confirm_payment", { p_order_nsu: o.order_nsu, p_invoice_slug: `slug-${o.id}`, p_transaction_nsu: tx, p_amount_cents: amount, p_paid_amount_cents: amount, p_installments: 1, p_capture_method: "pix", p_receipt_url: null });
  return data as string;
}

describe.skipIf(!ok)("pedidos, estoque e pagamento", () => {
  beforeAll(async () => setSettings({ checkout_enabled: true, preorder_default_lead_time_unit: "calendar_days", preorder_default_lead_time_value: 20 }));

  it("recalcula total no servidor e reserva estoque", async () => {
    const u = await makeUser();
    const p = await makeProduct({ stock_on_hand: 3, price_cents: 12990, promo_price_cents: 9990 });
    const { order, error } = await createOrder(await prepareCheckout(u.id, [{ productId: p.id, qty: 2 }], 2500));
    expect(error).toBeNull();
    expect(order!.total_cents).toBe(9990 * 2 + 2500);
    expect(await product(p.id)).toMatchObject({ stock_on_hand: 3, stock_reserved: 2 });
  });

  it("não vende acima do estoque, inclusive em pedidos simultâneos", async () => {
    const [u1, u2] = [await makeUser(), await makeUser()];
    const p = await makeProduct({ stock_on_hand: 1 });
    const [p1, p2] = [await prepareCheckout(u1.id, [{ productId: p.id, qty: 1 }]), await prepareCheckout(u2.id, [{ productId: p.id, qty: 1 }])];
    const results = await Promise.all([createOrder(p1), createOrder(p2)]);
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.find((r) => r.error)!.error!.message).toMatch(/insufficient_stock/);
    expect(await product(p.id)).toMatchObject({ stock_on_hand: 1, stock_reserved: 1 });
  });

  it("pagamento confirmado baixa o estoque uma única vez (idempotente)", async () => {
    const u = await makeUser();
    const p = await makeProduct({ stock_on_hand: 2 });
    const { order } = await createOrder(await prepareCheckout(u.id, [{ productId: p.id, qty: 2 }]));
    expect(await pay(order!)).toBe("confirmed");
    expect(await pay(order!)).toBe("already_processed");
    expect(await product(p.id)).toMatchObject({ stock_on_hand: 0, stock_reserved: 0 });
    const { data: o } = await db().from("orders").select("status,paid_at,dispatch_due_at").eq("id", order!.id).single();
    expect(o!.status).toBe("paid");
    expect(o!.dispatch_due_at).not.toBeNull();
    const { count } = await db().from("inventory_movements").select("id", { count: "exact", head: true }).eq("order_id", order!.id).eq("kind", "sale");
    expect(count).toBe(1);
    const { data: cart } = await db().from("carts").select("cart_items(product_id)").eq("user_id", u.id).single();
    expect(cart!.cart_items).toHaveLength(0);
  });

  it("valor divergente não confirma o pagamento e gera alerta", async () => {
    const u = await makeUser();
    const p = await makeProduct({ stock_on_hand: 1 });
    const { order } = await createOrder(await prepareCheckout(u.id, [{ productId: p.id, qty: 1 }]));
    expect(await pay(order!, "tx-mismatch", 100)).toBe("amount_mismatch");
    const { data: o } = await db().from("orders").select("status").eq("id", order!.id).single();
    expect(o!.status).toBe("awaiting_payment");
    const { count } = await db().from("admin_alerts").select("id", { count: "exact", head: true }).eq("order_id", order!.id).eq("kind", "payment_mismatch");
    expect(count).toBe(1);
  });

  it("pedido desconhecido é registrado para análise", async () => {
    const { data } = await db().rpc("svc_confirm_payment", { p_order_nsu: "nao-existe", p_invoice_slug: "s", p_transaction_nsu: "t", p_amount_cents: 100, p_paid_amount_cents: 100, p_installments: 1, p_capture_method: "pix", p_receipt_url: null });
    expect(data).toBe("unknown_order");
  });

  it("reserva vencida é liberada e o pedido cancelado; pagamento tardio vira alerta", async () => {
    const u = await makeUser();
    const p = await makeProduct({ stock_on_hand: 1 });
    const { order } = await createOrder(await prepareCheckout(u.id, [{ productId: p.id, qty: 1 }]));
    await db().from("orders").update({ payment_expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", order!.id);
    const { data: n } = await db().rpc("svc_expire_pending_orders");
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await product(p.id)).toMatchObject({ stock_on_hand: 1, stock_reserved: 0 });
    expect(await pay(order!)).toBe("late_payment");
    expect(await product(p.id)).toMatchObject({ stock_on_hand: 1, stock_reserved: 0 });
  });

  it("cotação de frete desatualizada (carrinho mudou) é recusada", async () => {
    const u = await makeUser();
    const p = await makeProduct({ stock_on_hand: 5 });
    const params = await prepareCheckout(u.id, [{ productId: p.id, qty: 1 }]);
    const { data: cart } = await db().from("carts").select("id").eq("user_id", u.id).single();
    await db().from("cart_items").update({ quantity: 2 }).eq("cart_id", cart!.id);
    const { error } = await createOrder(params);
    expect(error!.message).toMatch(/shipping_quote_stale/);
  });

  it("cancelamento após pagamento devolve o estoque", async () => {
    const u = await makeUser();
    const p = await makeProduct({ stock_on_hand: 2 });
    const { order } = await createOrder(await prepareCheckout(u.id, [{ productId: p.id, qty: 1 }]));
    await pay(order!);
    const { error } = await db().rpc("svc_admin_cancel_order", { p_actor: u.id, p_order_id: order!.id, p_reason: "Teste de cancelamento" });
    expect(error).toBeNull();
    expect(await product(p.id)).toMatchObject({ stock_on_hand: 2, stock_reserved: 0 });
    await db().rpc("svc_admin_mark_refunded", { p_actor: `admin:${u.id}`, p_order_id: order!.id, p_note: "ok" });
    const { data: o } = await db().from("orders").select("status").eq("id", order!.id).single();
    expect(o!.status).toBe("refunded");
  });

  it("kit reserva e baixa os componentes", async () => {
    const u = await makeUser();
    const c1 = await makeProduct({ stock_on_hand: 2 });
    const c2 = await makeProduct({ stock_on_hand: 1 });
    const kit = await makeProduct({ is_bundle: true, price_cents: 15000 });
    await db().from("bundle_items").insert([{ bundle_product_id: kit.id, component_product_id: c1.id, quantity: 1 }, { bundle_product_id: kit.id, component_product_id: c2.id, quantity: 1 }]);
    const { data: view } = await db().from("catalog_products").select("max_purchasable").eq("id", kit.id).single();
    expect(view!.max_purchasable).toBe(1);
    const bad = await createOrder(await prepareCheckout(u.id, [{ productId: kit.id, qty: 2 }]));
    expect(bad.error!.message).toMatch(/insufficient_stock/);
    const { order } = await createOrder(await prepareCheckout(u.id, [{ productId: kit.id, qty: 1 }]));
    await pay(order!);
    expect(await product(c1.id)).toMatchObject({ stock_on_hand: 1 });
    expect(await product(c2.id)).toMatchObject({ stock_on_hand: 0 });
  });

  it("cupom só se aplica quando ativo e respeita limite", async () => {
    await db().from("coupons").insert({ code: "TESTE10", discount_type: "percent", discount_value: 10, active: false, max_uses: 1 });
    const u = await makeUser();
    const p = await makeProduct({ stock_on_hand: 5, price_cents: 10000 });
    const params = { ...(await prepareCheckout(u.id, [{ productId: p.id, qty: 1 }], 0)), p_coupon_code: "teste10" };
    expect((await createOrder(params)).error!.message).toMatch(/coupon_invalid/);
    await db().from("coupons").update({ active: true }).eq("code", "TESTE10");
    const { order } = await createOrder({ ...(await prepareCheckout(u.id, [{ productId: p.id, qty: 1 }], 0)), p_coupon_code: "teste10" });
    expect(order!.total_cents).toBe(9000);
    expect((await createOrder({ ...(await prepareCheckout(u.id, [{ productId: p.id, qty: 1 }], 0)), p_coupon_code: "TESTE10" })).error!.message).toMatch(/coupon_exhausted/);
  });
});
