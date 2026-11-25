import { adminContext } from "@/lib/admin";
import { adminSavePage } from "@/app/actions/admin";
import { AdminForm } from "@/components/admin/AdminForm";

export const metadata = { title: "Páginas" };
export default async function Pages() {
  const { db } = await adminContext();
  const { data } = await db.from("content_pages").select("*").order("slug");
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Páginas institucionais</h1>
      <p className="text-sm text-ink-muted">Os textos são rascunhos e não substituem orientação jurídica. Preencha os itens [PENDENTE], revise e marque como revisado. Formatação: ## título, - lista, **negrito**, [texto](/link).</p>
      {(data ?? []).map((p) => (
        <details key={p.slug} className="rounded-2xl border border-line bg-white p-5">
          <summary className="cursor-pointer font-semibold">{p.title} {p.reviewed_by_owner ? "✓ revisada" : <span className="text-warning">· rascunho</span>}{p.body_markdown.includes("[PENDENTE") ? <span className="text-danger"> · tem pendências</span> : null}</summary>
          <AdminForm action={adminSavePage} className="mt-4 space-y-3">
            <input type="hidden" name="slug" value={p.slug} />
            <input name="title" defaultValue={p.title} className="field !py-2" aria-label="Título" />
            <textarea name="body" defaultValue={p.body_markdown} className="field min-h-80 font-mono text-sm" aria-label="Conteúdo" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reviewed" defaultChecked={p.reviewed_by_owner} className="h-5 w-5 accent-ink" /> Revisei e aprovo este texto</label>
          </AdminForm>
        </details>
      ))}
    </div>
  );
}
