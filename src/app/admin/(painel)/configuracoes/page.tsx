import { adminContext } from "@/lib/admin";
import { formatDateSP } from "@/lib/leadtime";
import { adminSaveHoliday, adminSaveSettings, adminUploadBrandAsset } from "@/app/actions/admin";
import { AdminForm } from "@/components/admin/AdminForm";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Configurações" };
type S = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
function I({ s, k, label, hint, ...rest }: { s: S; k: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div><label className="label" htmlFor={`s-${k}`}>{label}</label><input id={`s-${k}`} name={k} defaultValue={s[k] ?? ""} className="field !py-2" {...rest} />{hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}</div>
  );
}
function C({ s, k, label }: { s: S; k: string; label: string }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={k} defaultChecked={s[k] === true} className="h-5 w-5 accent-ink" /> {label}</label>;
}

export default async function Settings() {
  const { db } = await adminContext();
  const [{ data: s }, { data: holidays }] = await Promise.all([db.from("store_settings").select("*").eq("id", 1).single(), db.from("holidays").select("*").gte("day", new Date().toISOString().slice(0, 10)).order("day")]);
  if (!s) return null;
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Configurações da loja</h1>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Logo original"><AdminForm action={adminUploadBrandAsset} submit="Enviar logo" className="space-y-2"><input type="hidden" name="kind" value="logo" /><input type="file" name="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" required className="text-sm" aria-label="Arquivo da logo" /><p className="text-xs text-ink-muted">Use o arquivo original; ele é exibido sem alterações.</p></AdminForm></Panel>
        <Panel title="Foto principal da home"><AdminForm action={adminUploadBrandAsset} submit="Enviar foto" className="space-y-2"><input type="hidden" name="kind" value="hero" /><input type="file" name="file" accept="image/jpeg,image/webp,image/avif,image/png" required className="text-sm" aria-label="Foto principal" /><p className="text-xs text-ink-muted">Fotografia real dos produtos, horizontal ou 4:5, até 4 MB.</p></AdminForm></Panel>
      </div>
      <AdminForm action={adminSaveSettings} submit="Salvar configurações" className="space-y-5">
        <input type="hidden" name="logo_path" value={s.logo_path ?? ""} /><input type="hidden" name="hero_image_path" value={s.hero_image_path ?? ""} />
        <Panel title="Dados da empresa (obrigatórios antes de vender)">
          <div className="grid gap-3 md:grid-cols-2">
            <I s={s} k="legal_name" label="Razão social / nome do fornecedor" /><I s={s} k="document_id" label="CPF/CNPJ" />
            <I s={s} k="contact_email" label="E-mail comercial" type="email" /><I s={s} k="business_hours" label="Horário de atendimento" placeholder="Seg. a sex., 9h às 18h" />
            <I s={s} k="public_address_line" label="Endereço público" placeholder="Rua Antônio Munia, 1723, Jardim do Bosque" /><I s={s} k="public_address_city" label="Cidade" />
            <I s={s} k="public_address_state" label="UF" maxLength={2} /><I s={s} k="public_address_cep" label="CEP" />
            <C s={s} k="address_publication_authorized" label="Autorizo a divulgação deste endereço no site" />
            <div className="md:col-span-2"><label className="label" htmlFor="s-about">Texto curto “Sobre” (home)</label><textarea id="s-about" name="about_text" defaultValue={s.about_text ?? ""} className="field" /></div>
            <I s={s} k="hero_image_alt" label="Descrição da foto principal (acessibilidade)" />
          </div>
        </Panel>
        <Panel title="Prazos e encomendas">
          <div className="grid gap-3 md:grid-cols-3">
            <I s={s} k="origin_cep" label="CEP de origem" /><I s={s} k="preparation_business_days" label="Preparação (dias úteis)" type="number" min={0} max={30} />
            <I s={s} k="reservation_minutes" label="Reserva de estoque aguardando pagamento (min)" type="number" min={15} max={1440} />
            <I s={s} k="preorder_default_lead_time_value" label="Prazo padrão de postagem de encomendas" type="number" min={1} max={120} />
            <div>
              <label className="label" htmlFor="s-unit">Unidade do prazo de encomenda</label>
              <select id="s-unit" name="preorder_default_lead_time_unit" defaultValue={s.preorder_default_lead_time_unit ?? ""} className="field !py-2">
                <option value="">Não confirmada (encomendas bloqueadas)</option><option value="calendar_days">Dias corridos</option><option value="business_days">Dias úteis</option>
              </select>
              <p className="mt-1 text-xs text-ink-muted">Enquanto não confirmada, nenhum produto pode ser vendido sob encomenda.</p>
            </div>
            <I s={s} k="low_stock_threshold" label="Alerta de estoque baixo (un.)" type="number" min={0} />
          </div>
        </Panel>
        <Panel title="Pagamento (InfinitePay) e retirada">
          <div className="grid gap-3 md:grid-cols-3">
            <C s={s} k="payment_pix_enabled" label="Pix habilitado" />
            <I s={s} k="max_installments" label="Parcelas máximas exibidas" type="number" min={1} max={12} />
            <I s={s} k="assured_installments" label="Parcelas sem juros absorvidas pela loja" type="number" min={0} max={12} hint="0 = juros do parcelamento repassados à cliente (exige API Key)." />
            <C s={s} k="pickup_enabled" label="Oferecer retirada presencial" />
            <div className="md:col-span-2"><label className="label" htmlFor="s-pick">Instruções de retirada (endereço, horário)</label><textarea id="s-pick" name="pickup_instructions" defaultValue={s.pickup_instructions ?? ""} className="field" /></div>
          </div>
        </Panel>
        <Panel title="Liberação de vendas">
          <C s={s} k="checkout_enabled" label="Liberar compras pelo site (somente após concluir o checklist de lançamento)" />
        </Panel>
      </AdminForm>
      <Panel title="Feriados (para prazos em dias úteis)">
        <ul className="mb-3 grid gap-1 text-sm sm:grid-cols-2">{(holidays ?? []).map((h) => <li key={h.day} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-1.5"><span>{formatDateSP(`${h.day}T12:00:00Z`)} — {h.name} <span className="text-xs text-ink-muted">({h.scope})</span></span><form action={adminSaveHoliday}><input type="hidden" name="day" value={h.day} /><input type="hidden" name="remove" value="1" /><button className="text-xs text-danger underline">remover</button></form></li>)}</ul>
        <form action={adminSaveHoliday} className="flex flex-wrap items-end gap-2">
          <div><label className="label" htmlFor="h-d">Data</label><input id="h-d" type="date" name="day" className="field !py-2" required /></div>
          <div><label className="label" htmlFor="h-n">Nome</label><input id="h-n" name="name" className="field !py-2" required /></div>
          <div><label className="label" htmlFor="h-s">Abrangência</label><select id="h-s" name="scope" className="field !py-2"><option value="municipal">Municipal</option><option value="state">Estadual</option><option value="national">Nacional</option></select></div>
          <button className="btn-secondary !min-h-10">Adicionar</button>
        </form>
      </Panel>
    </div>
  );
}
