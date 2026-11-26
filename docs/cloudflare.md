# Cloudflare Workers

> Criar Workers, cadastrar segredos, ligar domínio ou publicar em produção só com autorização da proprietária. O plano Workers Paid (custo mensal baixo, verificar valor atual) é recomendado pelo limite de CPU por requisição.

## Ambientes (`wrangler.jsonc`)

| Ambiente | Worker | URL |
| --- | --- | --- |
| preview | `biastore-preview` | `*.workers.dev` (para revisão) |
| production | `biastore-production` | `biastoreimportados.com.br` (rotas comentadas até autorização) |

## Segredos

Segredos **nunca** vão para o repositório nem para conversas. Quem tem acesso à conta Cloudflare cadastra, no terminal:

```bash
npx wrangler login
npx wrangler secret put SUPABASE_SECRET_KEY --env production
npx wrangler secret put INFINITEPAY_API_KEY --env production
npx wrangler secret put CRON_SECRET --env production      # gere com: openssl rand -hex 32
# conforme os serviços contratados:
npx wrangler secret put CORREIOS_ACCESS_CODE --env production
npx wrangler secret put MELHORENVIO_TOKEN --env production
npx wrangler secret put BREVO_API_KEY --env production
npx wrangler secret put META_CAPI_TOKEN --env production
npx wrangler secret put TURNSTILE_SECRET_KEY --env production
```

Valores não secretos (ex.: `INFINITEPAY_HANDLE`, `SHIPPING_PROVIDER`, `EMAIL_FROM`, `CORREIOS_CONTRACT`) ficam em `vars` no `wrangler.jsonc`. Variáveis `NEXT_PUBLIC_*` precisam existir **no momento do build**.

## Deploy

```bash
npm run cf:build
npx wrangler deploy --env preview       # revisão
npx wrangler deploy --env production    # somente com autorização
```

## Cron

O `worker.ts` executa a cada 10 minutos `POST /api/cron/maintenance` com `Authorization: Bearer CRON_SECRET`: expira pedidos não pagos e libera reservas, e gera alertas de prazo de encomenda.
