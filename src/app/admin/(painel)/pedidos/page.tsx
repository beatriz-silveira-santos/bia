import Link from "next/link";
import { adminContext, resolvePeriod } from "@/lib/admin";
import { formatBRL } from "@/lib/money";
import { formatDateSP } from "@/lib/leadtime";
import { ORDER_STATUS_LABEL } from "@/lib/types";
import { PeriodFilter, Table } from "@/components/admin/ui";

export const metadata = { title: "Pedidos" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { db } = await adminContext();
  const period = resolvePeriod(sp.periodo ?? "30d", sp.de, sp.ate);
  let q = db.from("orders").select("id,number,status,total_cents,created_at,has_preorder,customer_snapshot,dispatch_due_at").gte("created_at", period.from.toISOString()).lt("created_at", period.to.toISOString()).order("created_at", { ascending: false }).limit(200);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.q) {
    const term = sp.q.trim().slice(0, 60).replace(/[%,()]/g, "");
    q = q.or(`number.ilike.%${term}%,customer_snapshot->>email.ilike.%${term}%,customer_snapshot->>name.ilike.%${term}%`);
  }
  const { data } = await q;
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Pedidos</h1>
      <PeriodFilter base="/admin/pedidos" current={period.key} extra={Object.fromEntries(Object.entries({ status: sp.status, q: sp.q }).filter(([, v]) => v)) as Record<string, string>} />
      <form className="flex flex-wrap gap-2" action="/admin/pedidos">
        <input type="hidden" name="periodo" value={period.key} />
        <label className="sr-only" htmlFor="oq">Buscar</label>
        <input id="oq" name="q" defaultValue={sp.q} placeholder="Número, nome ou e-mail" className="field !w-72 !py-2" />
        <label className="sr-only" htmlFor="os">Status</label>
        <select id="os" name="status" defaultValue={sp.status ?? ""} className="field !w-60 !py-2">
          <option value="">Todos os status</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-secondary !min-h-10">Filtrar</button>
        <a className="btn-secondary !min-h-10" href={`/admin/exportar/pedidos?periodo=${period.key}${sp.de ? `&de=${sp.de}&ate=${sp.ate}` : ""}`}>Exportar CSV</a>
      </form>
      <div className="rounded-2xl border border-line bg-white p-5">
        <Table
          head={["Pedido", "Data", "Cliente", "Status", "Postagem até", "Total"]}
          rows={(data ?? []).map((o) => [
            <Link key="n" href={`/admin/pedidos/${o.id}`} className="font-semibold underline">{o.number}</Link>,
            formatDateSP(o.created_at, true),
            (o.customer_snapshot as { name?: string })?.name ?? "—",
            <span key="s">{ORDER_STATUS_LABEL[o.status]}{o.has_preorder ? " · encomenda" : ""}</span>,
            formatDateSP(o.dispatch_due_at),
            formatBRL(o.total_cents),
          ])}
          empty="Nenhum pedido encontrado."
        />
      </div>
    </div>
  );
}
