import { describe, expect, it } from "vitest";
import { passwordChecks, passwordStrength, passwordValid } from "./password";

describe("password rules", () => {
  it("mirror backend requirements", () => {
    expect(passwordValid("password-123", 8)).toBe(true);
    expect(passwordValid("Ab1", 8)).toBe(false);
    expect(passwordValid("onlyletters", 8)).toBe(false);
    expect(passwordValid("12345678", 8)).toBe(false);
    expect(passwordValid("farrukh-2026", 8, "farrukh")).toBe(false);
  });

  it("rates strength", () => {
    const strength = (p: string) => passwordStrength(passwordChecks(p, 8), p);
    expect(strength("short")).toBe(0);
    expect(strength("password1")).toBe(1);
    expect(strength("Password1")).toBe(2);
    expect(strength("Password1!")).toBe(3);
  });
});
