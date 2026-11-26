"use client";
import { useActionState } from "react";
import type { AdminState } from "@/app/actions/admin";

/** Formulário administrativo com feedback acessível. */
export function AdminForm({ action, children, submit = "Salvar", className = "space-y-4", danger = false }: {
  action: (s: AdminState, f: FormData) => Promise<AdminState>; children: React.ReactNode; submit?: string; className?: string; danger?: boolean;
}) {
  const [s, a, pending] = useActionState(action, null);
  return (
    <form action={a} className={className}>
      {children}
      {s && <p role={s.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-sm ${s.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{s.message}</p>}
      <button className={danger ? "btn !min-h-10 bg-danger text-white" : "btn-primary !min-h-10"} disabled={pending}>{pending ? "Salvando…" : submit}</button>
    </form>
  );
}
