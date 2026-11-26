/* eslint-disable @typescript-eslint/ban-ts-comment */
// Entrada do Worker: reaproveita o handler gerado pelo OpenNext, registra falhas
// e adiciona a tarefa agendada (cron).
// @ts-ignore -- arquivo gerado no build (`opennextjs-cloudflare build`)
import { default as handler } from "./.open-next/worker.js";

interface Env {
  APP_ENV?: string;
  CRON_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}
interface Ctx {
  waitUntil(p: Promise<unknown>): void;
  passThroughOnException?(): void;
}

function descrever(e: unknown): string {
  if (e instanceof Error) {
    const causa = e.cause ? `\nCausa: ${e.cause instanceof Error ? `${e.cause.name}: ${e.cause.message}` : String(e.cause)}` : "";
    return `${e.name}: ${e.message}${causa}\n${e.stack ?? "(sem pilha)"}`;
  }
  return String(e);
}

const worker = {
  // Sem este try/catch, qualquer falha vira a tela "Error 1101" do Cloudflare,
  // que não diz nada a quem está comprando nem a quem precisa consertar.
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    try {
      return await handler.fetch(request, env, ctx);
    } catch (e) {
      const caminho = new URL(request.url).pathname;
      const detalhe = descrever(e);
      console.error(`Falha ao responder ${request.method} ${caminho}: ${detalhe}`);
      const corpo =
        env.APP_ENV === "preview"
          ? `Erro ao montar a página ${caminho}\n\n${detalhe}\n`
          : "Tivemos um problema para montar esta página. Tente de novo em instantes.\n";
      return new Response(corpo, {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
  },
  // A tarefa periódica usa uma requisição de verdade ao endereço público, em vez de
  // chamar o handler com um Request sintético: um Request montado à mão não traz os
  // dados que o runtime anexa (request.cf), e a falha daí vinha como exceção solta,
  // que o Cloudflare mostra como "Error 1101" nas visitas seguintes.
  async scheduled(_event: unknown, env: Env, ctx: Ctx) {
    if (!env.CRON_SECRET || !env.NEXT_PUBLIC_SITE_URL) return;
    const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    ctx.waitUntil(
      (async () => {
        try {
          const res = await fetch(`${base}/api/cron/maintenance`, {
            method: "POST",
            headers: { authorization: `Bearer ${env.CRON_SECRET}` },
          });
          if (!res.ok) console.error(`Tarefa agendada respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
        } catch (e) {
          console.error(`Falha na tarefa agendada: ${descrever(e)}`);
        }
      })(),
    );
  },
};
export default worker;
