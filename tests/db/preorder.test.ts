import { beforeAll, describe, expect, it } from "vitest";
import { dbAvailable, makeProduct, makeUser, prepareCheckout, product, service, setSettings } from "./helpers";

const ok = await dbAvailable();
const db = () => service();
type Order = { id: string; order_nsu: string; total_cents: number; has_preorder: boolean };
const ACK = "Estou ciente do prazo de postagem da encomenda.";

async function pay(o: Order) {
  const { data } = await db().rpc("svc_confirm_payment", { p_order_nsu: o.order_nsu, p_invoice_slug: `s-${o.id}`, p_transaction_nsu: `t-${o.id}`, p_amount_cents: o.total_cents, p_paid_amount_cents: o.total_cents, p_installments: 1, p_capture_method: "credit_card", p_receipt_url: null });
  return data as string;
}

describe.skipIf(!ok)("vendas sob encomenda", () => {
  beforeAll(async () => setSettings({ checkout_enabled: true, preorder_default_lead_time_unit: "calendar_days", preorder_default_lead_time_value: 20 }));

  it("estoque zero com encomenda habilitada pode ser comprado; sem encomenda, não", async () => {
    const u = await makeUser();
    const pre = await makeProduct({ fulfillment_mode: "accepts_preorder" });
    const no = await makeProduct({ fulfillment_mode: "ready_stock" });
    const { data: v } = await db().from("catalog_products").select("id,sale_state").in("id", [pre.id, no.id]);
    expect(v!.find((x) => x.id === pre.id)!.sale_state).toBe("preorder");
    expect(v!.find((x) => x.id === no.id)!.sale_state).toBe("sold_out");
    const blocked = await db().rpc("svc_create_order", await prepareCheckout(u.id, [{ productId: no.id, qty: 1 }]));
    expect(blocked.error!.message).toMatch(/insufficient_stock/);
  });

  it("exige aceite do prazo antes de pagar e grava o texto aceito", async () => {
    const u = await makeUser();
    const pre = await makeProduct({ fulfillment_mode: "accepts_preorder" });
    const base = await prepareCheckout(u.id, [{ productId: pre.id, qty: 1 }]);
    expect((await db().rpc("svc_create_order", base)).error!.message).toMatch(/preorder_ack_required/);
    const { data, error } = await db().rpc("svc_create_order", { ...(await prepareCheckout(u.id, [{ productId: pre.id, qty: 1 }])), p_preorder_ack: true, p_preorder_terms_text: ACK });
    expect(error).toBeNull();
    const o = data as Order & { preorder_terms_text: string; preorder_terms_accepted_at: string; items: { fulfillment: string; lead_time_value: number; lead_time_unit: string }[] };
    expect(o.has_preorder).toBe(true);
    expect(o.preorder_terms_text).toBe(ACK);
    expect(o.items[0]).toMatchObject({ fulfillment: "preorder", lead_time_value: 20, lead_time_unit: "calendar_days" });
  });

  it("unidade dos 20 dias não confirmada bloqueia encomendas", async () => {
    await setSettings({ preorder_default_lead_time_unit: null });
    const u = await makeUser();
    const pre = await makeProduct({ fulfillment_mode: "accepts_preorder" });
    const { data: v } = await db().from("catalog_products").select("sale_state").eq("id", pre.id).single();
    expect(v!.sale_state).toBe("sold_out");
    const r = await db().rpc("svc_create_order", { ...(await prepareCheckout(u.id, [{ productId: pre.id, qty: 1 }])), p_preorder_ack: true, p_preorder_terms_text: ACK });
    expect(r.error!.message).toMatch(/preorder_unit_not_configured/);
    await setSettings({ preorder_default_lead_time_unit: "calendar_days" });
  });

  it("respeita a quantidade máxima de encomendas sob concorrência", async () => {
    const pre = await makeProduct({ fulfillment_mode: "accepts_preorder", preorder_max_quantity: 1 });
    const [u1, u2] = [await makeUser(), await makeUser()];
    const ps = [await prepareCheckout(u1.id, [{ productId: pre.id, qty: 1 }]), await prepareCheckout(u2.id, [{ productId: pre.id, qty: 1 }])].map((p) => ({ ...p, p_preorder_ack: true, p_preorder_terms_text: ACK }));
    const rs = await Promise.all(ps.map((p) => db().rpc("svc_create_order", p)));
    expect(rs.filter((r) => !r.error)).toHaveLength(1);
    expect(rs.find((r) => r.error)!.error!.message).toMatch(/preorder_capacity_exceeded/);
  });

  it("pagamento gera compromisso (sem estoque negativo) e prazo contado do pagamento", async () => {
    const u = await makeUser();
    const pre = await makeProduct({ fulfillment_mode: "accepts_preorder" });
    const { data } = await db().rpc("svc_create_order", { ...(await prepareCheckout(u.id, [{ productId: pre.id, qty: 2 }])), p_preorder_ack: true, p_preorder_terms_text: ACK });
    const o = data as Order;
    expect(await product(pre.id)).toMatchObject({ stock_on_hand: 0, preorder_reserved: 2, preorder_committed: 0 });
    expect(await pay(o)).toBe("confirmed");
    expect(await product(pre.id)).toMatchObject({ stock_on_hand: 0, preorder_reserved: 0, preorder_committed: 2 });
    const { data: ord } = await db().from("orders").select("status,paid_at,dispatch_due_at").eq("id", o.id).single();
    expect(ord!.status).toBe("awaiting_procurement");
    const days = (new Date(ord!.dispatch_due_at).getTime() - new Date(ord!.paid_at).getTime()) / 86400_000;
    expect(days).toBeGreaterThan(19);
    expect(days).toBeLessThan(21.1);
    const { data: alloc } = await db().from("preorder_allocations").select("quantity,status").eq("order_id", o.id);
    expect(alloc).toEqual([{ quantity: 2, status: "awaiting_purchase" }]);
  });

  it("recebimento vincula unidades às encomendas pagas (FIFO) sem duplicar estoque", async () => {
    const pre = await makeProduct({ fulfillment_mode: "accepts_preorder" });
    const [u1, u2] = [await makeUser(), await makeUser()];
    const orders: Order[] = [];
    for (const u of [u1, u2]) {
      const { data } = await db().rpc("svc_create_order", { ...(await prepareCheckout(u.id, [{ productId: pre.id, qty: 1 }])), p_preorder_ack: true, p_preorder_terms_text: ACK });
      orders.push(data as Order);
      await pay(data as Order);
    }
    const { data: r } = await db().rpc("svc_admin_receive_stock", { p_actor: u1.id, p_product_id: pre.id, p_quantity: 3, p_note: "NF 123" });
    expect(r).toMatchObject({ allocated: 2, to_stock: 1 });
    expect(await product(pre.id)).toMatchObject({ stock_on_hand: 1, preorder_committed: 0 });
    for (const o of orders) {
      const { data: s } = await db().from("orders").select("status").eq("id", o.id).single();
      expect(s!.status).toBe("procurement_received");
    }
    // não pode postar antes de receber; depois de recebido pode
    const { error } = await db().rpc("svc_admin_set_order_status", { p_actor: u1.id, p_order_id: orders[0].id, p_to: "shipped", p_note: null, p_tracking: "BR123" });
    expect(error).toBeNull();
  });

  it("carrinho misto gera um pedido com itens de pronta entrega e encomenda", async () => {
    const u = await makeUser();
    const ready = await makeProduct({ stock_on_hand: 2 });
    const pre = await makeProduct({ fulfillment_mode: "accepts_preorder" });
    const { data, error } = await db().rpc("svc_create_order", { ...(await prepareCheckout(u.id, [{ productId: ready.id, qty: 1 }, { productId: pre.id, qty: 1 }])), p_preorder_ack: true, p_preorder_terms_text: ACK });
    expect(error).toBeNull();
    const o = data as Order & { dispatch_rule: { kind: string; single_shipment: boolean }; items: { fulfillment: string }[] };
    expect(o.items.map((i) => i.fulfillment).sort()).toEqual(["preorder", "ready_stock"]);
    expect(o.dispatch_rule).toMatchObject({ kind: "preorder", single_shipment: true });
    expect(await pay(o)).toBe("confirmed");
    // não posta antes da encomenda chegar
    const { error: e2 } = await db().rpc("svc_admin_set_order_status", { p_actor: u.id, p_order_id: o.id, p_to: "shipped", p_note: null, p_tracking: null });
    expect(e2!.message).toMatch(/invalid_transition|preorder_not_received/);
  });

  it("cancelamento de encomenda paga libera o compromisso", async () => {
    const u = await makeUser();
    const pre = await makeProduct({ fulfillment_mode: "accepts_preorder" });
    const { data } = await db().rpc("svc_create_order", { ...(await prepareCheckout(u.id, [{ productId: pre.id, qty: 1 }])), p_preorder_ack: true, p_preorder_terms_text: ACK });
    await pay(data as Order);
    await db().rpc("svc_admin_cancel_order", { p_actor: u.id, p_order_id: (data as Order).id, p_reason: "Fornecedor sem estoque" });
    expect(await product(pre.id)).toMatchObject({ stock_on_hand: 0, preorder_committed: 0 });
  });

  it("dias úteis pulam fins de semana e feriados (fuso de São Paulo)", async () => {
    // Sexta 13/11/2026 10h SP + 3 dias úteis: seg 16, ter 17, qua 18 → 18/11 (feriado 15/11 cai no domingo)
    const { data } = await db().rpc("compute_dispatch_due", { p_from: "2026-11-13T13:00:00Z", p_value: 3, p_unit: "business_days" });
    expect(new Date(data as string).toISOString()).toBe("2026-11-19T02:59:59.000Z");
    // Quarta 18/11 + 2 úteis: qui 19, (sex 20 feriado), seg 23
    const { data: d2 } = await db().rpc("compute_dispatch_due", { p_from: "2026-11-18T13:00:00Z", p_value: 2, p_unit: "business_days" });
    expect(new Date(d2 as string).toISOString()).toBe("2026-11-24T02:59:59.000Z");
    const { data: d3 } = await db().rpc("compute_dispatch_due", { p_from: "2026-11-25T02:00:00Z", p_value: 20, p_unit: "calendar_days" });
    expect(new Date(d3 as string).toISOString()).toBe("2026-12-15T02:59:59.000Z");
  });
});
