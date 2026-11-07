import { colors } from "./colors";

export const theme = {
  colors,
  typography: {
    fontFamily: "Inter, Helvetica, sans-serif",
    h1: { fontSize: 28, fontWeight: "700" as const },
    h2: { fontSize: 22, fontWeight: "700" as const },
    h3: { fontSize: 18, fontWeight: "700" as const },
    body: { fontSize: 15, fontWeight: "400" as const },
    caption: { fontSize: 12, fontWeight: "400" as const },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 8, md: 12, lg: 16, full: 999 },
} as const;
