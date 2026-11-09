import { colors } from "./colors";

export const theme = {
  colors,
  typography: {
    fontFamily: "Cairo_400Regular",
    fontFamilyBold: "Cairo_700Bold",
    screenTitle: { fontSize: 20, lineHeight: 28, fontWeight: "700" as const },
    heroPrompt: { fontSize: 22, lineHeight: 30, fontWeight: "700" as const },
    h1: { fontSize: 22, lineHeight: 30, fontWeight: "700" as const },
    h2: { fontSize: 17, lineHeight: 24, fontWeight: "700" as const, marginTop: 12, marginBottom: 6 },
    h3: { fontSize: 16, lineHeight: 24, fontWeight: "700" as const, marginTop: 10, marginBottom: 4 },
    body: { fontSize: 16, lineHeight: 26, fontWeight: "400" as const },
    caption: { fontSize: 13, lineHeight: 20, fontWeight: "400" as const },
    meta: { fontSize: 11, lineHeight: 16, fontWeight: "400" as const },
    tableHeader: { fontSize: 13, lineHeight: 18, fontWeight: "700" as const },
    tableCell: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  borderRadius: { sm: 6, md: 12, lg: 16, full: 9999 },
} as const;

export type Theme = typeof theme;
