import { titleFromMessage } from "./conversation-title";

describe("titleFromMessage", () => {
  it("keeps short requests as they are", () => {
    expect(titleFromMessage("اشرح لي قانون أوم")).toBe("اشرح لي قانون أوم");
  });

  it("clips long requests on a word boundary with an ellipsis", () => {
    const long = "أريد خطة دراسية كاملة لمادة الفيزياء تشمل كل المحاضرات والملفات المطلوبة للفصل الدراسي القادم";
    const title = titleFromMessage(long);
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title.endsWith("…")).toBe(true);
    expect(long.startsWith(title.replace("…", "").trim())).toBe(true);
  });

  it("drops activation codes so the secret never shows in history", () => {
    const title = titleFromMessage("!ACTIVATE_HIMS-ABC123 فعّل نظامي من فضلك");
    expect(title).not.toContain("ACTIVATE");
    expect(title).toContain("فعّل نظامي");
  });

  it("strips markdown, links and code fences", () => {
    const title = titleFromMessage("```js\nconst x = 1\n``` **لخص** https://example.com/page الملف");
    expect(title).not.toContain("```");
    expect(title).not.toContain("http");
    expect(title).toContain("لخص");
  });

  it("falls back when nothing readable is left", () => {
    expect(titleFromMessage("   ")).toBe("محادثة جديدة");
    expect(titleFromMessage("```\ncode\n```")).toBe("محادثة جديدة");
  });

  it("collapses newlines and repeated spaces", () => {
    expect(titleFromMessage("سؤال\n\nعن    الذكاء")).toBe("سؤال عن الذكاء");
  });
});
