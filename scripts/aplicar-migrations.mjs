#!/usr/bin/env node
// Aplica as migrations do Supabase pela Management API (HTTPS), sem precisar de
// conexão direta ao Postgres. O GitHub Actions não tem IPv6 e o pooler exige a
// senha do banco; a API precisa apenas do SUPABASE_ACCESS_TOKEN.
// Uso: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/aplicar-migrations.mjs
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
if (!TOKEN || !REF) {
  console.error("Faltam SUPABASE_ACCESS_TOKEN e/ou SUPABASE_PROJECT_REF.");
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}`;
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

/** @param {string} path @param {RequestInit} init */
async function api(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

function mensagem(body) {
  if (!body) return "";
  if (typeof body === "string") return body.slice(0, 500);
  return String(body.message ?? body.error ?? JSON.stringify(body)).slice(0, 500);
}

const locais = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => {
    const m = /^(\d+)_(.+)\.sql$/.exec(f);
    if (!m) throw new Error(`Nome de migration inesperado: ${f}`);
    return { arquivo: f, version: m[1], name: m[2], sql: readFileSync(join(dir, f), "utf8") };
  });

const hist = await api("/database/migrations");
if (!hist.ok) {
  console.error(`Não consegui ler o histórico de migrations (HTTP ${hist.status}): ${mensagem(hist.body)}`);
  if (hist.status === 401) console.error("O SUPABASE_ACCESS_TOKEN foi recusado. Gere outro em Supabase → Account → Access Tokens.");
  process.exit(1);
}
const aplicadas = Array.isArray(hist.body) ? hist.body : (hist.body?.migrations ?? []);
const nomes = new Set(aplicadas.map((m) => m.name).filter(Boolean));
const versoes = new Set(aplicadas.map((m) => m.version).filter(Boolean));
console.log(`Migrations já aplicadas no projeto: ${aplicadas.length ? [...nomes].join(", ") : "nenhuma"}`);

const pendentes = locais.filter((m) => !nomes.has(m.name) && !versoes.has(m.version));
if (!pendentes.length) {
  console.log("Banco já está em dia.");
  process.exit(0);
}

for (const m of pendentes) {
  process.stdout.write(`Aplicando ${m.arquivo} ... `);
  let r = await api("/database/migrations", {
    method: "POST",
    headers: { "Idempotency-Key": `${REF}:${m.version}` },
    body: JSON.stringify({ name: m.name, query: m.sql }),
  });
  if (!r.ok && (r.status === 404 || r.status === 400)) {
    // Alguns projetos não expõem o endpoint de migrations: executa o SQL e registra o histórico.
    const exec = await api("/database/query", { method: "POST", body: JSON.stringify({ query: m.sql }) });
    if (exec.ok) {
      await api("/database/migrations", {
        method: "PUT",
        headers: { "Idempotency-Key": `${REF}:${m.version}` },
        body: JSON.stringify({ name: m.name, query: m.sql }),
      });
      r = exec;
    } else {
      r = exec;
    }
  }
  if (!r.ok) {
    console.log("falhou");
    console.error(`HTTP ${r.status}: ${mensagem(r.body)}`);
    process.exit(1);
  }
  console.log("ok");
}
console.log(`${pendentes.length} migration(s) aplicada(s).`);
