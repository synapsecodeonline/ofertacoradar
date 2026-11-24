import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, clientIp } from "./ratelimit";

describe("rateLimit", () => {
  beforeEach(() => {
    // janelas curtas e chaves únicas por teste
  });

  it("permite até o limite e bloqueia depois", () => {
    const k = `t:${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(rateLimit(k, 5, 60_000)).toBe(true);
    expect(rateLimit(k, 5, 60_000)).toBe(false);
  });

  it("chaves diferentes não compartilham cota", () => {
    const a = `a:${Math.random()}`, b = `b:${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000)).toBe(false);
    expect(rateLimit(b, 1, 60_000)).toBe(true);
  });

  it("janela expirada libera de novo", async () => {
    const k = `w:${Math.random()}`;
    rateLimit(k, 1, 30);
    expect(rateLimit(k, 1, 30)).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(rateLimit(k, 1, 30)).toBe(true);
  });
});

describe("clientIp", () => {
  it("pega primeiro IP do x-forwarded-for", () => {
    const req = new Request("https://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });
  it("fallback local sem headers", () => {
    expect(clientIp(new Request("https://x"))).toBe("local");
  });
});
