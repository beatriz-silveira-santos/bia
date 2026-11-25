import { describe, expect, it } from "vitest";
import { pickUrl } from "@/lib/payments/infinitepay";
import { classifyChannel } from "@/lib/attribution";
import { toCsv } from "@/lib/admin";

describe("InfinitePay", () => {
  it("só aceita URL de checkout em domínio da InfinitePay", () => {
    expect(pickUrl({ url: "https://checkout.infinitepay.io/abc" })).toBe("https://checkout.infinitepay.io/abc");
    expect(pickUrl({ link: "https://evil.example.com/x" })).toBeNull();
    expect(pickUrl({ url: "javascript:alert(1)" })).toBeNull();
    expect(pickUrl(null)).toBeNull();
  });
});

describe("atribuição", () => {
  it("classifica origens do Instagram e outras", () => {
    expect(classifyChannel({ utm_source: "instagram", utm_medium: "bio" })).toBe("instagram_bio");
    expect(classifyChannel({ utm_source: "instagram", utm_medium: "stories" })).toBe("instagram_stories");
    expect(classifyChannel({ utm_source: "facebook", utm_medium: "paid_social" })).toBe("meta_ads");
    expect(classifyChannel({ ref: "www.google.com" })).toBe("google");
    expect(classifyChannel(null)).toBe("direto");
  });
});

describe("exportação CSV", () => {
  it("neutraliza fórmulas e usa ; para Excel", () => {
    const csv = toCsv([{ a: "=HYPERLINK(1)", b: "x;y" }]);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain('"x;y"');
  });
});
