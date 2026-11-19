import { useEffect, useMemo, useRef, useState, createElement } from "react";
import { Platform } from "react-native";
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSulyTheme } from "../../../theme/ThemeProvider";
import type { ThemePalette } from "../../../theme/colors";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { parseMarkdownBlocks, type MarkdownBlock } from "./markdown-parser";
import { getPlaygroundIssue } from "./playground-validation";

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

function ChartRows({ labels, values, styles }: { labels: string[]; values: number[]; styles: ReturnType<typeof createStyles> }) {
  const maxValue = Math.max(1, ...values);
  return <View style={styles.chartRows}>
    {labels.map((label, itemIndex) => {
      const value = values[itemIndex];
      const height = value === 0 ? 0 : Math.max(4, Math.min(100, (value / maxValue) * 100));
      return <View key={`bar-${itemIndex}`} style={styles.chartColumn}>
        <Text numberOfLines={1} style={styles.chartValue}>{value.toLocaleString()}</Text>
        <View style={styles.chartPlot}>
          <View style={[styles.chartBar, { height: `${height}%` }]} />
        </View>
        <Text numberOfLines={2} style={styles.chartLabel}>{label}</Text>
      </View>;
    })}
  </View>;
}

function makePlaygroundDocument(language: string, code: string): string {
  const lang = language.trim().toLowerCase();
  const safeCode = JSON.stringify(code).replace(/</g, "\\u003c");
  if (/^(html|htm|html5)$/.test(lang)) {
    const source = code.trim();
    // srcDoc needs a complete document for consistent rendering across mobile browsers.
    if (/^<!doctype\s+html/i.test(source) || /<html[\s>]/i.test(source)) return source;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${source}</body></html>`;
  }
  if (/^(javascript|js|jsx)$/.test(lang)) return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px system-ui;margin:12px}pre{white-space:pre-wrap;background:#f3f4f6;padding:10px;border-radius:8px}#out{direction:ltr;text-align:left}</style><h3>Console / Output</h3><pre id="out"></pre><script>const out=document.getElementById('out');const log=(...a)=>out.textContent+=a.map(x=>typeof x==='object'?JSON.stringify(x):String(x)).join(' ')+'\\n';console.log=log;console.error=(...a)=>log('ERROR:',...a);try{eval(${safeCode})}catch(e){log(e.stack||e)}</script>`;
  if (/^(typescript|ts)$/.test(lang)) return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px system-ui;margin:12px}pre{white-space:pre-wrap;background:#f3f4f6;padding:10px;border-radius:8px}#out{direction:ltr;text-align:left}</style><h3>Console / Output</h3><pre id="out"></pre><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><script>const out=document.getElementById('out');const log=(...a)=>out.textContent+=a.map(x=>typeof x==='object'?JSON.stringify(x):String(x)).join(' ')+'\\n';console.log=log;console.error=(...a)=>log('ERROR:',...a);try{const transpiled=Babel.transform(${safeCode},{presets:['typescript']}).code;eval(transpiled)}catch(e){log(e.stack||e)}</script>`;
  if (/^(python|py)$/.test(lang)) return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px system-ui;margin:12px}pre{white-space:pre-wrap;background:#f3f4f6;padding:10px;border-radius:8px}#out{direction:ltr;text-align:left}</style><h3>Python Output</h3><pre id="out">جاري تحميل بيئة Python…</pre><script src="https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js"></script><script>const out=document.getElementById('out');const source=${safeCode};(async()=>{try{const py=await loadPyodide();let logs=[];py.setStdout({batched:(s)=>logs.push(s)});py.setStderr({batched:(s)=>logs.push('ERROR: '+s)});await py.runPythonAsync(source);out.textContent=logs.join('\\n')||'تم التنفيذ بنجاح (لا يوجد إخراج)'}catch(e){out.textContent=e.stack||e}})()</script>`;
  return "";
}
function CodePlayground(props: { language: string; code: string; incomplete?: boolean; onCopyCode?: (code: string) => void; styles: ReturnType<typeof createStyles> }) {
  const [preview, setPreview] = useState(false);
  const [mobileMode, setMobileMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenUnavailable, setFullscreenUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const previewContainerRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const syncFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    if (Platform.OS !== "web") return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (previewContainerRef.current?.requestFullscreen) {
        await previewContainerRef.current.requestFullscreen();
        setFullscreenUnavailable(false);
      } else {
        setFullscreenUnavailable(true);
      }
    } catch {
      setFullscreenUnavailable(true);
    }
  };
  const lang = props.language.trim().toLowerCase();
  const supported = /^(html|htm|html5|javascript|js|jsx|typescript|ts|python|py)$/.test(lang);
  const canPreview = Platform.OS === "web" && supported;
  const previewIssue = canPreview ? getPlaygroundIssue(lang, props.code, props.incomplete) : null;
  const iframe = canPreview && preview && !previewIssue ? createElement("iframe", { key: revision, title: mobileMode ? "Mobile app preview" : "Code playground", srcDoc: makePlaygroundDocument(lang, props.code), sandbox: "allow-scripts", style: { display: "block", width: "100%", minWidth: "100%", height: isFullscreen ? "100%" : mobileMode ? "780px" : "360px", minHeight: isFullscreen ? "100%" : mobileMode ? "780px" : "360px", border: "0", background: "#fff", flex: "0 0 auto" } } as any) : null;
  return <View style={props.styles.codeContainer}>
    <View style={props.styles.codeHeader}>
      <Text style={props.styles.codeLanguage}>{props.language || "كود"}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {canPreview ? <Pressable disabled={!!previewIssue} onPress={() => setPreview(v => !v)} style={[props.styles.copyButton, previewIssue ? { opacity: 0.45 } : null]}><Text style={props.styles.copyText}>{preview ? "عرض الكود" : "تشغيل ▶"}</Text></Pressable> : null}
        {canPreview && preview ? <Pressable onPress={() => setMobileMode(v => !v)} style={[props.styles.copyButton, mobileMode ? props.styles.activePreviewButton : null]}><Text style={props.styles.copyText}>{mobileMode ? "وضع عادي" : "📱 وضع الهاتف"}</Text></Pressable> : null}
        {canPreview && preview ? <Pressable onPress={toggleFullscreen} style={props.styles.copyButton}><Text style={props.styles.copyText}>{isFullscreen ? "تصغير ⤢" : "تكبير ⛶"}</Text></Pressable> : null}
        {canPreview && preview ? <Pressable onPress={() => setRevision(v => v + 1)} style={props.styles.copyButton}><Text style={props.styles.copyText}>إعادة ↻</Text></Pressable> : null}
        <Pressable onPress={() => props.onCopyCode?.(props.code)} style={props.styles.copyButton}><Text style={props.styles.copyText}>نسخ</Text></Pressable>
      </View>
    </View>
    {preview && !previewIssue ? <View ref={previewContainerRef} style={[props.styles.previewFrame, mobileMode ? props.styles.mobilePreviewFrame : null, isFullscreen ? props.styles.fullscreenPreviewFrame : null]}>{mobileMode && !isFullscreen ? <View style={props.styles.mobilePreviewShell}><View style={props.styles.mobilePreviewCamera} />{iframe}</View> : iframe}</View> : <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} directionalLockEnabled style={props.styles.codeScroll} contentContainerStyle={props.styles.codeContent}><Text selectable style={props.styles.codeText}>{props.code}</Text></ScrollView>}
    {fullscreenUnavailable ? <Text style={props.styles.previewHint}>وضع ملء الشاشة غير مدعوم في هذا المتصفح. يمكنك استخدام وضع الهاتف داخل المعاينة.</Text> : null}
    {previewIssue ? <Text style={props.styles.previewHint}>{previewIssue}</Text> : canPreview ? <Text style={props.styles.previewHint}>التشغيل داخل إطار معزول. يحتاج TypeScript وPython اتصالًا لتحميل بيئة التشغيل.</Text> : null}
  </View>;
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
  if (block.type === "agent") return <View key={`agent-${index}`} style={styles.agentCard}>
    <Text style={styles.agentTitle}>{block.title || "SULY AI"}</Text>
    <Text style={styles.agentMessage}>{block.message}</Text>
  </View>;
  if (block.type === "chart") return <View key={`chart-${index}`} style={styles.chartContainer}>
    {block.title ? <Text style={styles.chartTitle}>{block.title}</Text> : null}
    <ChartRows labels={block.labels} values={block.values} styles={styles} />
  </View>;
  if (block.type === "flow") return <View key={`flow-${index}`} style={styles.flowContainer}>
    {block.title ? <Text style={styles.chartTitle}>{block.title}</Text> : null}
    {block.steps.map((step, stepIndex) => <View key={`flow-step-${stepIndex}`} style={styles.flowStepGroup}>
      <View style={styles.flowNode}><Text style={styles.flowNodeText}>{step}</Text></View>
      {stepIndex < block.steps.length - 1 ? <Text style={styles.flowArrow}>↓</Text> : null}
    </View>)}
  </View>;
  if (block.type === "dashboard") return <View key={`dashboard-${index}`} style={styles.dashboardContainer}>
    {block.title ? <Text style={styles.dashboardTitle}>{block.title}</Text> : null}
    <View style={styles.dashboardMetrics}>
      {block.metrics.map((metric, metricIndex) => <View key={`metric-${metricIndex}`} style={styles.metricCard}>
        <Text style={styles.metricLabel}>{metric.label}</Text>
        <Text style={styles.metricValue}>{String(metric.value)}</Text>
        {metric.change ? <Text style={styles.metricChange}>{metric.change}</Text> : null}
      </View>)}
    </View>
    {block.charts.map((chart, chartIndex) => <View key={`dashboard-chart-${chartIndex}`} style={styles.chartContainer}>
      {chart.title ? <Text style={styles.chartTitle}>{chart.title}</Text> : null}
      <ChartRows labels={chart.labels} values={chart.values} styles={styles} />
    </View>)}
  </View>;
  return <CodePlayground language={block.language} code={block.code} incomplete={block.incomplete} onCopyCode={onCopyCode} styles={styles} />;
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
  tableCard: { marginVertical: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, overflow: "hidden" }, tableScroll: { width: "100%" }, tableContent: { minWidth: "100%" }, tableRow: { flexDirection: "row-reverse", borderBottomWidth: 1, borderBottomColor: colors.divider }, tableHeader: { backgroundColor: colors.surfaceElevated }, rowEven: { backgroundColor: colors.surface }, rowOdd: { backgroundColor: colors.surfaceElevated }, tableCell: { flexGrow: 1, flexShrink: 0, minWidth: 120, paddingHorizontal: 12, paddingVertical: 12, borderLeftWidth: 1, borderLeftColor: colors.divider }, tableHeaderText: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "right" }, tableText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: "right" },
  agentCard: { width: "100%", padding: 12, marginVertical: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, gap: 7 }, agentTitle: { color: colors.primary, fontSize: 13, fontWeight: "800", textAlign: "right" }, agentMessage: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, textAlign: "right" },
  chartContainer: { width: "100%", padding: 14, marginVertical: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, gap: 12 }, chartRows: { width: "100%", minHeight: 150, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 5 }, chartTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "800", textAlign: "right" }, chartColumn: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "flex-end", gap: 5 }, chartPlot: { width: "100%", height: 104, alignItems: "center", justifyContent: "flex-end", borderBottomWidth: 1, borderBottomColor: colors.divider }, chartLabel: { width: "100%", color: colors.textSecondary, fontSize: 10, lineHeight: 14, textAlign: "center" }, chartBar: { width: "66%", minHeight: 2, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: colors.primary }, chartValue: { color: colors.textPrimary, fontSize: 10, fontWeight: "700", textAlign: "center", writingDirection: "ltr" },
  flowContainer: { width: "100%", padding: 14, marginVertical: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, alignItems: "center", gap: 4 }, flowStepGroup: { width: "100%", alignItems: "center" }, flowNode: { width: "100%", minHeight: 48, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surfaceElevated }, flowNodeText: { color: colors.textPrimary, fontSize: 14, lineHeight: 21, fontWeight: "600", textAlign: "center" }, flowArrow: { color: colors.primary, fontSize: 24, lineHeight: 30, fontWeight: "700" },
  dashboardContainer: { width: "100%", padding: 12, marginVertical: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, gap: 10 }, dashboardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "right", marginBottom: 2 }, dashboardMetrics: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }, metricCard: { width: "48%", minHeight: 82, padding: 11, borderRadius: 11, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.divider, gap: 5 }, metricLabel: { color: colors.textMuted, fontSize: 12, textAlign: "right" }, metricValue: { color: colors.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: "800", textAlign: "right" }, metricChange: { color: colors.primary, fontSize: 11, fontWeight: "700", textAlign: "right" },
  previewFrame: { width: "100%", minHeight: 360, overflow: "hidden", borderRadius: 8, backgroundColor: "#fff" }, mobilePreviewFrame: { width: "100%", maxWidth: 390, minHeight: 0, height: 780, alignSelf: "center", padding: 8, borderRadius: 28, borderWidth: 3, borderColor: "#343844", backgroundColor: "#11131a" }, mobilePreviewShell: { width: "100%", height: "100%", overflow: "hidden", borderRadius: 20, backgroundColor: "#fff" }, mobilePreviewCamera: { height: 12, width: "100%", backgroundColor: "#11131a" }, fullscreenPreviewFrame: { position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 99999, width: "100vw", height: "100vh", minHeight: 0, maxWidth: "none", borderRadius: 0, padding: 0, backgroundColor: "#080b14" } as any, activePreviewButton: { borderWidth: 1, borderColor: colors.primary }, previewHint: { color: colors.textMuted, fontSize: 11, textAlign: "left", marginTop: 6 }, codeContainer: { width: "100%", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, padding: 12, marginVertical: 10, overflow: "hidden" }, codeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, codeLanguage: { color: colors.textMuted, fontSize: 12, writingDirection: "ltr", textAlign: "left" }, copyButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: colors.surfaceElevated }, copyText: { color: colors.primary, fontSize: 12, fontWeight: "700" }, codeScroll: { maxHeight: 280, width: "100%" }, codeContent: { minWidth: "100%" }, codeText: { color: colors.textPrimary, fontFamily: "monospace", fontSize: 14, lineHeight: 22, writingDirection: "ltr", textAlign: "left" },
});
