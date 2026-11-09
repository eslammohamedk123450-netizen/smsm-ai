import { getQuickReply, normalizeQuickReply } from "./quick-replies-cache";

describe("quick-replies-cache", () => {
  it("answers repeated chit-chat instantly", () => {
    expect(getQuickReply("ازيك؟")).toBeTruthy();
    expect(getQuickReply("شكرًا!")).toBeTruthy();
    expect(getQuickReply("انت مين")).toBeTruthy();
    expect(getQuickReply("Hello!")).toBeTruthy();
  });

  it("never answers real work requests from the cache", () => {
    expect(getQuickReply("ابحث لي عن سعر الذهب اليوم")).toBeNull();
    expect(getQuickReply("اعمل لي موقع كامل")).toBeNull();
    expect(getQuickReply("اكتب لي خطة عمل شاملة")).toBeNull();
  });

  it("normalizes Arabic spelling variants to the same key", () => {
    expect(normalizeQuickReply("أزيك")).toBe(normalizeQuickReply("ازيك"));
    expect(normalizeQuickReply("شكراً")).toBe(normalizeQuickReply("شكرا"));
    expect(getQuickReply("أزيـك؟")).toBe(getQuickReply("ازيك"));
  });
});
