import { describe, it, expect } from "vitest";
import { formatPrice, discountPercent, discountPctOf, decodeEntities } from "./format";

describe("formatPrice", () => {
  it("formata BRL sem centavos quando inteiro", () => {
    expect(formatPrice(1000)).toBe("R$ 1.000");
  });
  it("com centavos quando fracionado", () => {
    expect(formatPrice(99.9)).toContain("99,90");
  });
  it("null/undefined -> null", () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(undefined)).toBeNull();
  });
});

describe("discountPercent", () => {
  it("calcula % corretamente", () => {
    expect(discountPercent(80, 100)).toBe(20);
  });
  it("sem oldPrice ou oldPrice <= price -> null", () => {
    expect(discountPercent(80)).toBeNull();
    expect(discountPercent(80, 80)).toBeNull();
    expect(discountPercent(80, 70)).toBeNull();
  });
  it("discountPctOf delega", () => {
    expect(discountPctOf({ price: 50, oldPrice: 100 })).toBe(50);
  });
});

describe("decodeEntities", () => {
  it("decodifica entidades HTML comuns", () => {
    expect(decodeEntities("Fone &amp; Capinha")).toBe("Fone & Capinha");
    expect(decodeEntities("&quot;Smart&quot;")).toContain('"');
  });
});
