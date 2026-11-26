# Domínio e DNS — biastoreimportados.com.br

> **Nenhuma alteração de DNS sem autorização explícita da proprietária.** Antes de mudar, exporte os registros atuais (principalmente MX e TXT de e-mail) para não derrubar e-mails existentes.

## Passos (quando autorizado)

1. Confirmar onde o domínio está registrado (Registro.br) e onde o DNS é gerenciado hoje.
2. Se o DNS for para a Cloudflare: adicionar o site no painel, conferir que **todos** os registros atuais foram importados, e só então trocar os servidores DNS no Registro.br.
3. Ativar as rotas em `wrangler.jsonc` (`env.production.routes`, custom domain para o domínio raiz e `www`). O `www` é redirecionado para o domínio sem `www` pelo `proxy.ts`.
4. SSL/TLS em modo **Full (strict)**; "Always Use HTTPS" ligado.
5. Registros de e-mail (SPF, DKIM, DMARC) conforme `email.md`.
6. Atualizar Site URL e Redirect URLs no Supabase.
