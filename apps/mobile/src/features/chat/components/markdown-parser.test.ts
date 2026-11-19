import { parseMarkdownBlocks } from "./markdown-parser";

describe("parseMarkdownBlocks", () => {
  it("parses headings, short paragraphs, lists, quotes, fenced code, and tables", () => {
    const result = parseMarkdownBlocks(`## مقارنة

فقرة قصيرة.

- الخيار الأول
- الخيار الثاني

> ملاحظة مهمة

| الخيار | السعر |
| --- | --- |
| أ | 10 |

\`\`\`ts
const answer = 42;
\`\`\``);

    expect(result).toEqual([
      { type: "heading", level: 2, text: "مقارنة" },
      { type: "paragraph", text: "فقرة قصيرة." },
      { type: "list", ordered: false, items: ["الخيار الأول", "الخيار الثاني"] },
      { type: "quote", text: "ملاحظة مهمة" },
      { type: "table", headers: ["الخيار", "السعر"], rows: [["أ", "10"]] },
      { type: "code", language: "ts", code: "const answer = 42;" },
    ]);
  });

  it("parses numbered lists and language-less code blocks", () => {
    expect(parseMarkdownBlocks("1. الأول\n2. الثاني\n\n```\ncode\n```" )).toEqual([
      { type: "list", ordered: true, items: ["الأول", "الثاني"] },
      { type: "code", language: "", code: "code" },
    ]);
  });

  it("parses a bounded bar chart block for inline visualization", () => {
    const input = "```chart\n{\"type\":\"bar\",\"title\":\"المبيعات\",\"labels\":[\"يناير\",\"فبراير\"],\"values\":[12,18]}\n```";
    expect(parseMarkdownBlocks(input)).toEqual([
      { type: "chart", title: "المبيعات", labels: ["يناير", "فبراير"], values: [12, 18] },
    ]);
  });

  it("parses a native flowchart block with bounded steps", () => {
    const input = "```flow\n{\"title\":\"رحلة المستخدم\",\"steps\":[\"فتح التطبيق\",\"تسجيل الدخول\",\"إرسال رسالة\",\"عرض النتيجة\"]}\n```";
    expect(parseMarkdownBlocks(input)).toEqual([
      { type: "flow", title: "رحلة المستخدم", steps: ["فتح التطبيق", "تسجيل الدخول", "إرسال رسالة", "عرض النتيجة"] },
    ]);
  });

  it("parses a dashboard with KPI metrics and embedded charts", () => {
    const input = "```dashboard\n{\"title\":\"أداء الشركة\",\"metrics\":[{\"label\":\"الإيرادات\",\"value\":120000,\"change\":\"+12%\"},{\"label\":\"العملاء\",\"value\":840}],\"charts\":[{\"title\":\"الإيرادات الشهرية\",\"labels\":[\"يناير\",\"فبراير\"],\"values\":[10,20]}]}\n```";
    expect(parseMarkdownBlocks(input)).toEqual([
      {
        type: "dashboard",
        title: "أداء الشركة",
        metrics: [
          { label: "الإيرادات", value: 120000, change: "+12%" },
          { label: "العملاء", value: 840, change: undefined },
        ],
        charts: [{ title: "الإيرادات الشهرية", labels: ["يناير", "فبراير"], values: [10, 20] }],
      },
    ]);
  });

  it("converts Mermaid flowcharts into native chat flow diagrams", () => {
    const input = "```mermaid\nflowchart TD\nA[فتح التطبيق] --> B[تسجيل الدخول]\nB --> C[إرسال رسالة]\n```";
    expect(parseMarkdownBlocks(input)).toEqual([
      { type: "flow", steps: ["فتح التطبيق", "تسجيل الدخول", "إرسال رسالة"] },
    ]);
  });

  it("parses an actionable Agent activation card", () => {
    const input = "```agent\n{\"title\":\"تفعيل وضع الوكيل\",\"message\":\"هذه المهمة تحتاج إلى تنفيذ عدة خطوات.\"}\n```";
    expect(parseMarkdownBlocks(input)).toEqual([
      { type: "agent", title: "تفعيل وضع الوكيل", message: "هذه المهمة تحتاج إلى تنفيذ عدة خطوات." },
    ]);
  });

  it("shows a readable fallback for malformed flowchart and dashboard payloads", () => {
    expect(parseMarkdownBlocks("```flow\n{\"steps\":[\"واحد\"]}\n```")[0]).toEqual({ type: "paragraph", text: "تعذر إنشاء العنصر المرئي بتنسيق صالح. أعد طلب الرسم أو المخطط وسأحاول إنشاءه من جديد." });
    expect(parseMarkdownBlocks("```dashboard\n{\"metrics\":[]}\n```")[0]).toEqual({ type: "paragraph", text: "تعذر إنشاء العنصر المرئي بتنسيق صالح. أعد طلب الرسم أو المخطط وسأحاول إنشاءه من جديد." });
  });

  it("shows a readable fallback for invalid chart payloads", () => {
    const input = "```chart\n{\"type\":\"pie\",\"labels\":[\"A\"],\"values\":[1]}\n```";
    expect(parseMarkdownBlocks(input)).toEqual([
      { type: "paragraph", text: "تعذر إنشاء العنصر المرئي بتنسيق صالح. أعد طلب الرسم أو المخطط وسأحاول إنشاءه من جديد." },
    ]);
  });

  it("keeps every data row in a long Arabic comparison table", () => {
    const input = "## مقارنة تفصيلية بين Claude 4 وGPT-5 في البرمجة فقط\n\n| المعيار | Claude 4 | GPT-5 |\n|---|---|---|\n| كتابة الكود | ممتاز | ممتاز |\n| إصلاح الأخطاء | قوي جدًا | قوي جدًا |\n| فهم المشاريع الكبيرة | ممتاز | قوي جدًا |\n| الاستدلال | عميق | متقدم |\n| السرعة | أبطأ نسبيًا | متوازن |\n| المرونة | عالية | عالية جدًا |\n\n**الخلاصة:** كلاهما قوي.";
    expect(parseMarkdownBlocks(input)).toContainEqual({
      type: "table",
      headers: ["المعيار", "Claude 4", "GPT-5"],
      rows: [
        ["كتابة الكود", "ممتاز", "ممتاز"],
        ["إصلاح الأخطاء", "قوي جدًا", "قوي جدًا"],
        ["فهم المشاريع الكبيرة", "ممتاز", "قوي جدًا"],
        ["الاستدلال", "عميق", "متقدم"],
        ["السرعة", "أبطأ نسبيًا", "متوازن"],
        ["المرونة", "عالية", "عالية جدًا"],
      ],
    });
  });

  it("supports escaped pipe characters and short valid divider cells", () => {
    expect(parseMarkdownBlocks("| البند | الوصف |\\n|---|---|\\n| أ | قيمة بها \\| داخلية |")).toContainEqual({
      type: "table",
      headers: ["البند", "الوصف"],
      rows: [["أ", "قيمة بها | داخلية"]],
    });
  });

});
