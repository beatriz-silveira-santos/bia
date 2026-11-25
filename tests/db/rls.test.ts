import { beforeAll, describe, expect, it } from "vitest";
import { anon, dbAvailable, makeProduct, makeUser, prepareCheckout, service, setSettings } from "./helpers";

const ok = await dbAvailable();

describe.skipIf(!ok)("RLS — isolamento entre clientes e bloqueio administrativo", () => {
  let a: Awaited<ReturnType<typeof makeUser>>;
  let b: Awaited<ReturnType<typeof makeUser>>;
  let orderA: string;

  beforeAll(async () => {
    await setSettings({ checkout_enabled: true, preorder_default_lead_time_unit: "calendar_days" });
    a = await makeUser("a");
    b = await makeUser("b");
    const p = await makeProduct({ stock_on_hand: 5 });
    const params = await prepareCheckout(a.id, [{ productId: p.id, qty: 1 }]);
    const { data, error } = await service().rpc("svc_create_order", params);
    expect(error).toBeNull();
    orderA = (data as { id: string }).id;
  });

  it("visitante lê catálogo publicado, mas não a tabela products nem pedidos", async () => {
    const pub = anon();
    expect((await pub.from("catalog_products").select("id").limit(1)).error).toBeNull();
    expect((await pub.from("products").select("id").limit(1)).error).not.toBeNull();
    const { data } = await pub.from("orders").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("produto em rascunho não aparece no catálogo público", async () => {
    const draft = await makeProduct({ status: "draft", stock_on_hand: 3 });
    const { data } = await anon().from("catalog_products").select("id").eq("id", draft.id);
    expect(data).toHaveLength(0);
  });

  it("view pública não expõe campos internos", async () => {
    const { error } = await anon().from("catalog_products").select("supplier_name").limit(1);
    expect(error).not.toBeNull();
  });

  it("cliente vê o próprio pedido e não vê o de outra", async () => {
    expect((await a.client.from("orders").select("id").eq("id", orderA)).data).toHaveLength(1);
    expect((await b.client.from("orders").select("id").eq("id", orderA)).data).toHaveLength(0);
    expect((await b.client.from("order_items").select("id").eq("order_id", orderA)).data).toHaveLength(0);
  });

  it("cliente não lê endereços, carrinho ou favoritos de outra", async () => {
    expect((await b.client.from("addresses").select("id").eq("user_id", a.id)).data).toHaveLength(0);
    expect((await b.client.from("carts").select("id").eq("user_id", a.id)).data).toHaveLength(0);
    const ins = await b.client.from("addresses").insert({ user_id: a.id, recipient_name: "X", cep: "01001000", street: "R", number: "1", neighborhood: "B", city: "C", state: "SP" });
    expect(ins.error).not.toBeNull();
  });

  it("cliente não altera pedido, estoque nem preço", async () => {
    await a.client.from("orders").update({ total_cents: 1 }).eq("id", orderA);
    const { data: o } = await service().from("orders").select("total_cents").eq("id", orderA).single();
    expect(o!.total_cents).not.toBe(1);
    const upd = await a.client.from("products").update({ price_cents: 100 }).neq("id", "00000000-0000-0000-0000-000000000000").select("id");
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("cliente não executa funções de servidor nem se promove a admin", async () => {
    expect((await a.client.rpc("svc_confirm_payment", { p_order_nsu: "x", p_invoice_slug: "x", p_transaction_nsu: "x", p_amount_cents: 1, p_paid_amount_cents: 1, p_installments: 1, p_capture_method: "pix", p_receipt_url: null })).error).not.toBeNull();
    expect((await a.client.rpc("svc_admin_adjust_stock", { p_actor: a.id, p_product_id: orderA, p_delta: 10, p_kind: "adjustment", p_note: "x" })).error).not.toBeNull();
    expect((await a.client.from("user_roles").insert({ user_id: a.id, role: "admin" })).error).not.toBeNull();
    expect((await a.client.rpc("is_admin")).data).toBe(false);
    expect((await a.client.from("analytics_events").select("id")).data ?? []).toHaveLength(0);
    expect((await a.client.from("email_subscribers").select("id")).data ?? []).toHaveLength(0);
    expect((await a.client.from("admin_audit_log").select("id")).data ?? []).toHaveLength(0);
  });

  it("admin sem MFA (aal1) não tem acesso administrativo", async () => {
    const adm = await makeUser("admin");
    await service().from("user_roles").insert({ user_id: adm.id, role: "admin" });
    expect((await adm.client.rpc("has_admin_role")).data).toBe(true);
    expect((await adm.client.rpc("is_admin")).data).toBe(false);
    expect((await adm.client.from("orders").select("id").eq("id", orderA)).data).toHaveLength(0);
  });

  it("cadastro público não define papel administrativo via metadados", async () => {
    const { data } = await anon().auth.signUp({ email: `x-${Date.now()}@teste.local`, password: "senha-de-teste-123", options: { data: { role: "admin" } } });
    const { data: roles } = await service().from("user_roles").select("role").eq("user_id", data.user!.id);
    expect(roles).toHaveLength(0);
  });
});
