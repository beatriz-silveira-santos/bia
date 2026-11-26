"use client";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthState } from "@/app/actions/auth";

function Msg({ s }: { s: AuthState }) {
  if (!s) return null;
  return <p role={s.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${s.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{s.message}</p>;
}

export function SignInForm({ next }: { next: string }) {
  const [s, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div><label className="label" htmlFor="email">E-mail</label><input className="field" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div><label className="label" htmlFor="password">Senha</label><input className="field" id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <Msg s={s} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
      <p className="text-center text-sm"><Link href="/recuperar-senha" className="underline underline-offset-4">Esqueci minha senha</Link></p>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [s, action, pending] = useActionState(signUp, null);
  if (s?.ok) return <Msg s={s} />;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div><label className="label" htmlFor="full_name">Nome completo</label><input className="field" id="full_name" name="full_name" autoComplete="name" required /></div>
      <div><label className="label" htmlFor="su-email">E-mail</label><input className="field" id="su-email" name="email" type="email" autoComplete="email" required /></div>
      <div><label className="label" htmlFor="phone">Celular (opcional)</label><input className="field" id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(17) 99999-9999" /></div>
      <div>
        <label className="label" htmlFor="su-password">Senha</label>
        <input className="field" id="su-password" name="password" type="password" autoComplete="new-password" minLength={8} required aria-describedby="pw-hint" />
        <p id="pw-hint" className="mt-1 text-xs text-ink-muted">Mínimo de 8 caracteres.</p>
      </div>
      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" name="terms" required className="mt-1 h-5 w-5 shrink-0 accent-ink" />
        <span>Li e aceito os <Link href="/ajuda/termos-de-uso" className="underline">Termos de uso e compra</Link> e a <Link href="/ajuda/politica-de-privacidade" className="underline">Política de privacidade</Link>.</span>
      </label>
      <p className="text-xs text-ink-muted">Criar conta não inscreve você em e-mails promocionais. Você pode escolher isso depois em “Minha conta”.</p>
      <Msg s={s} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Criando…" : "Criar conta"}</button>
    </form>
  );
}

export function ResetForm() {
  const [s, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="r-email">E-mail da conta</label><input className="field" id="r-email" name="email" type="email" autoComplete="email" required /></div>
      <Msg s={s} />
      <button className="btn-primary w-full" disabled={pending}>Enviar link</button>
    </form>
  );
}

export function NewPasswordForm() {
  const [s, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="np">Nova senha</label><input className="field" id="np" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
      <div><label className="label" htmlFor="npc">Confirme a nova senha</label><input className="field" id="npc" name="confirm" type="password" autoComplete="new-password" minLength={8} required /></div>
      <Msg s={s} />
      {s?.ok ? <Link href="/conta" className="btn-primary w-full">Ir para minha conta</Link> : <button className="btn-primary w-full" disabled={pending}>Salvar nova senha</button>}
    </form>
  );
}
