import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("keeps an ordinary in-app path", () => {
    expect(safeNextPath("/dashboard/receipts")).toBe("/dashboard/receipts");
    expect(safeNextPath("/dashboard/report?status=donation")).toBe(
      "/dashboard/report?status=donation",
    );
  });

  it("rejects a protocol-relative path that would leave the origin", () => {
    // The bug this guard exists for: these all pass a naive startsWith("/"),
    // yet new URL() resolves them to a different host entirely.
    for (const evil of ["//evil.com", "////evil.com", "//evil.com/login"]) {
      expect(safeNextPath(evil)).toBe("/dashboard");
      expect(new URL(safeNextPath(evil), "https://app.test/x").origin).toBe(
        "https://app.test",
      );
    }
  });

  it("rejects a backslash path, which browsers normalise to a slash", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/dashboard");
  });

  it("rejects an absolute URL", () => {
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects control characters that could split a Location header", () => {
    expect(safeNextPath("/dashboard\nLocation: https://evil.com")).toBe(
      "/dashboard",
    );
    expect(safeNextPath("/dashboard\r\nSet-Cookie: a=b")).toBe("/dashboard");
  });

  it("falls back when the value is absent or not a string", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath(new File([], "x"))).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("honours a caller-supplied fallback", () => {
    expect(safeNextPath("//evil.com", "/login")).toBe("/login");
  });
});
