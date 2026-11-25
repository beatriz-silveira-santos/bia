/* eslint-disable @typescript-eslint/ban-ts-comment */
// Entrada do Worker: reaproveita o handler gerado pelo OpenNext e adiciona o cron.
// @ts-ignore -- arquivo gerado no build (`opennextjs-cloudflare build`)
import { default as handler } from "./.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

const worker = {
  fetch: handler.fetch,
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (!env.CRON_SECRET) return;
    const req = new Request(`${env.NEXT_PUBLIC_SITE_URL ?? "https://localhost"}/api/cron/maintenance`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
};
export default worker;
