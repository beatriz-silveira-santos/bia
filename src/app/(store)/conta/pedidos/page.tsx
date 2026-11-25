import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDateSP } from "@/lib/leadtime";
import { formatBRL } from "@/lib/money";
import { supabaseServer } from "@/lib/supabase/server";
import { ORDER_STATUS_LABEL } from "@/lib/types";

export const metadata: Metadata = { title: "Meus pedidos", robots: { index: false } };

export default async function OrdersPage() {
  const user = await requireUser("/conta/pedidos");
  const { data: orders } = await (await supabaseServer()).from("orders").select("id,number,status,total_cents,created_at,has_preorder").eq("user_id", user.id).order("created_at", { ascending: false });
  if (!orders?.length) return <p className="card p-8 text-ink-soft">Você ainda não fez pedidos.</p>;
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/conta/pedidos/${o.number}`} className="card flex flex-wrap items-center justify-between gap-3 p-5 hover:border-line-strong">
            <span><strong className="block">{o.number}</strong><span className="text-sm text-ink-muted">{formatDateSP(o.created_at)}{o.has_preorder ? " · contém encomenda" : ""}</span></span>
            <span className="text-sm">{ORDER_STATUS_LABEL[o.status]}</span>
            <strong>{formatBRL(o.total_cents)}</strong>
          </Link>
        </li>
      ))}
    </ul>
  );
}
