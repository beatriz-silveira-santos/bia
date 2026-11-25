#!/usr/bin/env bash
# Confere de fora que a loja publicada responde: páginas principais, catálogo
# aparecendo, fotos do Storage carregando e área da administradora protegida.
# Uso: scripts/verificar-loja.sh https://endereco-da-loja
set -uo pipefail

base="${1:?informe o endereço da loja}"
base="${base%/}"
falhas=0

# Visita como um navegador de verdade: mesma sessão (cookies) e mesmos cabeçalhos.
jar=$(mktemp)
UA="Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
visita() { # caminho, arquivo de saída
  curl -sS -o "$2" -w '%{http_code}' -L --max-time 30 \
    --cookie "$jar" --cookie-jar "$jar" --compressed \
    -A "$UA" \
    -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8' \
    -H 'accept-language: pt-BR,pt;q=0.9' \
    -H 'sec-fetch-dest: document' -H 'sec-fetch-mode: navigate' -H 'sec-fetch-site: none' \
    "$base$1" || echo 000
}

pagina() { # caminho, texto esperado (pode ser vazio), código esperado
  local code
  code=$(visita "$1" /tmp/verif.html)
  if [ "$code" != "$3" ]; then
    echo "::error::$1 respondeu HTTP $code (esperado $3)"
    falhas=$((falhas + 1)); return
  fi
  if [ -n "$2" ] && ! grep -qiF "$2" /tmp/verif.html; then
    echo "::error::$1 respondeu $code mas não traz \"$2\""
    head -c 400 /tmp/verif.html
    falhas=$((falhas + 1)); return
  fi
  echo "ok  $1  (HTTP $code, $(wc -c < /tmp/verif.html) bytes)"
}

pagina "/" "Khamrah" 200
pagina "/categorias" "" 200
pagina "/busca?q=khamrah" "Khamrah" 200
pagina "/produto/lattafa-khamrah-edp-100" "Khamrah" 200
pagina "/instagram" "" 200
pagina "/entrar" "" 200
pagina "/carrinho" "" 200
pagina "/robots.txt" "" 200

# As fotos do catálogo têm de carregar (a última página lida é a do produto... /robots.txt;
# por isso relê a página do produto antes de procurar a foto).
curl -sS -o /tmp/verif.html -L --max-time 30 "$base/produto/lattafa-khamrah-edp-100" >/dev/null || true
foto=$(grep -oE 'https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/products/[^"?\\]+' /tmp/verif.html | head -1 || true)
if [ -n "$foto" ]; then
  fcode=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$foto" || echo 000)
  if [ "$fcode" = "200" ]; then echo "ok  foto do catálogo carrega (HTTP 200)"
  else echo "::error::foto do catálogo respondeu HTTP $fcode"; falhas=$((falhas + 1)); fi
else
  echo "::warning::nenhuma foto do Storage encontrada na página do produto"
fi

# A área da administradora não pode abrir para quem não entrou.
acode=$(curl -sS -o /tmp/admin.html -w '%{http_code}' --max-time 30 "$base/admin" || echo 000)
case "$acode" in
  200)
    if grep -qiE "pedidos de hoje|faturamento" /tmp/admin.html; then
      echo "::error::/admin abriu o painel sem login"; falhas=$((falhas + 1))
    else echo "ok  /admin (HTTP 200) não expõe o painel"; fi ;;
  30*|40*) echo "ok  /admin bloqueado para visitante (HTTP $acode)" ;;
  *) echo "::error::/admin respondeu HTTP $acode"; falhas=$((falhas + 1)) ;;
esac

# A tarefa automática (cron) roda a cada 10 minutos e usa o mesmo código do site.
# Até agora ela era a principal suspeita do erro intermitente, então é exercitada aqui.
if [ -n "${CRON_SECRET:-}" ]; then
  ccode=$(curl -sS -o /tmp/cron.txt -w '%{http_code}' --max-time 60 -X POST \
    -H "authorization: Bearer $CRON_SECRET" "$base/api/cron/maintenance" || echo 000)
  if [ "$ccode" = "200" ]; then
    echo "ok  tarefa automática respondeu 200: $(head -c 200 /tmp/cron.txt)"
  else
    echo "::error::tarefa automática respondeu HTTP $ccode"
    head -c 1500 /tmp/cron.txt
    falhas=$((falhas + 1))
  fi
else
  echo "::warning::sem CRON_SECRET: a tarefa automática não foi testada"
fi

# Visitas repetidas na mesma sessão: é assim que o erro aparece para quem volta à loja.
for n in 1 2 3; do
  code=$(visita "/" /tmp/repete.html)
  if [ "$code" != "200" ]; then
    echo "::error::visita $n à página inicial respondeu HTTP $code"
    head -c 1500 /tmp/repete.html
    falhas=$((falhas + 1))
  else
    echo "ok  visita $n à página inicial (HTTP 200)"
  fi
  sleep 2
done

if [ "$falhas" -eq 0 ]; then
  echo "::notice::Loja de teste respondendo corretamente."
else
  echo "::error::$falhas verificação(ões) falharam"; exit 1
fi
