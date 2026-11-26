"use client";
import { useActionState } from "react";
import { createSupportRequest, updateMarketingPreference, updateProfile, type FormState } from "@/app/actions/account";
import { submitReview, type ReviewState } from "@/app/actions/reviews";
import { MARKETING_CONSENT_TEXT } from "@/lib/consent";

const Msg = ({ s }: { s: FormState | ReviewState }) => (s ? <p role={s.ok ? "status" : "alert"} className={`text-sm ${s.ok ? "text-success" : "text-danger"}`}>{s.message}</p> : null);

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [s, a, p] = useActionState(updateProfile, null);
  return (
    <form action={a} className="space-y-3">
      <div><label className="label" htmlFor="pf-name">Nome</label><input className="field" id="pf-name" name="full_name" defaultValue={name} required /></div>
      <div><label className="label" htmlFor="pf-phone">Telefone</label><input className="field" id="pf-phone" name="phone" type="tel" defaultValue={phone} /></div>
      <Msg s={s} />
      <button className="btn-secondary" disabled={p}>Salvar</button>
    </form>
  );
}

export function MarketingForm({ subscribed }: { subscribed: boolean }) {
  const [s, a, p] = useActionState(updateMarketingPreference, null);
  return (
    <form action={a} className="space-y-3">
      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" name="marketing" defaultChecked={subscribed} className="mt-1 h-5 w-5 shrink-0 accent-ink" />
        <span>{MARKETING_CONSENT_TEXT}</span>
      </label>
      <Msg s={s} />
      <button className="btn-secondary" disabled={p}>Salvar preferência</button>
    </form>
  );
}

export function SupportForm({ orderId }: { orderId?: string }) {
  const [s, a, p] = useActionState(createSupportRequest, null);
  if (s?.ok) return <Msg s={s} />;
  return (
    <form action={a} className="space-y-3">
      {orderId && <input type="hidden" name="order_id" value={orderId} />}
      <div><label className="label" htmlFor="sp-subj">Assunto</label><input className="field" id="sp-subj" name="subject" required maxLength={200} /></div>
      <div><label className="label" htmlFor="sp-msg">Mensagem</label><textarea className="field min-h-28" id="sp-msg" name="message" required maxLength={4000} /></div>
      <Msg s={s} />
      <button className="btn-secondary" disabled={p}>Enviar solicitação</button>
    </form>
  );
}

export function ReviewForm({ productId, orderId, productName }: { productId: string; orderId: string; productName: string }) {
  const [s, a, p] = useActionState(submitReview, null);
  if (s?.ok) return <Msg s={s} />;
  return (
    <form action={a} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="orderId" value={orderId} />
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Sua nota para {productName}</legend>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex min-h-11 items-center gap-1 text-sm"><input type="radio" name="rating" value={n} required className="h-5 w-5 accent-ink" /> {n}★</label>
          ))}
        </div>
      </fieldset>
      <label className="label" htmlFor={`rv-${productId}`}>Comentário (opcional)</label>
      <textarea className="field min-h-20" id={`rv-${productId}`} name="comment" maxLength={2000} />
      <Msg s={s} />
      <button className="btn-secondary !min-h-10" disabled={p}>Enviar avaliação</button>
    </form>
  );
}
