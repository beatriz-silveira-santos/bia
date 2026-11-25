# Supabase

> Criar o projeto, aplicar migrations ou alterar configurações de um projeto existente só com autorização da proprietária. O plano gratuito pausa projetos inativos; para a loja em produção recomenda-se o plano Pro (custo mensal, verificar preço atual no site da Supabase).

## Criar e ligar o projeto (quando autorizado)

1. Criar um projeto novo na região **São Paulo (sa-east-1)**.
2. `npx supabase login` e `npx supabase link --project-ref <ref>`.
3. `npx supabase db push` aplica as migrations de `supabase/migrations`. **Não** rode o `seed.sql` em produção.
4. Em Authentication:
   - Site URL: `https://biastoreimportados.com.br`
   - Redirect URLs: `https://biastoreimportados.com.br/**` e a URL de preview.
   - Confirmação de e-mail ligada; MFA TOTP ligado.
   - SMTP próprio (Brevo, ver `email.md`) para os e-mails de autenticação.
5. Copiar a URL do projeto e a chave *publishable* para as variáveis públicas e a chave *secret* para `wrangler secret put SUPABASE_SECRET_KEY` (ver `cloudflare.md`).

## Primeiro administrador

1. A proprietária cria a própria conta pela loja (`/cadastro`) e confirma o e-mail.
2. No SQL Editor do Supabase:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'EMAIL_DA_PROPRIETARIA';
```

3. Ela entra em `/admin/entrar` e cadastra o app autenticador (Google Authenticator, Authy, 1Password etc.). Sem o segundo fator o painel não abre.

## Segurança

- RLS ligada e **forçada** em todas as tabelas. Clientes só leem os próprios dados; o catálogo público é lido pela view `catalog_products`.
- Funções `svc_*` só podem ser executadas com a chave secreta, no servidor.
- Imagens: bucket `products` público para leitura, escrita apenas por administradores.

## Testes

`npx supabase start && npm run test:db` recria o banco local e testa RLS, concorrência de estoque, encomendas, cupons e pagamentos.
