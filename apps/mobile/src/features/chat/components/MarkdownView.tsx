import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
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
  return <Text style={[styles.body, baseStyle]}>{parseInline(text).map((token, index) => (
    <Text key={`${token.type}-${index}`} style={tokenStyle(token)}>{token.text}</Text>
  ))}</Text>;
}

function tokenStyle(token: InlineToken) {
  return token.type === "bold" ? styles.bold
    : token.type === "italic" ? styles.italic
      : token.type === "code" ? styles.inlineCode
        : token.type === "link" ? styles.ltrText : undefined;
}

function InlineFlow({ text }: { text: string }) {
  return <View style={styles.inlineFlow}>
    {parseInline(text).map((token, index) => token.type === "image" && token.url
      ? <Image key={`image-${index}`} source={{ uri: token.url }} style={styles.image} resizeMode="contain" accessibilityLabel={token.text || "صورة في الرسالة"} />
      : <Text key={`${token.type}-${index}`} style={[styles.body, tokenStyle(token)]}>{token.text}</Text>)}
  </View>;
}

function toArabicDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function TokenRun({ tokens, style }: { tokens: InlineToken[]; style?: object }) {
  return <Text style={[styles.body, style]}>{tokens.map((token, index) => (
    <Text key={`${token.type}-${index}`} style={tokenStyle(token)}>{token.text}</Text>
  ))}</Text>;
}

function StepCard({ item, itemIndex }: { item: string; itemIndex: number }) {
  const tokens = parseInline(item);
  const titleIndex = tokens.findIndex((token) => token.type === "bold");
  const hasTitle = titleIndex >= 0 && tokens[titleIndex].text.trim().length > 0;
  const titleTokens = hasTitle ? [tokens[titleIndex]] : [];
  const descriptionTokens = hasTitle ? [...tokens.slice(0, titleIndex), ...tokens.slice(titleIndex + 1)] : tokens;
  return <View style={styles.stepCard}>
    <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{toArabicDigits(itemIndex + 1)}</Text></View>
    <View style={styles.stepContent}>
      {hasTitle ? <TokenRun tokens={titleTokens} style={styles.stepTitle} /> : null}
      {hasTitle ? <TokenRun tokens={descriptionTokens} style={styles.stepDescription} /> : <InlineFlow text={item} />}
    </View>
  </View>;
}

export interface MarkdownViewProps {
  content: string;
  onCopyCode?(code: string): void;
}

export function MarkdownView({ content, onCopyCode }: MarkdownViewProps) {
  const blocks = parseMarkdownBlocks(content);
  return <View style={styles.container}>{blocks.map((block, index) => renderBlock(block, index, onCopyCode))}</View>;
}

function renderBlock(block: MarkdownBlock, index: number, onCopyCode?: (code: string) => void) {
  if (block.type === "heading") {
    const headingStyle = block.level === 1 ? styles.heading1 : block.level === 2 ? styles.heading2 : styles.heading3;
    return <InlineText key={`heading-${index}`} text={block.text} baseStyle={headingStyle} />;
  }
  if (block.type === "paragraph") return <InlineFlow key={`paragraph-${index}`} text={block.text} />;
  if (block.type === "quote") return <View key={`quote-${index}`} style={styles.quote}><InlineText text={block.text} baseStyle={styles.quoteText} /></View>;
  if (block.type === "list") return <View key={`list-${index}`} style={styles.list}>{block.items.map((item, itemIndex) => (
    block.ordered
      ? <StepCard key={`item-${itemIndex}`} item={item} itemIndex={itemIndex} />
      : <View key={`item-${itemIndex}`} style={styles.listItem}><View style={styles.bulletDot} /><View style={styles.listText}><InlineFlow text={item} /></View></View>
  ))}</View>;
  if (block.type === "table") return <View key={`table-${index}`} style={styles.tableCard}>
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} directionalLockEnabled bounces={false} style={styles.tableScroll} contentContainerStyle={styles.tableContent}><View>
      <View style={[styles.tableRow, styles.tableHeader]}>{block.headers.map((cell, cellIndex) => <View key={`head-${cellIndex}`} style={styles.tableCell}><InlineText text={cell} baseStyle={styles.tableHeaderText} /></View>)}</View>
      {block.rows.map((row, rowIndex) => <View key={`row-${rowIndex}`} style={[styles.tableRow, rowIndex % 2 === 0 ? styles.rowEven : styles.rowOdd]}>{row.map((cell, cellIndex) => <View key={`cell-${cellIndex}`} style={styles.tableCell}><InlineText text={cell} baseStyle={styles.tableText} /></View>)}</View>)}
    </View></ScrollView>
  </View>;
  return <View key={`code-${index}`} style={styles.codeContainer}>
    <View style={styles.codeHeader}><Text style={styles.codeLanguage}>{block.language || "كود"}</Text><Pressable accessibilityRole="button" accessibilityLabel="نسخ الكود" onPress={() => onCopyCode?.(block.code)} style={styles.copyButton}><Text style={styles.copyText}>نسخ</Text></Pressable></View>
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} directionalLockEnabled style={styles.codeScroll} contentContainerStyle={styles.codeContent}><Text selectable style={styles.codeText}>{block.code}</Text></ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { width: "100%", alignSelf: "stretch" },
  body: { color: "#F5F5F5", fontSize: 16, lineHeight: 26, textAlign: "right", writingDirection: "rtl" },
  heading1: { fontSize: 24, lineHeight: 32, fontWeight: "800", marginTop: 14, marginBottom: 10, color: "#FFFFFF", textAlign: "right", writingDirection: "rtl" },
  heading2: { fontSize: 22, lineHeight: 30, fontWeight: "800", marginTop: 14, marginBottom: 10, color: "#FFFFFF", textAlign: "right", writingDirection: "rtl" },
  heading3: { fontSize: 18, lineHeight: 26, fontWeight: "700", marginTop: 10, marginBottom: 6, color: "#FFFFFF", textAlign: "right", writingDirection: "rtl" },
  bold: { fontWeight: "700", color: "#FFFFFF" }, italic: { fontStyle: "italic" },
  inlineCode: { color: "#F5F5F5", backgroundColor: "#262626", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontFamily: "monospace", fontSize: 14, writingDirection: "ltr", textAlign: "left" },
  ltrText: { writingDirection: "ltr", textAlign: "left" }, inlineFlow: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", width: "100%", marginBottom: 10 },
  image: { width: "100%", height: 200, borderRadius: 12, marginVertical: 8, backgroundColor: "#111111" },
  list: { marginVertical: 8, gap: 10 }, listItem: { flexDirection: "row-reverse", alignItems: "baseline", gap: 8 }, bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0EA5E9", marginTop: 8 }, listText: { flex: 1, minWidth: 0 },
  stepCard: { flexDirection: "row-reverse", alignItems: "flex-start", width: "100%", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#2D3748", backgroundColor: "#171717" }, stepNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#0EA5E9", alignItems: "center", justifyContent: "center", marginLeft: 10 }, stepNumberText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20, fontWeight: "800", textAlign: "center", writingDirection: "rtl" }, stepContent: { flex: 1, minWidth: 0 }, stepTitle: { color: "#FFFFFF", fontSize: 16, lineHeight: 25, fontWeight: "700", textAlign: "right", writingDirection: "rtl", marginBottom: 4 }, stepDescription: { color: "#D1D5DB", fontSize: 14, lineHeight: 23, textAlign: "right", writingDirection: "rtl" },
  quote: { borderRightWidth: 3, borderRightColor: "#0EA5E9", paddingRight: 12, marginBottom: 10, backgroundColor: "#111111", borderRadius: 8 }, quoteText: { color: "#A1A1AA", paddingVertical: 8 },
  tableCard: { marginVertical: 12, borderRadius: 12, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#262626", overflow: "hidden" }, tableScroll: { width: "100%" }, tableContent: { minWidth: "100%" }, tableRow: { flexDirection: "row-reverse", borderBottomWidth: 1, borderBottomColor: "#262626" }, tableHeader: { backgroundColor: "#262626" }, rowEven: { backgroundColor: "#1A1A1A" }, rowOdd: { backgroundColor: "#141414" }, tableCell: { minWidth: 120, paddingHorizontal: 12, paddingVertical: 12, borderLeftWidth: 1, borderLeftColor: "#262626" }, tableHeaderText: { color: "#F5F5F5", fontSize: 13, fontWeight: "700", textAlign: "right" }, tableText: { color: "#D1D5DB", fontSize: 14, lineHeight: 22, textAlign: "right" },
  codeContainer: { width: "100%", backgroundColor: "#1A1A1A", borderRadius: 12, borderWidth: 1, borderColor: "#262626", padding: 12, marginVertical: 10, overflow: "hidden" }, codeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, codeLanguage: { color: "#A1A1AA", fontSize: 12, writingDirection: "ltr", textAlign: "left" }, copyButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#262626" }, copyText: { color: "#0EA5E9", fontSize: 12, fontWeight: "700" }, codeScroll: { maxHeight: 280, width: "100%" }, codeContent: { minWidth: "100%" }, codeText: { color: "#F5F5F5", fontFamily: "monospace", fontSize: 14, lineHeight: 22, writingDirection: "ltr", textAlign: "left" },
});
