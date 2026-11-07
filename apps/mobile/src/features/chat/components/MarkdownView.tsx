import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
        const value = token.type === "image" ? token.text : token.text;
        return <Text key={`${token.type}-${index}`} style={tokenStyle}>{value}</Text>;
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
    const headingStyle = block.level === 1 ? styles.heading1 : block.level === 2 ? styles.heading2 : styles.heading3;
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
            <Text style={[styles.marker, block.ordered && styles.ltrText]}>{block.ordered ? `${itemIndex + 1}.` : "•"}</Text>
            <View style={styles.listText}><InlineFlow text={item} /></View>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === "table") {
    return (
      <ScrollView key={`table-${index}`} horizontal nestedScrollEnabled showsHorizontalScrollIndicator style={styles.tableScroll} contentContainerStyle={styles.tableContent}>
        <View>
          <View style={[styles.tableRow, styles.tableHeader]}>
            {block.headers.map((cell, cellIndex) => <View key={`head-${cellIndex}`} style={styles.tableCell}><InlineText text={cell} baseStyle={styles.tableHeaderText} /></View>)}
          </View>
          {block.rows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.tableRow}>
              {row.map((cell, cellIndex) => <View key={`cell-${cellIndex}`} style={styles.tableCell}><InlineText text={cell} baseStyle={styles.tableText} /></View>)}
            </View>
          ))}
        </View>
      </ScrollView>
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
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator style={styles.codeScroll} contentContainerStyle={styles.codeContent}>
        <Text selectable style={styles.codeText}>{block.code}</Text>
      </ScrollView>
    </View>
  );
}

const webMaxWidth = Platform.OS === "web" ? 680 : undefined;
const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: webMaxWidth, alignSelf: "stretch" },
  body: { color: colors.textPrimary, fontSize: 15, lineHeight: 26, textAlign: "right", writingDirection: "rtl" },
  heading1: { fontSize: 22, lineHeight: 32, fontWeight: "700", marginTop: 4, marginBottom: 8 },
  heading2: { fontSize: 20, lineHeight: 30, fontWeight: "700", marginTop: 4, marginBottom: 8 },
  heading3: { fontSize: 18, lineHeight: 28, fontWeight: "700", marginTop: 4, marginBottom: 8 },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  inlineCode: { color: colors.primary, backgroundColor: colors.background, fontFamily: "monospace", writingDirection: "ltr", textAlign: "left" },
  ltrText: { writingDirection: "ltr", textAlign: "left" },
  inlineFlow: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", width: "100%", maxWidth: webMaxWidth, marginBottom: 12 },
  image: { width: 250, height: 210, borderRadius: 10, marginVertical: 8, backgroundColor: colors.surfaceElevated },
  list: { marginBottom: 12, gap: 4 },
  listItem: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 },
  marker: { color: colors.primary, fontSize: 15, lineHeight: 26, minWidth: 16, textAlign: "right", writingDirection: "rtl" },
  listText: { flex: 1, minWidth: 0 },
  quote: { borderRightWidth: 3, borderRightColor: colors.primary, paddingRight: 12, marginBottom: 12, backgroundColor: colors.surfaceElevated, borderRadius: 6 },
  quoteText: { color: colors.textSecondary, paddingVertical: 8 },
  tableScroll: { width: "100%", maxWidth: webMaxWidth, marginBottom: 12 },
  tableContent: { minWidth: "100%" },
  tableRow: { flexDirection: "row-reverse", borderBottomWidth: 1, borderBottomColor: colors.divider },
  tableHeader: { backgroundColor: colors.surfaceElevated },
  tableCell: { minWidth: 110, flex: 1, paddingHorizontal: 10, paddingVertical: 8, borderLeftWidth: 1, borderLeftColor: colors.divider },
  tableHeaderText: { fontWeight: "700" },
  tableText: { fontSize: 14, lineHeight: 24 },
  codeContainer: { width: "100%", maxWidth: webMaxWidth, backgroundColor: colors.background, borderRadius: 12, padding: 12, marginBottom: 12, overflow: "hidden" },
  codeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  codeLanguage: { color: colors.textMuted, fontSize: 12, writingDirection: "ltr", textAlign: "left" },
  copyButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, backgroundColor: colors.surfaceElevated },
  copyText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  codeScroll: { maxHeight: 280, width: "100%" },
  codeContent: { minWidth: "100%" },
  codeText: { color: colors.textPrimary, fontFamily: "monospace", fontSize: 13, lineHeight: 20, writingDirection: "ltr", textAlign: "left" },
});
