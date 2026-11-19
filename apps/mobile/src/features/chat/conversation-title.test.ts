import { summarizeContent, titleFromMessage } from "./conversation-title";

describe("conversation title generation", () => {
  it("keeps short natural questions recognizable", () => {
    expect(summarizeContent("كيف حالك")).toBe("كيف حالك");
  });

  it("uses a professional topic title for website requests", () => {
    expect(summarizeContent("اعمل لي موقع إلكتروني لشركة تقنية مع صفحة خدمات")).toBe("تصميم موقع إلكتروني");
  });

  it("uses a professional topic title for app requests", () => {
    expect(summarizeContent("عايز أعمل تطبيق لإدارة الدورات")).toBe("تطوير تطبيق");
  });

  it("summarizes explanation and writing requests", () => {
    expect(summarizeContent("اشرح لي بالتفصيل قانون أوم")).toBe("شرح وتوضيح");
    expect(summarizeContent("اكتب لي ايميل رسمي للجامعة")).toBe("كتابة بريد إلكتروني");
  });

  it("clips generic long content on a word boundary", () => {
    const title = summarizeContent("من فضلك ساعدني في فهم الموضوع التالي بالتفصيل مع أمثلة عملية وتطبيقات واضحة للدرس");
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title.endsWith("…")).toBe(true);
  });

  it("removes activation codes, links, markdown and code fences", () => {
    const title = summarizeContent("!ACTIVATE_HIMS-ABC123 **لخص** https://example.com \x60\x60\x60js\nconst x=1\n\x60\x60\x60 الملف");
    expect(title).not.toContain("ACTIVATE");
    expect(title).not.toContain("http");
    expect(title).not.toContain("\x60\x60\x60");
  });

  it("uses the legacy export as a safe alias", () => {
    expect(titleFromMessage("اعمل لي موقع إلكتروني")).toBe("تصميم موقع إلكتروني");
  });

  it("falls back when no readable content remains", () => {
    expect(summarizeContent("   ")).toBe("محادثة جديدة");
  });
});
