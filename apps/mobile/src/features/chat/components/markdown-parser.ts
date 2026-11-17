export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "chart"; title?: string; labels: string[]; values: number[] }
  | { type: "flow"; title?: string; steps: string[] }
  | { type: "dashboard"; title?: string; metrics: Array<{ label: string; value: string | number; change?: string }>; charts: Array<{ title?: string; labels: string[]; values: number[] }> }
  | { type: "agent"; title: string; message: string };

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index];
  return /^\s{0,3}(?:#{1,3}\s|```|>|[-*+]\s|\d+[.)]\s)/.test(line)
    || (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1]));
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^\s{0,3}```\s*([\w+-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s{0,3}```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const code = codeLines.join("\n");
      const language = (fence[1] || "").toLowerCase();
      if (language === "chart" || language === "flow" || language === "diagram" || language === "dashboard" || language === "agent" || language === "mermaid") {
        try {
          if (language === "mermaid") {
            const nodePattern = /([A-Za-z][\w]*)\s*(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})/g;
            const steps: string[] = [];
            let node: RegExpExecArray | null;
            while ((node = nodePattern.exec(code)) !== null) {
              const label = (node[2] || node[3] || node[4] || "").trim();
              if (label && !steps.includes(label)) steps.push(label);
            }
            if (/(?:-->|==>|---)/.test(code) && steps.length >= 2 && steps.length <= 10) {
              blocks.push({ type: "flow", steps });
              continue;
            }
          }
          const visual = JSON.parse(code) as Record<string, unknown>;
          const safeTitle = typeof visual.title === "string" ? visual.title.slice(0, 120) : undefined;
          const validChart = (value: unknown, maxItems = 12): value is { title?: string; labels: string[]; values: number[] } => {
            if (!value || typeof value !== "object") return false;
            const chart = value as Record<string, unknown>;
            return Array.isArray(chart.labels) && Array.isArray(chart.values)
              && chart.labels.length > 0 && chart.labels.length <= maxItems
              && chart.labels.length === chart.values.length
              && chart.labels.every((label) => typeof label === "string" && label.trim().length > 0 && label.length <= 80)
              && chart.values.every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0);
          };
          if (language === "chart" && visual.type === "bar" && validChart(visual)) {
            blocks.push({ type: "chart", title: safeTitle, labels: visual.labels, values: visual.values });
            continue;
          }
          if ((language === "flow" || language === "diagram") && Array.isArray(visual.steps)
            && visual.steps.length >= 2 && visual.steps.length <= 10
            && visual.steps.every((step) => typeof step === "string" && step.trim().length > 0 && step.length <= 100)) {
            blocks.push({ type: "flow", title: safeTitle, steps: visual.steps as string[] });
            continue;
          }
          if (language === "dashboard" && Array.isArray(visual.metrics) && visual.metrics.length > 0 && visual.metrics.length <= 8
            && visual.metrics.every((metric) => {
              if (!metric || typeof metric !== "object") return false;
              const item = metric as Record<string, unknown>;
              return typeof item.label === "string" && item.label.trim().length > 0 && item.label.length <= 48
                && (typeof item.value === "string" || (typeof item.value === "number" && Number.isFinite(item.value)))
                && String(item.value).length <= 32
                && (item.change === undefined || (typeof item.change === "string" && item.change.length <= 32));
            })
            && Array.isArray(visual.charts) && visual.charts.length <= 3 && visual.charts.every((chart) => validChart(chart, 8))) {
            blocks.push({
              type: "dashboard",
              title: safeTitle,
              metrics: (visual.metrics as Array<{ label: string; value: string | number; change?: string }>).map((metric) => ({
                label: metric.label, value: metric.value, change: metric.change,
              })),
              charts: (visual.charts as Array<{ title?: string; labels: string[]; values: number[] }>).map((chart) => ({
                title: chart.title?.slice(0, 120), labels: chart.labels, values: chart.values,
              })),
            });
            continue;
          }
        } catch {
          // Invalid visualization payloads receive a readable fallback below.
        }
        blocks.push({ type: "paragraph", text: "تعذر إنشاء العنصر المرئي بتنسيق صالح. أعد طلب الرسم أو المخطط وسأحاول إنشاءه من جديد." });
        continue;
      }
      blocks.push({ type: "code", language: fence[1] || "", code });
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s{0,3}>/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s{0,3}>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
      const headers = splitTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        const cells = splitTableRow(lines[index]);
        rows.push(headers.map((_, cellIndex) => cells[cellIndex] || ""));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const listMatch = line.match(/^\s{0,3}([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s{0,3}([-*+]|\d+[.)])\s+(.+)$/);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(item[2]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}
