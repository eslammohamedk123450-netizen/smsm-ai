import { parseHimsExpiryDate } from "./hims-admin-validation";

describe("parseHimsExpiryDate", () => {
  const now = new Date("2026-11-16T12:00:00").getTime();

  test("allows an empty value as no expiry", () => {
    expect(parseHimsExpiryDate("  ", now)).toBeNull();
  });

  test("accepts a valid future date through the end of its local day", () => {
    expect(parseHimsExpiryDate("2026-11-20", now)).toBe(new Date("2026-11-20T23:59:59").toISOString());
  });

  test("rejects malformed and impossible calendar dates", () => {
    expect(() => parseHimsExpiryDate("20/11/2026", now)).toThrow("YYYY-MM-DD");
    expect(() => parseHimsExpiryDate("2026-02-30", now)).toThrow("غير صحيح");
  });

  test("rejects a date that has already expired", () => {
    expect(() => parseHimsExpiryDate("2026-11-15", now)).toThrow("المستقبل");
  });
});
