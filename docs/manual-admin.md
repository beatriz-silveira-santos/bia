# Manual do painel administrativo (`/admin`)

Acesso: e-mail + senha + código do app autenticador. Todas as ações ficam registradas no log de auditoria.

| Área | Para que serve |
| --- | --- |
| **Dashboard** | vendas, pedidos, ticket médio, encomendas no prazo e atrasadas, origem das vendas, por período |
| **Pedidos** | lista e detalhe; mudar status, informar rastreio, cancelar, marcar reembolso |
| **Encomendas** | itens vendidos por encomenda, prazo de despacho de cada pedido, atualizações de compra/chegada, alertas de prazo |
| **Produtos** | cadastro com fotos, preço, preço promocional, peso/medidas, modo de venda (pronta entrega, aceita encomenda, indisponível), limite e prazo de encomenda. Importação por CSV (`/modelo-importacao-produtos.csv`) |
| **Estoque** | ajuste manual com motivo e entrada de mercadoria (aloca automaticamente para encomendas pagas, por ordem de pagamento) |
| **Promoções** | cupons (valor ou %, mínimo, validade, limite de uso) |
| **Frete** | zonas de entrega local, retirada e instruções |
| **Avaliações** | moderar avaliações (só compradores com pedido entregue podem avaliar) |
| **Clientes** | lista de clientes e pedidos |
| **Marketing** | inscritos, consentimento, exportações |
| **Conteúdo** | textos de Sobre, políticas, trocas, privacidade etc. (rascunhos marcados [PENDENTE]) |
| **Configurações** | logo, banner, dados da empresa (CNPJ, endereço), unidade do prazo de encomenda, liberar checkout |
| **Lançamento** | checklist do que falta para abrir a loja |
| **Alertas** | divergências de pagamento, encomendas atrasadas, falhas de integração |

Exportações CSV: pedidos, itens, clientes, encomendas e inscritos, pelo botão "Exportar" de cada área.
