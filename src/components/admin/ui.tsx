import Link from "next/link";
import { PERIODS } from "@/lib/admin";

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" | "danger" }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 ${tone === "danger" ? "border-danger/40" : tone === "warn" ? "border-warning/40" : "border-line"}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-sans text-base font-semibold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export function Table({ head, rows, empty = "Sem dados no período." }: { head: string[]; rows: React.ReactNode[][]; empty?: string }) {
  if (!rows.length) return <p className="text-sm text-ink-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">{head.map((h) => <th key={h} scope="col" className="py-2 pr-4 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line/60 last:border-0">{r.map((c, j) => <td key={j} className="py-2.5 pr-4 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function PeriodFilter({ base, current, extra = {} }: { base: string; current: string; extra?: Record<string, string> }) {
  const qs = (k: string) => new URLSearchParams({ ...extra, periodo: k }).toString();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIODS.map((p) => (
        <Link key={p.key} href={`${base}?${qs(p.key)}`} aria-current={current === p.key ? "true" : undefined} className={`rounded-full px-3 py-1.5 text-sm ${current === p.key ? "bg-ink text-ivory" : "border border-line bg-white hover:border-ink"}`}>{p.label}</Link>
      ))}
      <form action={base} className="flex items-center gap-1 text-sm">
        {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input type="hidden" name="periodo" value="custom" />
        <label className="sr-only" htmlFor="de">De</label><input id="de" type="date" name="de" className="rounded-lg border border-line px-2 py-1" />
        <label className="sr-only" htmlFor="ate">Até</label><input id="ate" type="date" name="ate" className="rounded-lg border border-line px-2 py-1" />
        <button className="rounded-full border border-line bg-white px-3 py-1.5">Aplicar</button>
      </form>
    </div>
  );
}

export function DemoTag() {
  if (process.env.APP_ENV === "production") return null;
  return <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ivory">Demonstração</span>;
}
