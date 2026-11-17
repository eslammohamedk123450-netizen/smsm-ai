const darkColors = {
  primary: "#D4AF37", onPrimary: "#080B14",
  primaryDark: "#B88A2B", secondary: "#B88A2B", primarySoft: "#D4AF3720",
  background: "#080B14", surface: "#151A27", surfaceElevated: "#252B3A",
  textPrimary: "#F5F0E2", textSecondary: "#D9D3C4", textMuted: "#9B9AA2", accent: "#D4AF37",
  success: "#63A985", warning: "#D5A64A", error: "#D56C6C",
  freeBadge: "#9B9AA2", premiumBadge: "#D4AF37", racingBadge: "#B88A2B",
  divider: "#343A49", cardBackground: "#151A27", inputBackground: "#101522",
  inputBorder: "#41485A", modalOverlay: "#000000B8",
} as const;

const lightColors = {
  primary: "#9B7417", onPrimary: "#FFFFFF",
  primaryDark: "#806013", secondary: "#A47B20", primarySoft: "#B88A2B20",
  background: "#FAF8F1", surface: "#FFFFFF", surfaceElevated: "#F1ECDD",
  textPrimary: "#1F1D18", textSecondary: "#514B3F", textMuted: "#777165", accent: "#9B7417",
  success: "#337B58", warning: "#9B7417", error: "#B64D4D",
  freeBadge: "#777165", premiumBadge: "#9B7417", racingBadge: "#A47B20",
  divider: "#E2DCCB", cardBackground: "#FFFFFF", inputBackground: "#F6F2E8",
  inputBorder: "#CFC6B3", modalOverlay: "#00000066",
} as const;

export const colors = darkColors;
export type ThemePalette = { [K in keyof typeof darkColors]: string };

export function getThemeColors(mode: "light" | "dark" = "dark"): ThemePalette {
  return (mode === "light" ? lightColors : darkColors) as ThemePalette;
}