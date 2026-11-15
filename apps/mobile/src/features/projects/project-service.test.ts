import { normalizeProjectInput } from "./project-service";

describe("normalizeProjectInput", () => {
  it("trims and normalizes valid project details", () => {
    expect(normalizeProjectInput({ name: "  Suly Website  ", description: "  Build the web app  ", iconKey: "code" }))
      .toEqual({ name: "Suly Website", description: "Build the web app", color: "#D4AF37", icon_key: "code" });
  });

  it("rejects blank or oversized names and descriptions", () => {
    expect(() => normalizeProjectInput({ name: "  " })).toThrow();
    expect(() => normalizeProjectInput({ name: "x".repeat(101) })).toThrow();
    expect(() => normalizeProjectInput({ name: "Valid", description: "x".repeat(2001) })).toThrow();
  });

  it("rejects unsafe colors and unsupported icon keys", () => {
    expect(() => normalizeProjectInput({ name: "Valid", color: "red" })).toThrow();
    expect(() => normalizeProjectInput({ name: "Valid", iconKey: "admin" })).toThrow();
  });
});
