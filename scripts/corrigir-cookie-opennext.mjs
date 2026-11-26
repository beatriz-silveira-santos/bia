#!/usr/bin/env node
// Conserta um defeito de biblioteca de terceiros que derrubava a loja.
//
// O pacote `cookie` 1.x marca `__esModule: true` no build CommonJS mas NÃO tem
// `export default`. O @opennextjs/aws importa assim:
//
//     import cookieParser from "cookie";
//     ... cookieParser.parse(cookieHeader)
//
// No bundle do Worker esse import vira `undefined`, e aí QUALQUER visita que
// mande cabeçalho Cookie quebra com
// "TypeError: Cannot read properties of undefined (reading 'parse')".
// Como o Cloudflare coloca um cookie próprio (__cf_bm) na primeira resposta, a
// primeira visita funciona e as seguintes quebram — foi o "Error 1101" de 25/11/2026.
//
// A correção troca o import default por import de namespace, que funciona nos
// dois formatos. Remover quando o @opennextjs/aws corrigir isso lá em cima.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ANTES = 'import cookieParser from "cookie";';
const DEPOIS = 'import * as cookieParser from "cookie";';
const ARQUIVOS = [
  "node_modules/@opennextjs/aws/dist/overrides/converters/node.js",
  "node_modules/@opennextjs/aws/dist/overrides/converters/edge.js",
];

let corrigidos = 0;
let jaOk = 0;
for (const arquivo of ARQUIVOS) {
  if (!existsSync(arquivo)) continue;
  const texto = readFileSync(arquivo, "utf8");
  if (texto.includes(DEPOIS)) {
    jaOk++;
    continue;
  }
  if (!texto.includes(ANTES)) {
    console.warn(`[cookie] ${arquivo} mudou de forma; confira se o defeito foi corrigido lá em cima.`);
    continue;
  }
  writeFileSync(arquivo, texto.replace(ANTES, DEPOIS));
  corrigidos++;
}
if (corrigidos || jaOk) console.log(`[cookie] ${corrigidos} arquivo(s) corrigido(s), ${jaOk} já estava(m) certo(s).`);
