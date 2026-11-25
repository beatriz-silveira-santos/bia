import Link from "next/link";
import { adminContext } from "@/lib/admin";
import { formatDateSP } from "@/lib/leadtime";
import { adminResolveAlert } from "@/app/actions/admin";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Alertas" };
const KIND: Record<string, string> = {
  payment_mismatch: "Pagamento com valor divergente — não confirmado automaticamente",
  unknown_order: "Pagamento para pedido desconhecido",
  late_payment: "Pagamento recebido para pedido cancelado/expirado — avaliar estorno ou reativação manual",
  preorder_due_soon: "Encomenda com prazo de postagem próximo",
  preorder_overdue: "Encomenda com prazo de postagem vencido — contatar a cliente",
  provider_refunded: "InfinitePay informou estorno — conferir e registrar no pedido",
  provider_canceled: "InfinitePay informou cancelamento — conferir",
};
export default async function Alerts() {
  const { db } = await adminContext();
  const { data } = await db.from("admin_alerts").select("*, orders(number)").is("resolved_at", null).order("created_at", { ascending: false });
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Alertas</h1>
      {(data ?? []).map((a) => (
        <Panel key={a.id} title={KIND[a.kind] ?? a.kind}>
          <p className="text-sm text-ink-soft">{formatDateSP(a.created_at, true)} {a.order_id && <>· <Link href={`/admin/pedidos/${a.order_id}`} className="underline">{(a.orders as { number: string } | null)?.number}</Link></>}</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-ivory p-2 text-xs">{JSON.stringify(a.details, null, 2)}</pre>
          <form action={adminResolveAlert} className="mt-3"><input type="hidden" name="id" value={a.id} /><button className="btn-secondary !min-h-9 text-sm">Marcar como resolvido</button></form>
        </Panel>
      ))}
      {!data?.length && <p className="text-ink-muted">Nenhum alerta em aberto.</p>}
    </div>
  );
}
