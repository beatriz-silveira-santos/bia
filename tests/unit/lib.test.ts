import { describe, expect, it } from "vitest";
import { formatBRL, parseBRLToCents } from "@/lib/money";
import { formatLeadTime, preorderAckText, preorderNotice } from "@/lib/leadtime";
import { consolidatePackage, exceedsCarrierLimits, normalizeCep } from "@/lib/shipping/packaging";
import { parseCsv } from "@/lib/csv";
import { renderMarkdown } from "@/lib/markdown";
import { whatsappLink, whatsappProductLink } from "@/lib/whatsapp";

describe("dinheiro em centavos", () => {
  it("converte formatos brasileiros sem ponto flutuante", () => {
    expect(parseBRLToCents("129,90")).toBe(12990);
    expect(parseBRLToCents("R$ 1.299,90")).toBe(129990);
    expect(parseBRLToCents("10")).toBe(1000);
    expect(parseBRLToCents("0,1")).toBe(10);
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("1,999")).toBeNull();
  });
  it("formata BRL e rejeita valores não inteiros", () => {
    expect(formatBRL(12990).replace(/\s/g, " ")).toBe("R$ 129,90");
    expect(() => formatBRL(10.5)).toThrow();
  });
});

describe("prazos de encomenda", () => {
  it("diferencia dias corridos e úteis e sinaliza unidade não confirmada", () => {
    expect(formatLeadTime(20, "calendar_days")).toBe("20 dias corridos");
    expect(formatLeadTime(20, "business_days")).toBe("20 dias úteis");
    expect(formatLeadTime(20, null)).toContain("a confirmar");
  });
  it("fala em postagem, nunca em entrega/chegada em 20 dias", () => {
    const t = preorderNotice(20, "calendar_days") + preorderAckText([{ name: "X", value: 20, unit: "calendar_days" }]);
    expect(t).toContain("postagem");
    expect(t).toMatch(/transporte .*adicional/);
    expect(t).not.toMatch(/entrega em 20|chega em 20/i);
  });
});

describe("embalagem para frete", () => {
  it("exige peso e dimensões de todos os itens", () => {
    expect(consolidatePackage([{ weight_g: 400, width_cm: 10, height_cm: 15, length_cm: 6, quantity: 1 }, { weight_g: null, width_cm: 1, height_cm: 1, length_cm: 1, quantity: 1 }])).toBeNull();
  });
  it("não subestima volume e respeita mínimos", () => {
    const p = consolidatePackage([{ weight_g: 400, width_cm: 10, height_cm: 15, length_cm: 6, quantity: 2 }])!;
    expect(p.weight_g).toBe(950);
    expect(p.length_cm).toBeGreaterThanOrEqual(16);
    expect(p.height_cm).toBeGreaterThanOrEqual(12 + 2);
    expect(exceedsCarrierLimits(p)).toBe(false);
  });
  it("normaliza CEP", () => {
    expect(normalizeCep("15054-160")).toBe("15054160");
    expect(normalizeCep("123")).toBeNull();
    expect(normalizeCep("00000-000")).toBeNull();
  });
});

describe("CSV", () => {
  it("lê ; com aspas e BOM", () => {
    const rows = parseCsv('﻿sku;nome;acordes\nA1;"Perfume; edição";"a, b"\n');
    expect(rows).toEqual([{ sku: "A1", nome: "Perfume; edição", acordes: "a, b" }]);
  });
});

describe("markdown seguro", () => {
  it("escapa HTML e só aceita links internos/https", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n[x](javascript:alert(1)) [ok](/ajuda)');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('href="/ajuda"');
  });
});

describe("WhatsApp", () => {
  it("gera link wa.me com mensagem codificada", () => {
    expect(whatsappLink()).toBe("https://wa.me/5517992066575");
    expect(whatsappLink("Olá! Tudo bem?")).toBe("https://wa.me/5517992066575?text=Ol%C3%A1!%20Tudo%20bem%3F");
    expect(whatsappProductLink("Perfume & Cia")).toContain("Perfume%20%26%20Cia");
  });
});
