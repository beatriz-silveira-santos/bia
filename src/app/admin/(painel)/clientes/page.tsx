import { adminContext, PAID_STATUSES } from "@/lib/admin";
import { formatBRL } from "@/lib/money";
import { formatDateSP } from "@/lib/leadtime";
import { Panel, Table } from "@/components/admin/ui";

export const metadata = { title: "Clientes" };
export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { db } = await adminContext();
  let pq = db.from("profiles").select("id,full_name,created_at").order("created_at", { ascending: false }).limit(300);
  if (q) pq = pq.ilike("full_name", `%${q.replace(/[%,]/g, "")}%`);
  const [{ data: profiles }, { data: orders }, { data: reqs }] = await Promise.all([
    pq,
    db.from("orders").select("user_id,total_cents,status").in("status", PAID_STATUSES),
    db.from("support_requests").select("id,subject,message,status,created_at,order_id").eq("status", "open").order("created_at"),
  ]);
  const agg = new Map<string, { n: number; v: number }>();
  (orders ?? []).forEach((o) => { const a = agg.get(o.user_id) ?? { n: 0, v: 0 }; agg.set(o.user_id, { n: a.n + 1, v: a.v + o.total_cents }); });
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Clientes</h1>
      <Panel title={`Solicitações de atendimento abertas (${reqs?.length ?? 0})`}>
        <Table head={["Data", "Assunto", "Mensagem"]} rows={(reqs ?? []).map((r) => [formatDateSP(r.created_at, true), r.subject, r.message.slice(0, 200)])} empty="Nenhuma solicitação aberta." />
      </Panel>
      <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Buscar por nome" className="field !w-64 !py-2" aria-label="Buscar" /><button className="btn-secondary !min-h-10">Buscar</button></form>
      <Panel title="Clientes (dados mínimos)">
        <Table head={["Nome", "Cadastro", "Pedidos pagos", "Total comprado"]} rows={(profiles ?? []).map((p) => [p.full_name ?? "—", formatDateSP(p.created_at), String(agg.get(p.id)?.n ?? 0), formatBRL(agg.get(p.id)?.v ?? 0)])} />
      </Panel>
    </div>
  );
}
