import "server-only";

/**
 * Limite simples por janela. Em produção recomenda-se somar a regra de Rate Limiting do
 * Cloudflare (WAF) nas rotas /api/*, /entrar e /cadastro. Este limitador em memória protege
 * cada instância do Worker contra rajadas.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= max;
}
