import { buildWebAuthRedirect } from "./auth-redirect";

describe("buildWebAuthRedirect", () => {
  it("includes the GitHub Pages repository path", () => {
    expect(buildWebAuthRedirect("https://example.github.io", "/smsm-ai"))
      .toBe("https://example.github.io/smsm-ai/auth/callback");
  });

  it("supports root hosted web builds", () => {
    expect(buildWebAuthRedirect("https://suly.example", ""))
      .toBe("https://suly.example/auth/callback");
  });

  it("rejects an unsafe origin and malformed base path", () => {
    expect(() => buildWebAuthRedirect("https://evil.example/path")).not.toThrow();
    expect(() => buildWebAuthRedirect("https://evil.example", "https://attacker.example")).toThrow();
  });
});
