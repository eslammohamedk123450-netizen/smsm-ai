import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { colors } from "../../../theme/colors";
import { parseMarkdownBlocks, type MarkdownBlock } from "./markdown-parser";

type InlineToken = { type: "text" | "bold" | "italic" | "code" | "link" | "image"; text: string; url?: string };

const inlinePattern = /(!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s]*)?))/g;

function appendPlainTokens(tokens: InlineToken[], text: string) {
  const numberPattern = /([0-9٠-٩]+(?:[.,:/-][0-9٠-٩]+)*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = numberPattern.exec(text)) !== null) {
    if (match.index > cursor) tokens.push({ type: "text", text: text.slice(cursor, match.index) });
    tokens.push({ type: "link", text: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length || text.length === 0) tokens.push({ type: "text", text: text.slice(cursor) });
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let cursor = 0;
  inlinePattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > cursor) appendPlainTokens(tokens, text.slice(cursor, match.index));
    const raw = match[0];
    if (match[1]) tokens.push({ type: "image", text: match[2], url: match[3] });
    else if (match[4]) tokens.push({ type: "code", text: match[4] });
    else if (match[5] || match[6]) tokens.push({ type: "bold", text: match[5] || match[6] });
    else if (match[7] || match[8]) tokens.push({ type: "italic", text: match[7] || match[8] });
    else if (match[9]) tokens.push({ type: "image", text: match[9], url: match[9] });
    cursor = match.index + raw.length;
  }
  if (cursor < text.length || tokens.length === 0) appendPlainTokens(tokens, text.slice(cursor));
  return tokens;
}

function InlineText({ text, baseStyle }: { text: string; baseStyle?: object }) {
  return (
    <Text style={[styles.body, baseStyle]}>
      {parseInline(text).map((token, index) => {
        const tokenStyle = token.type === "bold" ? styles.bold
          : token.type === "italic" ? styles.italic
            : token.type === "code" ? styles.inlineCode
              : token.type === "link" ? styles.ltrText : null;
        return <Text key={`${token.type}-${index}`} style={tokenStyle}>{token.text}</Text>;
      })}
    </Text>
  );
}

function InlineFlow({ text }: { text: string }) {
  return (
    <View style={styles.inlineFlow}>
      {parseInline(text).map((token, index) => token.type === "image" && token.url
        ? <Image key={`image-${index}`} source={{ uri: token.url }} style={styles.image} resizeMode="contain" accessibilityLabel={token.text || "صورة في الرسالة"} />
        : <Text key={`${token.type}-${index}`} style={[
          styles.body,
          token.type === "bold" && styles.bold,
          token.type === "italic" && styles.italic,
          token.type === "code" && styles.inlineCode,
          token.type === "link" && styles.ltrText,
        ]}>{token.text}</Text>)}
    </View>
  );
}

export interface MarkdownViewProps {
  content: string;
  onCopyCode?(code: string): void;
}

export function MarkdownView({ content, onCopyCode }: MarkdownViewProps) {
  const blocks = parseMarkdownBlocks(content);
  return (
    <View style={styles.container}>
      {blocks.map((block, index) => renderBlock(block, index, onCopyCode))}
    </View>
  );
}

function renderBlock(block: MarkdownBlock, index: number, onCopyCode?: (code: string) => void) {
  if (block.type === "heading") {
    const headingStyle = block.level === 1 ? styles.heading2 : block.level === 2 ? styles.heading2 : styles.heading3;
    return <InlineText key={`heading-${index}`} text={block.text} baseStyle={headingStyle} />;
  }
  if (block.type === "paragraph") return <InlineFlow key={`paragraph-${index}`} text={block.text} />;
  if (block.type === "quote") {
    return <View key={`quote-${index}`} style={styles.quote}><InlineText text={block.text} baseStyle={styles.quoteText} /></View>;
  }
  if (block.type === "list") {
    return (
      <View key={`list-${index}`} style={styles.list}>
        {block.items.map((item, itemIndex) => (
          <View key={`item-${itemIndex}`} style={styles.listItem}>
            {block.ordered ? (
              <Text style={styles.orderedMarker}>{`${itemIndex + 1}.`}</Text>
            ) : (
              <View style={styles.bulletDot} />
            )}
            <View style={styles.listText}><InlineFlow text={item} /></View>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === "table") {
    return (
      <View key={`table-${index}`} style={styles.tableCard}>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} directionalLockEnabled bounces={false} style={styles.tableScroll} contentContainerStyle={styles.tableContent}>
          <View>
            <View style={[styles.tableRow, styles.tableHeader]}>
              {block.headers.map((cell, cellIndex) => (
                <View key={`head-${cellIndex}`} style={styles.tableCell}>
                  <InlineText text={cell} baseStyle={styles.tableHeaderText} />
                </View>
              ))}
            </View>
            {block.rows.map((row, rowIndex) => {
              const isEven = rowIndex % 2 === 0;
              return (
                <View key={`row-${rowIndex}`} style={[styles.tableRow, isEven ? styles.rowEven : styles.rowOdd]}>
                  {row.map((cell, cellIndex) => (
                    <View key={`cell-${cellIndex}`} style={styles.tableCell}>
                      <InlineText text={cell} baseStyle={styles.tableText} />
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }
  return (
    <View key={`code-${index}`} style={styles.codeContainer}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLanguage}>{block.language || "كود"}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="نسخ الكود" onPress={() => onCopyCode?.(block.code)} style={styles.copyButton}>
          <Text style={styles.copyText}>نسخ</Text>
        </Pressable>
      </View>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} directionalLockEnabled style={styles.codeScroll} contentContainerStyle={styles.codeContent}>
        <Text selectable style={styles.codeText}>{block.code}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", alignSelf: "stretch" },
  body: { color: "#F5F5F5", fontSize: 16, lineHeight: 26, textAlign: "right", writingDirection: "rtl" },
  heading2: { fontSize: 17, lineHeight: 24, fontWeight: "700", marginTop: 12, marginBottom: 6, color: "#F5F5F5" },
  heading3: { fontSize: 16, lineHeight: 24, fontWeight: "700", marginTop: 10, marginBottom: 4, color: "#F5F5F5" },
  bold: { fontWeight: "700", color: "#FFFFFF" },
  italic: { fontStyle: "italic" },
  inlineCode: { color: "#F5F5F5", backgroundColor: "#262626", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontFamily: "monospace", fontSize: 14, writingDirection: "ltr", textAlign: "left" },
  ltrText: { writingDirection: "ltr", textAlign: "left" },
  inlineFlow: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", width: "100%", marginBottom: 8 },
  image: { width: "100%", height: 200, borderRadius: 12, marginVertical: 8, backgroundColor: "#111111" },
  list: { marginVertical: 6, gap: 6 },
  listItem: { flexDirection: "row-reverse", alignItems: "baseline", gap: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0EA5E9", marginTop: 8 },
  orderedMarker: { color: "#F5F5F5", fontSize: 16, lineHeight: 26, fontWeight: "700", minWidth: 20, textAlign: "right", writingDirection: "rtl" },
  listText: { flex: 1, minWidth: 0 },
  quote: { borderRightWidth: 3, borderRightColor: "#0EA5E9", paddingRight: 12, marginBottom: 10, backgroundColor: "#111111", borderRadius: 8 },
  quoteText: { color: "#A1A1AA", paddingVertical: 8 },
  tableCard: {
    marginVertical: 12,
    borderRadius: 12,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#262626",
    overflow: "hidden",
  },
  tableScroll: { width: "100%" },
  tableContent: { minWidth: "100%" },
  tableRow: { flexDirection: "row-reverse", borderBottomWidth: 1, borderBottomColor: "#262626" },
  tableHeader: { backgroundColor: "#262626" },
  rowEven: { backgroundColor: "#1A1A1A" },
  rowOdd: { backgroundColor: "#141414" },
  tableCell: { minWidth: 120, paddingHorizontal: 12, paddingVertical: 12, borderLeftWidth: 1, borderLeftColor: "#262626" },
  tableHeaderText: { color: "#F5F5F5", fontSize: 13, fontWeight: "700", textAlign: "right" },
  tableText: { color: "#D1D5DB", fontSize: 14, lineHeight: 22, textAlign: "right" },
  codeContainer: { width: "100%", backgroundColor: "#1A1A1A", borderRadius: 12, borderWidth: 1, borderColor: "#262626", padding: 12, marginVertical: 10, overflow: "hidden" },
  codeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  codeLanguage: { color: "#A1A1AA", fontSize: 12, writingDirection: "ltr", textAlign: "left" },
  copyButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#262626" },
  copyText: { color: "#0EA5E9", fontSize: 12, fontWeight: "700" },
  codeScroll: { maxHeight: 280, width: "100%" },
  codeContent: { minWidth: "100%" },
  codeText: { color: "#F5F5F5", fontFamily: "monospace", fontSize: 14, lineHeight: 22, writingDirection: "ltr", textAlign: "left" },
});
