# Bia Store Importados — loja virtual

Loja própria da Bia Store Importados (perfumes, skincare e cabelos importados), com catálogo, conta de cliente, carrinho, checkout InfinitePay (Pix e cartão em até 12x), frete real (Correios ou Melhor Envio), venda por encomenda, painel administrativo com MFA e página de links para o Instagram (`/instagram`).

**Stack:** Next.js 16 (App Router) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, RLS) · Cloudflare Workers via OpenNext · GitHub Actions.

## Rodando localmente

Pré-requisitos: Node 22, Docker.

```bash
npm ci
npx supabase start          # sobe Postgres/Auth/Storage locais, aplica migrations e seed de DEMONSTRAÇÃO
cp .env.example .env.local  # preencha com os valores que `npx supabase status` mostrar
npm run dev                 # http://localhost:3000
```

O seed local cria produtos marcados **[DEMO]** apenas para desenvolvimento. Ele nunca é aplicado em produção.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint e TypeScript |
| `npm test` | testes unitários (sem banco) |
| `npm run test:db` | testes de banco: RLS, estoque, encomendas, pagamentos (requer `supabase start`) |
| `npm run build` | build Next.js |
| `npm run cf:build` / `npm run cf:preview` | build e prévia local no runtime do Cloudflare Workers |

## Documentação

- [Arquitetura e decisões](docs/arquitetura.md)
- [Supabase: projeto, migrations, primeiro administrador](docs/supabase.md)
- [Cloudflare Workers: deploy e segredos](docs/cloudflare.md)
- [Domínio e DNS](docs/dominio-dns.md)
- [InfinitePay](docs/infinitepay.md)
- [Frete: Correios ou Melhor Envio](docs/frete.md)
- [E-mail: Brevo, SPF, DKIM, DMARC](docs/email.md)
- [Meta (Instagram/Facebook) e WhatsApp](docs/meta-whatsapp.md)
- [Manual do painel administrativo](docs/manual-admin.md)
- [Backup, monitoramento e manutenção](docs/operacao.md)
- [Pendências que dependem da proprietária](docs/pendencias.md)

## Regras do projeto

- Nenhum segredo no repositório, em issues, no frontend ou em conversas. Segredos ficam no Cloudflare (`wrangler secret put`) e no Supabase.
- Nada de dados inventados: preços, estoque, prazos, CNPJ, endereço, políticas e avaliações vêm da proprietária pelo painel.
- DNS, publicação em produção, transações reais e alterações em recursos existentes do Cloudflare/Supabase só com autorização explícita da proprietária.
