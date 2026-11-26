"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function AdminLoginForm() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const f = new FormData(e.currentTarget);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    setBusy(false);
    if (error) return setErr("Credenciais inválidas.");
    router.replace("/admin/mfa");
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div><label className="label" htmlFor="ae">E-mail</label><input id="ae" name="email" type="email" className="field" autoComplete="username" required /></div>
      <div><label className="label" htmlFor="ap">Senha</label><input id="ap" name="password" type="password" className="field" autoComplete="current-password" required /></div>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Entrando…" : "Continuar"}</button>
    </form>
  );
}

/** MFA por app autenticador (TOTP). Primeiro acesso: cadastro do fator; depois: verificação a cada login. */
export function MfaPanel() {
  const router = useRouter();
  const [state, setState] = useState<{ mode: "loading" | "enroll" | "verify"; factorId?: string; qr?: string; secret?: string }>({ mode: "loading" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) return setState({ mode: "verify", factorId: verified.id });
      // Remove cadastros incompletos anteriores antes de criar um novo
      for (const f of data?.all ?? []) if (f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
      const { data: en, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Bia Store ${new Date().toISOString().slice(0, 10)}` });
      if (error || !en) return setErr("Não foi possível iniciar o cadastro do autenticador.");
      setState({ mode: "enroll", factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret });
    })();
  }, []);
  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\D/g, "");
    const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId: state.factorId!, code });
    if (error) return setErr("Código inválido ou expirado.");
    router.replace("/admin");
    router.refresh();
  }
  if (state.mode === "loading") return <p role="status">Carregando…</p>;
  return (
    <div className="space-y-5">
      {state.mode === "enroll" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">Escaneie o QR code com um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password, Authy…). Ele passa a ser exigido em todo acesso ao painel.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {state.qr && <img src={state.qr} alt="QR code para cadastrar o autenticador" width={200} height={200} className="mx-auto rounded-xl bg-white p-2" />}
          <details className="text-sm"><summary className="cursor-pointer">Não consigo escanear</summary><p className="mt-2 break-all font-mono text-xs">{state.secret}</p></details>
        </div>
      )}
      <form onSubmit={verify} className="space-y-3">
        <label className="label" htmlFor="code">Código de 6 dígitos do autenticador</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" className="field text-center text-2xl tracking-[0.4em]" required autoFocus />
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button className="btn-primary w-full">Verificar</button>
      </form>
    </div>
  );
}
