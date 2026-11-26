"use client";
import { useActionState } from "react";
import { importProducts, type ImportState } from "@/app/actions/import";

export function ImportForm() {
  const [s, a, p] = useActionState<ImportState, FormData>(importProducts, null);
  return (
    <form action={a} className="space-y-3">
      <label className="label" htmlFor="csv">Arquivo CSV (separado por ; ou ,)</label>
      <input id="csv" name="file" type="file" accept=".csv,text/csv" required className="block text-sm" />
      <button className="btn-primary !min-h-10" disabled={p}>{p ? "Importando…" : "Importar"}</button>
      {s && <div role="status" className={`rounded-xl p-3 text-sm ${s.ok ? "bg-success-bg text-success" : "bg-warning-bg"}`}><p>{s.message}</p>{s.errors?.length ? <ul className="mt-2 list-disc pl-5">{s.errors.slice(0, 50).map((e) => <li key={e}>{e}</li>)}</ul> : null}</div>}
    </form>
  );
}
