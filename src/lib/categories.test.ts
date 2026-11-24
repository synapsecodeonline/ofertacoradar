import { describe, it, expect } from "vitest";
import { resolveCategory, canonicalCategory, categoryLabel } from "./categories";

describe("resolveCategory", () => {
  it("classifica smartphone", () => {
    expect(resolveCategory(undefined, "iPhone 15 256GB")).toBe("celulares");
  });
  it("classifica notebook", () => {
    expect(resolveCategory(undefined, "Notebook Dell i7 16GB")).toBe("informatica");
  });
  it("classifica geladeira", () => {
    expect(resolveCategory(undefined, "Geladeira Frost Free 375L")).toBe("eletrodomesticos");
  });
  it("classifica smart tv", () => {
    expect(resolveCategory(undefined, "Smart TV 50 polegadas")).toBe("tv-audio");
  });
  it("fallback quando nada casa -> string nao vazia", () => {
    const c = resolveCategory(undefined, "Produto XYZ sem keyword conhecida");
    expect(typeof c).toBe("string");
    expect(c.length).toBeGreaterThan(0);
  });
  it("não explode com titulo vazio/null", () => {
    expect(() => resolveCategory(undefined, "")).not.toThrow();
    expect(() => resolveCategory(undefined, undefined)).not.toThrow();
  });
});

describe("canonicalCategory", () => {
  it("categoria crua com acento resolve igual sem acento", () => {
    // regressao: "Eletrônicos" caia em "outros" por causa do acento
    expect(canonicalCategory("Eletrônicos")).toBe("eletronicos");
    expect(canonicalCategory("eletronicos")).toBe("eletronicos");
  });
  it("case-insensitive", () => {
    expect(canonicalCategory("CELULARES")).toBe("celulares");
    expect(canonicalCategory("Celulares")).toBe("celulares");
  });
  it("retorna string para null", () => {
    expect(typeof canonicalCategory(null)).toBe("string");
  });
});

describe("categoryLabel", () => {
  it("retorna label legível", () => {
    expect(categoryLabel("celulares").length).toBeGreaterThan(0);
  });
});
