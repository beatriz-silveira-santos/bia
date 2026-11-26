"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parseConsentRaw, useConsentRaw } from "@/lib/analytics/consent-store";

type Consent = { analytics: boolean; marketing: boolean; v: number };
const COOKIE = "bs_consent";

function write(c: Consent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(c))}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("bs-consent", { detail: c }));
}

export function CookieBanner() {
  const raw = useConsentRaw();
  const [reopened, setReopened] = useState(false);
  const [custom, setCustom] = useState(false);
  const current = parseConsentRaw(raw);
  const [analytics, setAnalytics] = useState<boolean | null>(null);
  const [marketing, setMarketing] = useState<boolean | null>(null);

  useEffect(() => {
    const reopen = () => {
      setCustom(true);
      setReopened(true);
    };
    window.addEventListener("bs-open-consent", reopen);
    return () => window.removeEventListener("bs-open-consent", reopen);
  }, []);

  // raw === null: ainda hidratando; "" = sem escolha registrada
  const open = reopened || raw === "";
  if (!open) return null;
  const save = (c: Omit<Consent, "v">) => {
    write({ ...c, v: 1 });
    setReopened(false);
    if ((current.analytics && !c.analytics) || (current.marketing && !c.marketing)) location.reload();
  };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookie-title" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-3xl border border-line bg-porcelain p-5 shadow-[var(--shadow-lift)] sm:p-6">
      <h2 id="cookie-title" className="font-display text-xl">Sua privacidade</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Usamos cookies essenciais para login, carrinho e segurança. Com sua permissão, usamos também cookies de medição
        (para entender o uso do site) e de marketing (para anúncios). Saiba mais na <Link href="/ajuda/politica-de-cookies" className="underline underline-offset-4">Política de cookies</Link>.
      </p>
      {custom && (
        <fieldset className="mt-4 space-y-3 text-sm">
          <legend className="sr-only">Preferências de cookies</legend>
          <label className="flex items-start gap-3"><input type="checkbox" checked disabled className="mt-1 h-5 w-5 accent-ink" /> <span><strong>Essenciais</strong> — sempre ativos.</span></label>
          <label className="flex items-start gap-3"><input type="checkbox" checked={analytics ?? current.analytics} onChange={(e) => setAnalytics(e.target.checked)} className="mt-1 h-5 w-5 accent-ink" /> <span><strong>Medição</strong> — Google Analytics e estatísticas próprias de visitas e origem.</span></label>
          <label className="flex items-start gap-3"><input type="checkbox" checked={marketing ?? current.marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 h-5 w-5 accent-ink" /> <span><strong>Marketing</strong> — Meta Pixel para anúncios no Instagram/Facebook.</span></label>
        </fieldset>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {custom ? (
          <button type="button" className="btn-primary" onClick={() => save({ analytics: analytics ?? current.analytics, marketing: marketing ?? current.marketing })}>Salvar preferências</button>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={() => save({ analytics: true, marketing: true })}>Aceitar todos</button>
            <button type="button" className="btn-secondary" onClick={() => save({ analytics: false, marketing: false })}>Somente essenciais</button>
            <button type="button" className="btn text-ink-soft underline underline-offset-4" onClick={() => setCustom(true)}>Personalizar</button>
          </>
        )}
      </div>
    </div>
  );
}

export function CookiePreferencesButton() {
  return (
    <button type="button" className="text-left hover:text-ink" onClick={() => window.dispatchEvent(new Event("bs-open-consent"))}>
      Preferências de cookies
    </button>
  );
}
