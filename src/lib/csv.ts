/** Parser CSV (RFC 4180) com detecção de separador ; ou , e remoção de BOM. */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

export const PRODUCT_CSV_COLUMNS = [
  "sku", "nome", "marca", "categoria", "subcategoria", "classificacao", "preco", "preco_promocional", "volume_ml", "decante",
  "descricao", "familia_olfativa", "acordes", "notas_saida", "notas_coracao", "notas_fundo", "tipo_produto", "modo_de_uso",
  "composicao", "advertencias", "beneficios", "conteudo", "peso_g", "largura_cm", "altura_cm", "comprimento_cm",
  "modalidade", "encomenda_max", "estoque_inicial", "fornecedor",
] as const;
