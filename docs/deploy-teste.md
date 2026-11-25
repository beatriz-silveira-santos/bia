# Versão de teste (contas próprias da proprietária)

Publica a loja em `https://biastore-preview.<subdominio>.workers.dev`, usando **somente** a conta Cloudflare e o projeto Supabase da proprietária. Nenhum domínio ou DNS é alterado. O checkout fica desligado (Configurações → Checkout habilitado = não).

A publicação só acontece quando a proprietária clica em **Actions → Publicar versão de teste → Run workflow**.

## 1. Supabase (projeto de teste)

1. No painel do Supabase, crie um projeto (região São Paulo). Anote a senha do banco.
2. Em *Project Settings → API*, copie: a URL do projeto, a chave **publishable** e a chave **secret**.
3. Em *Account → Access Tokens*, gere um token para o GitHub.
4. Em *Authentication → URL Configuration*, coloque a URL do teste (passo 2.3) em Site URL e em Redirect URLs (`<url>/**`).

## 2. Cloudflare

1. Em *Workers & Pages*, confira seu subdomínio `*.workers.dev` (ex.: `bia.workers.dev`).
2. Em *My Profile → API Tokens → Create Token*, use o modelo **Edit Cloudflare Workers** limitado à sua conta.
3. A URL do teste será `https://biastore-preview.<seu-subdominio>.workers.dev`.
4. Copie o **Account ID** (barra lateral da página inicial da conta).

## 3. GitHub (onde as chaves ficam guardadas)

No repositório: *Settings → Environments → New environment* com o nome **`teste`**. Dentro dele:

**Secrets** (valores secretos, ninguém consegue ler depois):

| Nome | Valor |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | token do passo 2.2 |
| `SUPABASE_ACCESS_TOKEN` | token do passo 1.3 |
| `TESTE_SUPABASE_DB_PASSWORD` | senha do banco (1.1) |
| `TESTE_SUPABASE_SECRET_KEY` | chave secret (1.2) |
| `TESTE_CRON_SECRET` | um texto aleatório longo (ex.: gerado por um gerenciador de senhas, 40+ caracteres) |

**Variables** (não secretas):

| Nome | Valor |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID (2.4) |
| `TESTE_SITE_URL` | URL do teste (2.3) |
| `TESTE_SUPABASE_URL` | URL do projeto (1.2) |
| `TESTE_SUPABASE_PUBLISHABLE_KEY` | chave publishable (1.2) |
| `TESTE_SUPABASE_PROJECT_REF` | o código do projeto (o trecho antes de `.supabase.co` na URL) |

Nunca envie esses valores por chat, e-mail ou issue.

## 4. Publicar

*Actions → Publicar versão de teste → Run workflow*. Ao final, abra a URL do teste. Para virar administradora, siga "Primeiro administrador" em `supabase.md`.

## Endereço castelan.adv.br/biastore (opcional)

Um caminho dentro de castelan.adv.br só pode apontar para esta loja se **o administrador do castelan.adv.br** configurar, no lado dele, um encaminhamento (proxy reverso) de `/biastore/*` para a URL do teste, e a loja for compilada com o prefixo `/biastore`. As contas continuam separadas, mas a configuração depende dele.
