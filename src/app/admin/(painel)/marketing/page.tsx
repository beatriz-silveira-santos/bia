import { adminContext } from "@/lib/admin";
import { formatDateSP } from "@/lib/leadtime";
import { adminSendTestEmail } from "@/app/actions/admin";
import { AdminForm } from "@/components/admin/AdminForm";
import { Panel, Stat, Table } from "@/components/admin/ui";
import { env } from "@/lib/env";

export const metadata = { title: "Marketing" };
export default async function Marketing() {
  const { db } = await adminContext();
  const [{ data: subs }, { count: suppressed }, { data: log }] = await Promise.all([
    db.from("email_subscribers").select("email,status,consent_source,consented_at,unsubscribed_at,interests").order("created_at", { ascending: false }).limit(500),
    db.from("email_suppression_list").select("email", { count: "exact", head: true }),
    db.from("email_log").select("template,status,kind,created_at,error").order("created_at", { ascending: false }).limit(30),
  ]);
  const active = (subs ?? []).filter((s) => s.status === "subscribed");
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between"><h1 className="text-4xl">Marketing</h1><a href={`/admin/exportar/inscritas`} className="btn-secondary !min-h-10">Exportar inscritas (CSV)</a></header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Inscritas ativas" value={String(active.length)} />
        <Stat label="Descadastradas" value={String((subs ?? []).length - active.length)} />
        <Stat label="Lista de supressão" value={String(suppressed ?? 0)} hint="Nunca reimportar estes e-mails." />
      </div>
      <Panel title="Provedor de e-mail">
        <p className="mb-3 text-sm">Configurado: <strong>{env().EMAIL_PROVIDER === "none" ? "nenhum (e-mails ficam registrados como “não enviados”)" : env().EMAIL_PROVIDER}</strong>. Veja docs/email.md para SPF, DKIM e DMARC.</p>
        <AdminForm action={adminSendTestEmail} submit="Enviar e-mail de teste" className="flex flex-wrap items-end gap-2"><div><label className="label" htmlFor="te">Para</label><input id="te" name="to" type="email" className="field !py-2" required /></div></AdminForm>
      </Panel>
      <Panel title="Inscritas (com consentimento registrado)">
        <Table head={["E-mail", "Status", "Origem", "Consentimento", "Descadastro"]} rows={(subs ?? []).map((s) => [s.email, s.status === "subscribed" ? "Inscrita" : "Descadastrada", s.consent_source ?? "—", formatDateSP(s.consented_at, true), formatDateSP(s.unsubscribed_at, true)])} empty="Nenhuma inscrição ainda." />
      </Panel>
      <Panel title="Últimos e-mails">
        <Table head={["Data", "Modelo", "Tipo", "Status"]} rows={(log ?? []).map((l) => [formatDateSP(l.created_at, true), l.template, l.kind, `${l.status}${l.error ? ` (${l.error})` : ""}`])} />
      </Panel>
    </div>
  );
}
