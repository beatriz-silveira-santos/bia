import Link from "next/link";
import { adminContext } from "@/lib/admin";
import { formatDateSP } from "@/lib/leadtime";
import { Panel, Table } from "@/components/admin/ui";

export const metadata = { title: "Estoque" };
export default async function Stock() {
  const { db } = await adminContext();
  const [{ data: products }, { data: s }, { data: moves }] = await Promise.all([
    db.from("products").select("id,name,sku,status,stock_on_hand,stock_reserved,preorder_reserved,preorder_committed,fulfillment_mode").neq("status", "archived").order("name"),
    db.from("store_settings").select("low_stock_threshold").eq("id", 1).single(),
    db.from("inventory_movements").select("kind,quantity,note,created_at,products(name)").order("created_at", { ascending: false }).limit(50),
  ]);
  const th = s?.low_stock_threshold ?? 2;
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between"><h1 className="text-4xl">Estoque</h1><a href={`/admin/exportar/estoque`} className="btn-secondary !min-h-10">Exportar CSV</a></header>
      <Panel title="Posição atual">
        <Table head={["Produto", "SKU", "Físico", "Reservado (pagamento pendente)", "Disponível", "Encomendas pagas a receber", "Situação"]} rows={(products ?? []).map((p) => {
          const avail = p.stock_on_hand - p.stock_reserved;
          const sit = avail <= 0 ? (p.fulfillment_mode === "accepts_preorder" ? "Sem estoque — vendendo sob encomenda" : "Esgotado") : avail <= th ? "Estoque baixo" : "OK";
          return [<Link key="n" href={`/admin/produtos/${p.id}`} className="underline">{p.name}</Link>, p.sku ?? "—", String(p.stock_on_hand), String(p.stock_reserved), String(avail), String(p.preorder_committed), sit];
        })} />
      </Panel>
      <Panel title="Últimas movimentações">
        <Table head={["Data", "Produto", "Tipo", "Qtd.", "Nota"]} rows={(moves ?? []).map((m) => [formatDateSP(m.created_at, true), (m.products as unknown as { name: string })?.name ?? "", m.kind, String(m.quantity), m.note ?? ""])} />
      </Panel>
    </div>
  );
}
