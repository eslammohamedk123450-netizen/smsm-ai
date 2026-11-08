import { getRotatingSuggestions, SUGGESTION_CATALOG } from "./suggestions";

describe("rotating chat suggestions", () => {
  it("has a large catalog", () => {
    expect(SUGGESTION_CATALOG.length).toBeGreaterThanOrEqual(100);
  });

  it("is stable inside a time bucket", () => {
    const first = getRotatingSuggestions(1_735_000_000_000);
    const second = getRotatingSuggestions(1_735_000_001_000);
    expect(second).toEqual(first);
  });

  it("rotates between time buckets without duplicate cards", () => {
    const first = getRotatingSuggestions(1_735_000_000_000);
    const next = getRotatingSuggestions(1_735_001_000_000);
    expect(new Set(first.map((item) => item.text)).size).toBe(first.length);
    expect(new Set(next.map((item) => item.text)).size).toBe(next.length);
    expect(next).not.toEqual(first);
  });
});
