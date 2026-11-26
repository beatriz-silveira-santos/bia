"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { subscribeNewsletter, type NewsletterState } from "@/app/actions/newsletter";
import { MARKETING_CONSENT_TEXT } from "@/lib/consent";
import { track } from "@/lib/analytics/client";

export function NewsletterForm({ source = "site", tone = "light" }: { source?: string; tone?: "light" | "blush" }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeNewsletter, null);
  useEffect(() => {
    if (state?.ok) track("newsletter_signup", { label: source });
  }, [state, source]);
  const id = `nl-${source}`;
  if (state?.ok) {
    return <p role="status" className="rounded-2xl bg-success-bg p-4 text-success">{state.message}</p>;
  }
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">Seu e-mail</label>
        <input id={`${id}-email`} name="email" type="email" required autoComplete="email" placeholder="Seu melhor e-mail" className={`field ${tone === "blush" ? "bg-porcelain" : ""}`} />
        <button type="submit" className="btn-primary shrink-0" disabled={pending}>{pending ? "Enviando…" : "Quero receber"}</button>
      </div>
      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" name="consent" className="mt-1 h-5 w-5 shrink-0 accent-ink" />
        <span>{MARKETING_CONSENT_TEXT} Veja a <Link className="underline underline-offset-4" href="/ajuda/politica-de-privacidade">Política de privacidade</Link>.</span>
      </label>
      {state && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
