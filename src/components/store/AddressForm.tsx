"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { cepLookupAction, saveAddress, type FormState } from "@/app/actions/account";

export interface AddressRow { id: string; label: string | null; recipient_name: string; phone: string | null; cep: string; street: string; number: string; complement: string | null; neighborhood: string; city: string; state: string }

export function AddressForm({ initial, defaultName, onSaved }: { initial?: Partial<AddressRow>; defaultName?: string; onSaved?: (id: string) => void }) {
  const [s, action, pending] = useActionState<FormState, FormData>(saveAddress, null);
  const [addr, setAddr] = useState({ street: initial?.street ?? "", neighborhood: initial?.neighborhood ?? "", city: initial?.city ?? "", state: initial?.state ?? "" });
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (s?.ok && s.id && notified.current !== s.id) {
      notified.current = s.id;
      onSaved?.(s.id);
    }
  }, [s, onSaved]);

  async function onCepBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "");
    if (v.length !== 8) return;
    const r = await cepLookupAction(v);
    if (r) setAddr((a) => ({ street: a.street || r.street, neighborhood: a.neighborhood || r.neighborhood, city: r.city || a.city, state: r.state || a.state }));
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-6">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="sm:col-span-4"><label className="label" htmlFor="a-name">Nome de quem recebe</label><input className="field" id="a-name" name="recipient_name" defaultValue={initial?.recipient_name ?? defaultName} autoComplete="name" required /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="a-phone">Telefone</label><input className="field" id="a-phone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} autoComplete="tel" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="a-cep">CEP</label><input className="field" id="a-cep" name="cep" inputMode="numeric" defaultValue={initial?.cep ?? ""} autoComplete="postal-code" onBlur={onCepBlur} required /></div>
      <div className="sm:col-span-4"><label className="label" htmlFor="a-street">Rua</label><input className="field" id="a-street" name="street" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} autoComplete="address-line1" required /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="a-number">Número</label><input className="field" id="a-number" name="number" defaultValue={initial?.number ?? ""} required /></div>
      <div className="sm:col-span-4"><label className="label" htmlFor="a-comp">Complemento</label><input className="field" id="a-comp" name="complement" defaultValue={initial?.complement ?? ""} autoComplete="address-line2" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="a-nb">Bairro</label><input className="field" id="a-nb" name="neighborhood" value={addr.neighborhood} onChange={(e) => setAddr({ ...addr, neighborhood: e.target.value })} required /></div>
      <div className="sm:col-span-3"><label className="label" htmlFor="a-city">Cidade</label><input className="field" id="a-city" name="city" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} autoComplete="address-level2" required /></div>
      <div className="sm:col-span-1"><label className="label" htmlFor="a-uf">UF</label><input className="field uppercase" id="a-uf" name="state" maxLength={2} value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value.toUpperCase() })} autoComplete="address-level1" required /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="a-label">Apelido (opcional)</label><input className="field" id="a-label" name="label" placeholder="Casa, trabalho…" defaultValue={initial?.label ?? ""} /></div>
      {s && <p role={s.ok ? "status" : "alert"} className={`sm:col-span-6 text-sm ${s.ok ? "text-success" : "text-danger"}`}>{s.message}</p>}
      <div className="sm:col-span-6"><button className="btn-secondary" disabled={pending}>{pending ? "Salvando…" : "Salvar endereço"}</button></div>
    </form>
  );
}
