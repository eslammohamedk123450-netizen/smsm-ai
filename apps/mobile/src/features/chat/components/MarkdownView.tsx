import { useMemo } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSulyTheme } from "../../../theme/ThemeProvider";
import type { ThemePalette } from "../../../theme/colors";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { parseMarkdownBlocks, type MarkdownBlock } from "./markdown-parser";

type InlineToken = { type: "text" | "bold" | "italic" | "code" | "link" | "image"; text: string; url?: string };

const inlinePattern = /(!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|(https?:\/\/[^\s<>()]+))/g;

function appendPlainTokens(tokens: InlineToken[], text: string) {
  if (text) tokens.push({ type: "text", text });
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
    else if (match[4]) tokens.push({ type: "link", text: match[5], url: match[6] });
    else if (match[7]) tokens.push({ type: "code", text: match[7] });
    else if (match[8] || match[9]) tokens.push({ type: "bold", text: match[8] || match[9] });
    else if (match[10] || match[11]) tokens.push({ type: "italic", text: match[10] || match[11] });
    else if (match[12]) {
      const cleanUrl = match[12].replace(/[.,!?،؛]+$/u, "");
      if (cleanUrl) tokens.push({ type: "link", text: cleanUrl, url: cleanUrl });
      const trailing = match[12].slice(cleanUrl.length);
      if (trailing) tokens.push({ type: "text", text: trailing });
    }
    cursor = match.index + raw.length;
  }
  if (cursor < text.length) appendPlainTokens(tokens, text.slice(cursor));
  if (!tokens.length) appendPlainTokens(tokens, text);
  return tokens;
}

function InlineText({ text, baseStyle, styles }: { text: string; baseStyle?: object; styles: ReturnType<typeof createStyles> }) {
  return <Text style={[styles.body, baseStyle]}>{parseInline(text).map((token, index) => (
    <Text key={`${token.type}-${index}`} style={tokenStyle(token, styles)} onPress={token.type === "link" && token.url ? () => { void Linking.openURL(token.url!).catch(() => undefined); } : undefined}>{token.text}</Text>
  ))}</Text>;
}

function tokenStyle(token: InlineToken, styles: ReturnType<typeof createStyles>) {
  return token.type === "bold" ? styles.bold
    : token.type === "italic" ? styles.italic
      : token.type === "code" ? styles.inlineCode
        : token.type === "link" ? styles.link : undefined;
}

function InlineFlow({ text, styles }: { text: string; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.inlineFlow}>
    {parseInline(text).map((token, index) => token.type === "image" && token.url
      ? <Image key={`image-${index}`} source={{ uri: token.url }} style={styles.image} resizeMode="contain" accessibilityLabel={token.text || "صورة في الرسالة"} />
      : token.type === "link" && token.url
        ? <Pressable key={`link-${index}`} onPress={() => { void Linking.openURL(token.url!).catch(() => undefined); }} accessibilityRole="link"><Text style={[styles.body, styles.link]}>{token.text}</Text></Pressable>
        : <Text key={`${token.type}-${index}`} style={[styles.body, tokenStyle(token, styles)]}>{token.text}</Text>)}
  </View>;
}

function toArabicDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function TokenRun({ tokens, style, styles }: { tokens: InlineToken[]; style?: object; styles: ReturnType<typeof createStyles> }) {
  return <Text style={[styles.body, style]}>{tokens.map((token, index) => (
    <Text key={`${token.type}-${index}`} style={tokenStyle(token, styles)} onPress={token.type === "link" && token.url ? () => { void Linking.openURL(token.url!).catch(() => undefined); } : undefined}>{token.text}</Text>
  ))}</Text>;
}

function StepCard({ item, itemIndex, styles }: { item: string; itemIndex: number; styles: ReturnType<typeof createStyles> }) {
  const tokens = parseInline(item);
  const titleIndex = tokens.findIndex((token) => token.type === "bold");
  const hasTitle = titleIndex >= 0 && tokens[titleIndex].text.trim().length > 0;
  const titleTokens = hasTitle ? [tokens[titleIndex]] : [];
  const descriptionTokens = hasTitle ? [...tokens.slice(0, titleIndex), ...tokens.slice(titleIndex + 1)] : tokens;
  return <View style={styles.stepCard}>
    <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{toArabicDigits(itemIndex + 1)}</Text></View>
    <View style={styles.stepContent}>
      {hasTitle ? <TokenRun tokens={titleTokens} style={styles.stepTitle} styles={styles} /> : null}
      {hasTitle ? <TokenRun tokens={descriptionTokens} style={styles.stepDescription} styles={styles} /> : <InlineFlow text={item} styles={styles} />}
    </View>
  </View>;
}

export interface MarkdownViewProps {
  content: string;
  onCopyCode?(code: string): void;
}

export function MarkdownView({ content, onCopyCode }: MarkdownViewProps) {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const blocks = parseMarkdownBlocks(content);
  return <View style={styles.container}>{blocks.map((block, index) => renderBlock(block, index, onCopyCode, styles))}</View>;
}

function renderBlock(block: MarkdownBlock, index: number, onCopyCode: ((code: string) => void) | undefined, styles: ReturnType<typeof createStyles>) {
  if (block.type === "heading") {
    const headingStyle = block.level === 1 ? styles.heading1 : block.level === 2 ? styles.heading2 : styles.heading3;
    return <InlineText key={`heading-${index}`} text={block.text} baseStyle={headingStyle} styles={styles} />;
  }
  if (block.type === "paragraph") return <InlineFlow key={`paragraph-${index}`} text={block.text} styles={styles} />;
  if (block.type === "quote") return <View key={`quote-${index}`} style={styles.quote}><InlineText text={block.text} baseStyle={styles.quoteText} styles={styles} /></View>;
  if (block.type === "list") return <View key={`list-${index}`} style={styles.list}>{block.items.map((item, itemIndex) => (
    block.ordered
      ? <StepCard key={`item-${itemIndex}`} item={item} itemIndex={itemIndex} styles={styles} />
      : <View key={`item-${itemIndex}`} style={styles.listItem}><View style={styles.bulletDot} /><View style={styles.listText}><InlineFlow text={item} styles={styles} /></View></View>
  ))}</View>;
  if (block.type === "table") return <View key={`table-${index}`} style={styles.tableCard}>
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} directionalLockEnabled bounces={false} style={styles.tableScroll} contentContainerStyle={styles.tableContent}><View>
      <View style={[styles.tableRow, styles.tableHeader]}>{block.headers.map((cell, cellIndex) => <View key={`head-${cellIndex}`} style={styles.tableCell}><InlineText text={cell} baseStyle={styles.tableHeaderText} styles={styles} /></View>)}</View>
      {block.rows.map((row, rowIndex) => <View key={`row-${rowIndex}`} style={[styles.tableRow, rowIndex % 2 === 0 ? styles.rowEven : styles.rowOdd]}>{row.map((cell, cellIndex) => <View key={`cell-${cellIndex}`} style={styles.tableCell}><InlineText text={cell} baseStyle={styles.tableText} styles={styles} /></View>)}</View>)}
    </View></ScrollView>
  </View>;
  if (block.type === "chart") {
    const maxValue = Math.max(1, ...block.values);
    return <View key={`chart-${index}`} style={styles.chartContainer}>
      {block.title ? <Text style={styles.chartTitle}>{block.title}</Text> : null}
      {block.labels.map((label, itemIndex) => {
        const value = block.values[itemIndex];
        const width = Math.max(0, Math.min(100, (value / maxValue) * 100));
        return <View key={`bar-${itemIndex}`} style={styles.chartRow}>
          <Text numberOfLines={2} style={styles.chartLabel}>{label}</Text>
          <View style={styles.chartTrack}><View style={[styles.chartBar, { width: `${width}%` }]} /></View>
          <Text style={styles.chartValue}>{value.toLocaleString()}</Text>
        </View>;
      })}
    </View>;
  }
  return <View key={`code-${index}`} style={styles.codeContainer}>
    <View style={styles.codeHeader}><Text style={styles.codeLanguage}>{block.language || "كود"}</Text><Pressable accessibilityRole="button" accessibilityLabel="نسخ الكود" onPress={() => onCopyCode?.(block.code)} style={styles.copyButton}><Text style={styles.copyText}>نسخ</Text></Pressable></View>
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} directionalLockEnabled style={styles.codeScroll} contentContainerStyle={styles.codeContent}><Text selectable style={styles.codeText}>{block.code}</Text></ScrollView>
  </View>;
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  container: { width: "100%", alignSelf: "stretch" },
  body: { color: colors.textPrimary, fontSize: 16, lineHeight: 26, textAlign: "right", writingDirection: "rtl" },
  heading1: { fontSize: 24, lineHeight: 32, fontWeight: "800", marginTop: 14, marginBottom: 10, color: colors.textPrimary, textAlign: "right", writingDirection: "rtl" },
  heading2: { fontSize: 22, lineHeight: 30, fontWeight: "800", marginTop: 14, marginBottom: 10, color: colors.textPrimary, textAlign: "right", writingDirection: "rtl" },
  heading3: { fontSize: 18, lineHeight: 26, fontWeight: "700", marginTop: 10, marginBottom: 6, color: colors.textPrimary, textAlign: "right", writingDirection: "rtl" },
  bold: { fontWeight: "700", color: colors.textPrimary }, italic: { fontStyle: "italic" }, link: { color: colors.primary, textDecorationLine: "underline", writingDirection: "ltr" },
  inlineCode: { color: colors.textPrimary, backgroundColor: colors.surfaceElevated, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontFamily: "monospace", fontSize: 14, writingDirection: "ltr", textAlign: "left" },
  ltrText: { writingDirection: "ltr", textAlign: "left" }, inlineFlow: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", width: "100%", marginBottom: 10 },
  image: { width: "100%", height: 200, borderRadius: 12, marginVertical: 8, backgroundColor: colors.surface },
  list: { marginVertical: 8, gap: 10 }, listItem: { flexDirection: "row-reverse", alignItems: "baseline", gap: 8 }, bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 8 }, listText: { flex: 1, minWidth: 0 },
  stepCard: { flexDirection: "row-reverse", alignItems: "flex-start", width: "100%", paddingVertical: 2 }, stepNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginLeft: 10 }, stepNumberText: { color: colors.onPrimary, fontSize: 14, lineHeight: 20, fontWeight: "800", textAlign: "center", writingDirection: "rtl" }, stepContent: { flex: 1, minWidth: 0 }, stepTitle: { color: colors.textPrimary, fontSize: 16, lineHeight: 25, fontWeight: "700", textAlign: "right", writingDirection: "rtl", marginBottom: 4 }, stepDescription: { color: colors.textSecondary, fontSize: 14, lineHeight: 23, textAlign: "right", writingDirection: "rtl" },
  quote: { borderRightWidth: 3, borderRightColor: colors.primary, paddingRight: 12, marginBottom: 10, backgroundColor: colors.surface, borderRadius: 8 }, quoteText: { color: colors.textSecondary, paddingVertical: 8 },
  tableCard: { marginVertical: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, overflow: "hidden" }, tableScroll: { width: "100%" }, tableContent: { minWidth: "100%" }, tableRow: { flexDirection: "row-reverse", borderBottomWidth: 1, borderBottomColor: colors.divider }, tableHeader: { backgroundColor: colors.surfaceElevated }, rowEven: { backgroundColor: colors.surface }, rowOdd: { backgroundColor: colors.surfaceElevated }, tableCell: { minWidth: 120, paddingHorizontal: 12, paddingVertical: 12, borderLeftWidth: 1, borderLeftColor: colors.divider }, tableHeaderText: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "right" }, tableText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: "right" },
  chartContainer: { width: "100%", padding: 14, marginVertical: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, gap: 12 }, chartTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "800", textAlign: "right" }, chartRow: { width: "100%", flexDirection: "row-reverse", alignItems: "center", gap: 8 }, chartLabel: { width: "28%", color: colors.textSecondary, fontSize: 12, textAlign: "right" }, chartTrack: { flex: 1, height: 10, borderRadius: 6, overflow: "hidden", backgroundColor: colors.surfaceElevated }, chartBar: { height: "100%", borderRadius: 6, backgroundColor: colors.primary }, chartValue: { minWidth: 38, color: colors.textPrimary, fontSize: 12, fontWeight: "700", textAlign: "left", writingDirection: "ltr" },
  codeContainer: { width: "100%", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, padding: 12, marginVertical: 10, overflow: "hidden" }, codeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, codeLanguage: { color: colors.textMuted, fontSize: 12, writingDirection: "ltr", textAlign: "left" }, copyButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: colors.surfaceElevated }, copyText: { color: colors.primary, fontSize: 12, fontWeight: "700" }, codeScroll: { maxHeight: 280, width: "100%" }, codeContent: { minWidth: "100%" }, codeText: { color: colors.textPrimary, fontFamily: "monospace", fontSize: 14, lineHeight: 22, writingDirection: "ltr", textAlign: "left" },
});
