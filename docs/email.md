# E-mail (Brevo)

Usado para: confirmação de conta e recuperação de senha (SMTP do Supabase), e-mails de pedido (criado, pago, enviado, atualização de encomenda) e newsletter com consentimento.

## Configuração

1. Conta Brevo (plano gratuito tem limite diário; verificar o limite atual).
2. Verificar o domínio `biastoreimportados.com.br` no Brevo.
3. DNS (somente com autorização): o Brevo fornece os registros exatos.
   - **SPF**: um único TXT `v=spf1 include:spf.brevo.com ~all` (mesclar com qualquer SPF existente; nunca dois registros SPF).
   - **DKIM**: registros fornecidos pelo Brevo.
   - **DMARC**: começar com `v=DMARC1; p=none; rua=mailto:<e-mail de relatórios>` e endurecer depois.
4. `EMAIL_PROVIDER=brevo`, `EMAIL_FROM` (ex.: `pedidos@biastoreimportados.com.br`) e `wrangler secret put BREVO_API_KEY`.
5. No Supabase → Authentication → SMTP, usar o SMTP do Brevo.

## Marketing e LGPD

- Inscrição só com opt-in explícito (checkbox não marcado por padrão), com registro de data, origem e texto aceito.
- Todo e-mail de marketing tem link de descadastro (`/descadastro`), que entra na lista de supressão.
- E-mails transacionais não dependem de consentimento de marketing.
