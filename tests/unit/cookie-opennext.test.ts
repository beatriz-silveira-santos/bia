import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regressão do "Error 1101" de 25/11/2026: o pacote `cookie` 1.x marca
// __esModule mas não exporta default, e o @opennextjs/aws o importava como
// default. No Worker isso virava undefined e toda visita COM cookie quebrava.
// scripts/corrigir-cookie-opennext.mjs conserta no postinstall; aqui garantimos
// que a correção está de pé em qualquer máquina que rode os testes.
const CONVERSORES = [
  "node_modules/@opennextjs/aws/dist/overrides/converters/node.js",
  "node_modules/@opennextjs/aws/dist/overrides/converters/edge.js",
];

describe("leitura de cookies no Worker", () => {
  it("o pacote cookie continua sem export default (a correção ainda é necessária)", async () => {
    const mod = (await import("cookie")) as Record<string, unknown>;
    expect(typeof mod.parse).toBe("function");
    // Se um dia virar função, a biblioteca passou a ter default e a correção pode sair.
    expect(typeof mod.default).not.toBe("function");
  });

  for (const arquivo of CONVERSORES) {
    it(`${arquivo.split("/").pop()} não importa "cookie" como default`, () => {
      if (!existsSync(arquivo)) return; // dependência ausente: nada a conferir
      const texto = readFileSync(arquivo, "utf8");
      expect(texto).not.toContain('import cookieParser from "cookie"');
      expect(texto).toContain('import * as cookieParser from "cookie"');
    });
  }
});
