import { adminContext } from "@/lib/admin";
import { formatDateSP } from "@/lib/leadtime";
import { adminModerateReview } from "@/app/actions/admin";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Avaliações" };
const ST: Record<string, string> = { pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada", hidden: "Oculta" };
export default async function Reviews() {
  const { db } = await adminContext();
  const { data } = await db.from("reviews").select("*, products(name)").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Avaliações</h1>
      <p className="text-sm text-ink-muted">Somente clientes com pedido entregue podem avaliar. Modere apenas conteúdo abusivo, ofensivo ou com dados pessoais; não altere nem selecione opiniões por serem negativas.</p>
      {(data ?? []).map((r) => (
        <Panel key={r.id} title={`${(r.products as { name: string }).name} — ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}`}>
          <p className="text-sm">{r.comment ?? <em>Sem comentário</em>}</p>
          <p className="mt-2 text-xs text-ink-muted">{r.author_display_name} · {formatDateSP(r.created_at)} · {ST[r.status]} · compra verificada</p>
          <div className="mt-3 flex gap-2">
            {(["approved", "hidden", "rejected"] as const).filter((s) => s !== r.status).map((s) => (
              <form key={s} action={adminModerateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={s} /><button className="btn-secondary !min-h-9 text-sm">{s === "approved" ? "Aprovar" : s === "hidden" ? "Ocultar" : "Rejeitar"}</button></form>
            ))}
          </div>
        </Panel>
      ))}
      {!data?.length && <p className="text-ink-muted">Nenhuma avaliação recebida ainda.</p>}
    </div>
  );
}
