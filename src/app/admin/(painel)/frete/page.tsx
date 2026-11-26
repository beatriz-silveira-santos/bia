import { adminContext } from "@/lib/admin";
import { formatBRL } from "@/lib/money";
import { env } from "@/lib/env";
import { adminSaveZone } from "@/app/actions/admin";
import { AdminForm } from "@/components/admin/AdminForm";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Entrega local" };
const fmt = (c: string) => c.replace(/(\d{5})(\d{3})/, "$1-$2");
type Zone = { id: string; name: string; fee_cents: number; cep_ranges: unknown; lead_time_text: string; active: boolean };
function ZoneForm({ z }: { z?: Zone }) {
  return (
    <AdminForm action={adminSaveZone} submit={z ? "Salvar" : "Criar área"} className="grid gap-3 md:grid-cols-2">
      {z && <input type="hidden" name="id" value={z.id} />}
      <div><label className="label">Nome</label><input name="name" defaultValue={z?.name} className="field !py-2" required /></div>
      <div><label className="label">Taxa (R$)</label><input name="fee" defaultValue={z ? (z.fee_cents / 100).toFixed(2).replace(".", ",") : ""} className="field !py-2" required /></div>
      <div className="md:col-span-2"><label className="label">Faixas de CEP atendidas (uma por linha)</label><textarea name="cep_ranges" defaultValue={((z?.cep_ranges ?? []) as { from: string; to: string }[]).map((r) => `${fmt(r.from)} - ${fmt(r.to)}`).join("\n")} className="field min-h-24 font-mono text-sm" required /></div>
      <div><label className="label">Prazo informado</label><input name="lead_time_text" defaultValue={z?.lead_time_text} placeholder="Ex.: até 1 dia útil após a preparação" className="field !py-2" required /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={z?.active} className="h-5 w-5 accent-ink" /> Ativa</label>
    </AdminForm>
  );
}

export default async function Zones() {
  const { db } = await adminContext();
  const { data: zones } = await db.from("local_delivery_zones").select("*").order("position");
  const provider = env().SHIPPING_PROVIDER;
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Entrega local e frete</h1>
      <Panel title="Transporte nacional">
        <p className="text-sm">Provedor configurado: <strong>{provider === "none" ? "nenhum (cotação indisponível)" : provider}</strong>. As credenciais ficam em segredos do servidor (ver docs/frete.md). Sem provedor, o checkout mostra o frete como indisponível e orienta o WhatsApp — nunca valores inventados.</p>
      </Panel>
      <p className="text-sm text-ink-muted">Só cadastre CEPs que você realmente atende. Nenhum CEP é considerado coberto sem estar listado aqui. Retirada presencial é ativada em Configurações.</p>
      {(zones ?? []).map((z) => <Panel key={z.id} title={`${z.name} — ${formatBRL(z.fee_cents)}${z.active ? "" : " (inativa)"}`}><ZoneForm z={z} /></Panel>)}
      <Panel title="Nova área de entrega local"><ZoneForm /></Panel>
    </div>
  );
}
