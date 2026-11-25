# Pendências que dependem da proprietária

Nada aqui bloqueia o desenvolvimento; cada item vira campo no painel ou etapa do checklist de lançamento.

## Dados da loja (Painel → Configurações / Conteúdo)
- [ ] Logo oficial em alta resolução (PNG/SVG) — a loja mostra o nome em texto até lá.
- [ ] Fotos para banner e categorias.
- [ ] Razão social, CNPJ, endereço e e-mail de contato.
- [x] Unidade do prazo de encomenda: **20 dias corridos** (confirmado em 25/11/2026; já é o padrão do banco).
- [ ] Textos finais: Sobre, Trocas e devoluções, Política de privacidade, Termos, Entrega, Encomendas.
- [ ] Horário de atendimento do WhatsApp; zonas, valores e prazos de entrega local e regras de retirada.

## Produtos
- [ ] Planilha de produtos (modelo CSV no painel): nome, marca, preço, estoque, peso, medidas, fotos, modo de venda.

## Contas e serviços (podem ter custo)
- [ ] GitHub: conectar e indicar o repositório.
- [ ] Cloudflare: conta e plano Workers (Paid recomendado).
- [ ] Supabase: projeto (Pro recomendado para produção).
- [ ] InfinitePay: InfiniteTag e chave de API; confirmar parcelamento até 12x com juros para o cliente.
- [ ] Frete: contrato Correios **ou** conta Melhor Envio.
- [ ] Brevo para e-mails.
- [ ] Opcional: Meta Pixel/CAPI, Google Analytics, Cloudflare Turnstile.

## Autorizações
- [ ] Alteração de DNS do domínio.
- [ ] Publicação em produção.
- [ ] Teste de compra real de valor baixo.

## Correção de biblioteca de terceiros: leitura de cookies (OpenNext + cookie 1.x)

`scripts/corrigir-cookie-opennext.mjs` roda no `postinstall` e troca, nos dois
conversores do `@opennextjs/aws`, `import cookieParser from "cookie"` por
`import * as cookieParser from "cookie"`.

Motivo: o pacote `cookie` 1.x marca `__esModule: true` no build CommonJS mas não
tem `export default`. No bundle do Worker o import default vira `undefined` e
toda visita que manda cabeçalho `Cookie` quebra com
`Cannot read properties of undefined (reading 'parse')`. Como o Cloudflare põe o
cookie `__cf_bm` na primeira resposta, a primeira visita funcionava e as
seguintes caíam na tela "Error 1101" (ocorrido em 25/11/2026).

Quando atualizar o `@opennextjs/aws`: se o defeito tiver sido corrigido lá em
cima, o script avisa que o arquivo mudou de forma e `tests/unit/cookie-opennext.test.ts`
falha — aí é só remover o script, o `postinstall` e o teste.
