# Backup, monitoramento e manutenção

## Backup

- Supabase Pro faz backup diário automático (retenção conforme o plano). Para mais segurança, exportar semanalmente: `npx supabase db dump --linked -f backup.sql` e guardar fora do Supabase.
- Imagens no Storage: baixar periodicamente o bucket `products`.
- O código fica no GitHub; segredos ficam somente no Cloudflare e no Supabase (guardar cópia num gerenciador de senhas da proprietária).

## Monitoramento

- Cloudflare → Workers → Observability: erros e logs (já ligado no `wrangler.jsonc`).
- Painel → Alertas: divergência de pagamento, encomendas perto do prazo ou atrasadas, falhas de frete/e-mail.
- Recomendado: monitor de disponibilidade externo (ex.: UptimeRobot) para a home e `/api/cron/maintenance` retornando 401 sem token.

## Manutenção

- Feriados: cadastrar os feriados de cada novo ano na tabela `holidays` (2026 e 2027 já incluídos; feriados municipais de São José do Rio Preto a confirmar).
- Atualizar dependências mensalmente com PR e CI verde.
- Revisar a política de privacidade quando mudar ferramentas de marketing.
