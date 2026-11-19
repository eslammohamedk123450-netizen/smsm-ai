import { getPlaygroundIssue } from "./playground-validation";

describe("getPlaygroundIssue", () => {
  it("allows a complete HTML document", () => {
    expect(getPlaygroundIssue("html", "<!doctype html><html><head><style>body{color:red}</style></head><body><h1>Ready</h1><script>console.log('ok')</script></body></html>")).toBeNull();
  });

  it("rejects an unfinished fenced code block", () => {
    expect(getPlaygroundIssue("html", "<!doctype html><html>", true)).toContain("الكود غير مكتمل");
  });

  it("rejects a document missing its closing html tag", () => {
    expect(getPlaygroundIssue("html", "<!doctype html><html><body>Hi</body>")).toContain("</html>");
  });

  it("rejects an unclosed body, style, or script tag", () => {
    expect(getPlaygroundIssue("html", "<html><body>Hi</html>")).toContain("</body>");
    expect(getPlaygroundIssue("html", "<html><head><style>body{color:red}</head><body>Hi</body></html>")).toContain("</style>");
    expect(getPlaygroundIssue("html", "<html><body><script>console.log('hi')</body></html>")).toContain("</script>");
  });

  it("allows valid HTML fragments and does not apply HTML checks to other languages", () => {
    expect(getPlaygroundIssue("html", "<h1>Hello</h1>")).toBeNull();
    expect(getPlaygroundIssue("javascript", "console.log('hello')")).toBeNull();
  });
});
