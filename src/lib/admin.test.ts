import { describe, it, expect, afterEach } from "vitest";
import { isAdminEmail, adminEmails } from "./admin";

afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.KIT_EMAIL;
});

describe("isAdminEmail", () => {
  it("nega quando nenhuma env está setada (fail-closed)", () => {
    expect(isAdminEmail("a@b.com")).toBe(false);
    expect(adminEmails()).toEqual([]);
  });

  it("aceita email da ADMIN_EMAILS, case-insensitive", () => {
    process.env.ADMIN_EMAILS = "Dono@X.com, outro@y.com";
    expect(isAdminEmail("dono@x.com")).toBe(true);
    expect(isAdminEmail("  OUTRO@y.com ")).toBe(true);
    expect(isAdminEmail("ninguem@z.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("usa KIT_EMAIL como fallback", () => {
    process.env.KIT_EMAIL = "kit@dono.com";
    expect(isAdminEmail("kit@dono.com")).toBe(true);
  });

  it("ADMIN_EMAILS tem precedência sobre KIT_EMAIL", () => {
    process.env.ADMIN_EMAILS = "admin@a.com";
    process.env.KIT_EMAIL = "kit@b.com";
    expect(isAdminEmail("kit@b.com")).toBe(false);
    expect(isAdminEmail("admin@a.com")).toBe(true);
  });
});
