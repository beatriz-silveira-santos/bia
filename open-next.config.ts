import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sem cache incremental (ISR) por padrão: as páginas são renderizadas por requisição,
// lendo o catálogo do Supabase. Isso evita criar R2/KV adicionais. Se o tráfego crescer,
// avaliar R2 incremental cache (ver docs/arquitetura.md).
export default defineCloudflareConfig({});
