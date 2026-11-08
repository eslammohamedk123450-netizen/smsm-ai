import { colors } from "./colors";

export const theme = {
  colors,
  typography: {
    fontFamily: "Cairo_400Regular",
    h1: { fontSize: 22, fontWeight: "700" as const },
    h2: { fontSize: 22, fontWeight: "700" as const },
    h3: { fontSize: 18, fontWeight: "700" as const },
    body: { fontSize: 16, lineHeight: 26, fontWeight: "400" as const },
    caption: { fontSize: 13, fontWeight: "400" as const },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 20, xl: 28 },
  borderRadius: { sm: 8, md: 14, lg: 16, full: 999 },
} as const;
