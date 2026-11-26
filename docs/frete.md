# Frete

A loja **nunca** mostra preço de frete inventado. Se nenhum provedor estiver configurado ou a cotação falhar, o cliente vê a mensagem de indisponibilidade e o link do WhatsApp.

- CEP de origem: **15054-160** (São José do Rio Preto/SP).
- Prazo de preparo: até **3 dias úteis**, somado ao prazo da transportadora.
- Sem frete grátis.
- Entrega local e retirada: configuráveis em **Painel → Frete** (zonas por faixa de CEP, valor e prazo definidos pela proprietária).

## Opção 1 — Correios (com contrato)

Requer contrato com os Correios e acesso ao portal CWS (cws.correios.com.br).

| Variável | Origem |
| --- | --- |
| `SHIPPING_PROVIDER=correios` | |
| `CORREIOS_USER` | usuário do Meu Correios |
| `CORREIOS_ACCESS_CODE` (segredo) | código de acesso gerado no CWS |
| `CORREIOS_CONTRACT`, `CORREIOS_POSTCARD` | número do contrato e do cartão de postagem |
| `CORREIOS_SERVICES` | códigos de serviço do contrato (padrão `03220` SEDEX, `03298` PAC — **confirmar** os do seu contrato) |

## Opção 2 — Melhor Envio (sem contrato)

Agregador com preços negociados de várias transportadoras, sem contrato próprio.

| Variável | Origem |
| --- | --- |
| `SHIPPING_PROVIDER=melhorenvio` | |
| `MELHORENVIO_TOKEN` (segredo) | token gerado em Melhor Envio → Integrações → Permissões de acesso |
| `MELHORENVIO_SANDBOX` | `true` para testes, `false` em produção |
| `MELHORENVIO_USER_AGENT` | "Bia Store Importados (e-mail de contato técnico)" — exigido pelo Melhor Envio |

## Embalagem

Peso e dimensões vêm de cada produto (cadastro obrigatório para produtos vendáveis). As cotações valem por 2 horas e ficam ligadas ao conteúdo do carrinho: se o carrinho mudar, o frete é recalculado.
