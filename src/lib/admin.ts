import "server-only";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Toda operação administrativa começa aqui: valida admin + MFA (aal2) e só então usa a chave de servidor. */
export async function adminContext() {
  const user = await requireAdmin();
  return { user, db: supabaseAdmin() };
}

export async function audit(actorId: string, action: string, entity: string, entityId: string | null, details: Record<string, unknown> = {}) {
  await supabaseAdmin().from("admin_audit_log").insert({ actor_id: actorId, action, entity, entity_id: entityId, details });
}

export type PeriodKey = "hoje" | "ontem" | "7d" | "30d" | "mes" | "mes-anterior" | "custom";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" }, { key: "ontem", label: "Ontem" }, { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" }, { key: "mes", label: "Mês atual" }, { key: "mes-anterior", label: "Mês anterior" },
];

/** Intervalo [from, to) em UTC calculado a partir de datas de São Paulo (UTC−3, sem horário de verão desde 2019). */
export function resolvePeriod(key: string | undefined, fromStr?: string, toStr?: string): { from: Date; to: Date; key: PeriodKey; label: string } {
  const spNow = new Date(Date.now() - 3 * 3600_000);
  const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 3)); // 00:00 SP
  const y = spNow.getUTCFullYear(), m = spNow.getUTCMonth(), d = spNow.getUTCDate();
  const today = day(y, m, d);
  const k = (PERIODS.find((p) => p.key === key)?.key ?? (key === "custom" ? "custom" : "30d")) as PeriodKey;
  switch (k) {
    case "hoje": return { from: today, to: new Date(today.getTime() + 86400_000), key: k, label: "Hoje" };
    case "ontem": return { from: new Date(today.getTime() - 86400_000), to: today, key: k, label: "Ontem" };
    case "7d": return { from: new Date(today.getTime() - 6 * 86400_000), to: new Date(today.getTime() + 86400_000), key: k, label: "Últimos 7 dias" };
    case "mes": return { from: day(y, m, 1), to: day(y, m + 1, 1), key: k, label: "Mês atual" };
    case "mes-anterior": return { from: day(y, m - 1, 1), to: day(y, m, 1), key: k, label: "Mês anterior" };
    case "custom": {
      const f = fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr) ? new Date(`${fromStr}T03:00:00Z`) : new Date(today.getTime() - 29 * 86400_000);
      const t = toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr) ? new Date(new Date(`${toStr}T03:00:00Z`).getTime() + 86400_000) : new Date(today.getTime() + 86400_000);
      return { from: f, to: t, key: k, label: "Período personalizado" };
    }
    default: return { from: new Date(today.getTime() - 29 * 86400_000), to: new Date(today.getTime() + 86400_000), key: "30d", label: "Últimos 30 dias" };
  }
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "﻿";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita injeção de fórmulas no Excel
    return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ";" como separador para abrir corretamente no Excel em português
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\r\n");
}

export const PAID_STATUSES = ["paid", "preparing", "awaiting_procurement", "procurement_received", "ready_to_ship", "shipped", "delivered"];
