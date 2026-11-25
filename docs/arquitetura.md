# Arquitetura

## Visão geral

```
Navegador ──► Cloudflare Workers (Next.js via OpenNext)
                 │  ├─ páginas da loja (SSR) e /admin
                 │  ├─ server actions (carrinho, checkout, painel)
                 │  ├─ /api/webhooks/infinitepay  (webhook → reconsulta payment_check)
                 │  ├─ /api/cron/maintenance      (chamado pelo cron do Worker a cada 10 min)
                 │  └─ /api/events                (eventos de analytics com consentimento)
                 ▼
              Supabase (Postgres + Auth + Storage)
                 ├─ RLS forçada em todas as tabelas
                 ├─ view `catalog_products` para leitura pública do catálogo
                 └─ funções `svc_*` (somente service_role) para pedido, pagamento, estoque e encomendas
```

## Decisões

- **OpenNext (`@opennextjs/cloudflare`) em vez de vinext.** Em nov/2026 o vinext é a recomendação mais nova da Cloudflare, mas ainda está em beta. O OpenNext é estável, suporta Next.js 16 e é mantido pela Cloudflare. Quando o vinext sair do beta, migrar é uma troca de adaptador sem mudança de código de aplicação.
- **Páginas dinâmicas, sem cache ISR.** Preço, estoque e disponibilidade de encomenda mudam a qualquer momento e não podem aparecer desatualizados.
- **Regras de dinheiro e estoque no banco.** `svc_create_order` trava as linhas (`FOR UPDATE`, ordenado por id) e reserva estoque ou capacidade de encomenda de forma atômica, inclusive componentes de kits. Os testes de concorrência garantem que não há venda acima do disponível.
- **Pagamento confirmado só no servidor.** O retorno do checkout e o webhook nunca confirmam nada sozinhos: sempre chamamos `payment_check` da InfinitePay e conferimos o valor. `svc_confirm_payment` é idempotente.
- **Valores em centavos** (inteiros) e fuso `America/Sao_Paulo`. Dias úteis desconsideram fins de semana e a tabela `holidays`.
- **Admin com MFA obrigatório (TOTP).** `is_admin()` exige o papel em `user_roles` **e** sessão `aal2`.

## Encomendas

- Produto com `fulfillment_mode = accepts_preorder` pode ser vendido sem estoque até `preorder_max_quantity`.
- Pagamento integral na compra. O prazo de despacho (`dispatch_due_at`) é calculado na confirmação do pagamento com `compute_dispatch_due`.
- Prazo padrão: **20 dias corridos**, confirmado pela proprietária. Pode ser alterado por produto ou em Configurações. Se a unidade for apagada, produtos por encomenda deixam de ser vendidos até nova definição.
- Carrinho misto (pronta entrega + encomenda) é enviado em um único despacho, quando tudo estiver disponível. Isso é informado no carrinho e no checkout.
- Ao receber mercadoria (`svc_admin_receive_stock`), as unidades são alocadas por ordem de pagamento (FIFO).

## Pastas

- `src/app/(store)` loja · `src/app/admin` painel · `src/app/actions` server actions · `src/app/api` webhooks/cron/eventos
- `src/lib` regras de aplicação (frete, pagamentos, e-mail, catálogo, autenticação)
- `supabase/migrations` esquema, funções, RLS, dados de referência · `supabase/seed.sql` dados DEMO locais
- `tests/unit` e `tests/db`
