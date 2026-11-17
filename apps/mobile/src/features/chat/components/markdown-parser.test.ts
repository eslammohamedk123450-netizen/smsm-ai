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

  it("keeps invalid chart payloads visible as code", () => {
    const input = "```chart\n{\"type\":\"pie\",\"labels\":[\"A\"],\"values\":[1]}\n```";
    expect(parseMarkdownBlocks(input)).toEqual([
      { type: "code", language: "chart", code: "{\"type\":\"pie\",\"labels\":[\"A\"],\"values\":[1]}" },
    ]);
  });

});
