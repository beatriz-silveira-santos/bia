# InfinitePay — Checkout Integrado

## Como funciona na loja

1. O cliente revisa o pedido e confirma. O servidor cria o pedido (`pending_payment`), reserva estoque e chama `POST https://api.checkout.infinitepay.io/links` com os itens, o frete e `order_nsu` = número do pedido.
2. O cliente paga na página da InfinitePay (Pix ou cartão em até 12x, juros do parcelamento pagos pelo cliente, conforme a configuração da conta InfinitePay).
3. A confirmação vem de dois caminhos, ambos verificados com `POST /payment_check` antes de qualquer mudança:
   - o retorno do navegador em `/pedido/retorno`;
   - o webhook `POST /api/webhooks/infinitepay`.
4. `svc_confirm_payment` é idempotente e confere o valor pago; divergências viram alerta no painel.
5. Pedidos não pagos expiram e liberam o estoque (cron a cada 10 min).

O webhook da InfinitePay não é assinado; por isso ele nunca é tratado como prova de pagamento.

## Configuração

- `INFINITEPAY_HANDLE`: InfiniteTag da conta (sem `$`). Não é segredo.
- `INFINITEPAY_API_KEY`: segredo, cadastrado com `wrangler secret put`. Necessário para limitar métodos e parcelas.
- O checkout só é liberado quando **Configurações → Checkout habilitado** for ligado pela proprietária, após o checklist de lançamento.
- Taxas e juros: são os da conta InfinitePay da proprietária. A loja não inventa nem calcula taxas; mostra as condições que a InfinitePay devolver.

## Teste real (somente com autorização expressa)

1. Ambiente de preview com as credenciais reais e um produto de teste de valor baixo, oculto do catálogo.
2. A proprietária autoriza a data, o valor e o meio (Pix primeiro).
3. Fazer a compra, conferir: status "pago" no painel, e-mail ao cliente, baixa de estoque, valor recebido na conta InfinitePay.
4. Testar reembolso pelo app InfinitePay e marcar "reembolsado" no painel.
5. Desativar o produto de teste.
