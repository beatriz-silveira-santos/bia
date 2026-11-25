# Meta (Instagram/Facebook) e WhatsApp

## WhatsApp

- Link direto `https://wa.me/5517992066575` com mensagem pré-preenchida (produto ou pedido), nos produtos, carrinho, rodapé e `/instagram`.
- Checklist:
  - [ ] Confirmar que o número é WhatsApp Business e qual horário de atendimento divulgar.
  - [ ] Revisar as mensagens pré-preenchidas.

## Página `/instagram`

Página de links para a bio do Instagram, mobile-first, com destaques, categorias e WhatsApp. Links levam parâmetros UTM para medir a origem.

## Meta Pixel e Conversions API (opcional)

Só disparam com consentimento de marketing no banner de cookies.

- [ ] Criar/escolher o Business Manager e o Pixel; informar o ID em `NEXT_PUBLIC_META_PIXEL_ID` (não é segredo).
- [ ] Gerar o token da Conversions API e cadastrar com `wrangler secret put META_CAPI_TOKEN`.
- [ ] Verificar o domínio no Business Manager (registro TXT no DNS, com autorização).
- [ ] Catálogo do Instagram Shopping: feed de produtos a ser ligado na fase de marketing.
