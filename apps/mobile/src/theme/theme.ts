import { colors } from "./colors";

export const theme = {
  colors,
  typography: {
    fontFamily: "Cairo_400Regular",
    fontFamilyBold: "Cairo_700Bold",
    screenTitle: { fontSize: 24, lineHeight: 32, fontWeight: "700" as const },
    heroPrompt: { fontSize: 25, lineHeight: 34, fontWeight: "700" as const },
    h1: { fontSize: 22, lineHeight: 30, fontWeight: "700" as const },
    h2: { fontSize: 18, lineHeight: 26, fontWeight: "700" as const, marginTop: 12, marginBottom: 6 },
    h3: { fontSize: 16, lineHeight: 24, fontWeight: "700" as const, marginTop: 10, marginBottom: 4 },
    body: { fontSize: 15, lineHeight: 25, fontWeight: "400" as const },
    caption: { fontSize: 13, lineHeight: 20, fontWeight: "400" as const },
    meta: { fontSize: 11, lineHeight: 16, fontWeight: "400" as const },
    tableHeader: { fontSize: 13, lineHeight: 18, fontWeight: "700" as const },
    tableCell: { fontSize: 14, lineHeight: 21, fontWeight: "400" as const },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  borderRadius: { sm: 8, md: 12, lg: 18, xl: 24, full: 9999 },
  shadows: { card: { shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 } },
} as const;

export type Theme = typeof theme;
