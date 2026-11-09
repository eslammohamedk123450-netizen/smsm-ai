import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const renderBlocks = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Skip blank lines
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Corporate Table Detection (markdown tables starting with |)
      if (line.trim().startsWith('|') && line.includes('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const headerRow = parseTableRow(tableLines[0]);
          const hasSeparator = tableLines.length > 1 && tableLines[1].includes('---');
          const dataRows = tableLines.slice(hasSeparator ? 2 : 1).map(parseTableRow);

          elements.push(
            <div
              key={`table-${i}`}
              className="my-3 overflow-x-auto rounded-[12px] bg-[#1A1A1A] border border-[#262626]"
            >
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-[#262626] border-b border-[#262626]">
                    {headerRow.map((cell, idx) => (
                      <th
                        key={idx}
                        className="p-[12px] text-[#F5F5F5] text-[13px] font-bold whitespace-nowrap text-right border-l border-[#262626] last:border-l-0"
                      >
                        {formatInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, rIdx) => {
                    const isEven = rIdx % 2 === 0;
                    return (
                      <tr
                        key={rIdx}
                        className={`border-b border-[#262626] last:border-b-0 ${
                          isEven ? 'bg-[#1A1A1A]' : 'bg-[#141414]'
                        } hover:bg-white/[0.03] transition-colors`}
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="p-[12px] text-[#D1D5DB] text-[14px] whitespace-nowrap text-right border-l border-[#262626] last:border-l-0"
                          >
                            {formatInline(cell)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // H2 Headings: حجم 17 Bold و lineHeight 24 ومسافة فوقها 12 وتحتها 6
      if (line.startsWith('## ')) {
        elements.push(
          <h2
            key={i}
            className="text-[17px] font-bold leading-[24px] text-[#F5F5F5] mt-[12px] mb-[6px]"
          >
            {formatInline(line.replace('## ', ''))}
          </h2>
        );
        i++;
        continue;
      }

      // H3 Headings: حجم 16 Bold و lineHeight 24
      if (line.startsWith('### ')) {
        elements.push(
          <h3
            key={i}
            className="text-[16px] font-bold leading-[24px] text-[#F5F5F5] mt-[12px] mb-[6px]"
          >
            {formatInline(line.replace('### ', ''))}
          </h3>
        );
        i++;
        continue;
      }

      // H1 Headings fallback
      if (line.startsWith('# ')) {
        elements.push(
          <h2
            key={i}
            className="text-[17px] font-bold leading-[24px] text-[#F5F5F5] mt-[12px] mb-[6px]"
          >
            {formatInline(line.replace('# ', ''))}
          </h2>
        );
        i++;
        continue;
      }

      // Bullet List item:
      // نقطة صغيرة بلون #0EA5E9، ومسافة ثابتة 8 بين النقطة والنص، ومسافة 6 بين كل سطر والتاني
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const itemText = line.trim().replace(/^[*|-]\s+/, '');
        elements.push(
          <div
            key={i}
            className="flex items-start gap-[8px] my-[6px] text-[16px] leading-[26px] text-[#F5F5F5]"
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] inline-block mt-[10px] shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1 text-[#F5F5F5] text-[16px] leading-[26px]">
              {formatInline(itemText)}
            </div>
          </div>
        );
        i++;
        continue;
      }

      // Numbered List:
      // الأرقام 1. 2. 3. على نفس سطر النص وليست على سطر منفصل
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        const num = numMatch[1];
        const itemText = numMatch[2];
        elements.push(
          <div
            key={i}
            className="flex items-baseline gap-[8px] my-[6px] text-[16px] leading-[26px] text-[#F5F5F5]"
          >
            <span className="font-bold text-[#F5F5F5] text-[16px] leading-[26px] select-none shrink-0 min-w-[20px]">
              {num}.
            </span>
            <div className="flex-1 text-[#F5F5F5] text-[16px] leading-[26px]">
              {formatInline(itemText)}
            </div>
          </div>
        );
        i++;
        continue;
      }

      // Regular Paragraph: حجم 16 Regular و lineHeight 26 و لون #F5F5F5
      elements.push(
        <p key={i} className="text-[16px] font-normal leading-[26px] text-[#F5F5F5] my-[6px]">
          {formatInline(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  return <div className="space-y-[4px]">{renderBlocks()}</div>;
};

// Helper to parse cells from markdown pipe line
function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
}

// Helper to format inline styling (bold, code)
function formatInline(text: string): React.ReactNode {
  // Bold matches: **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-[#F5F5F5]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Inline Code: خلفية #262626 و borderRadius 6 و padding 4 وخط Monospace حجم 14
    if (part.includes('`')) {
      const codeParts = part.split(/(`.*?`)/g);
      return (
        <React.Fragment key={index}>
          {codeParts.map((sub, sIdx) => {
            if (sub.startsWith('`') && sub.endsWith('`')) {
              return (
                <code
                  key={sIdx}
                  className="bg-[#262626] rounded-[6px] p-[4px] font-mono text-[14px] text-[#F5F5F5] mx-1 inline-block"
                >
                  {sub.slice(1, -1)}
                </code>
              );
            }
            return sub;
          })}
        </React.Fragment>
      );
    }
    return part;
  });
}
