const darkColors = {
  primary: "#D4AF37", onPrimary: "#080B14",
  primaryDark: "#B88A2B", secondary: "#B8B8B8", primarySoft: "#D4AF3720",
  background: "#080B14", surface: "#151A27", surfaceElevated: "#252B3A",
  textPrimary: "#F5F0E2", textSecondary: "#C3C0B7", textMuted: "#96938B", accent: "#D4AF37",
  success: "#4ADE80", warning: "#FBBF24", error: "#F87171",
  freeBadge: "#C3C0B7", premiumBadge: "#D4AF37", racingBadge: "#B88A2B",
  divider: "#303747", cardBackground: "#151A27", inputBackground: "#101522",
  inputBorder: "#3A4252", modalOverlay: "#000000C7",
} as const;

const lightColors = {
  primary: "#B88A2B", onPrimary: "#FFFFFF",
  primaryDark: "#8F6A1D", secondary: "#5B5A55", primarySoft: "#B88A2B18",
  background: "#F7F5EF", surface: "#FFFFFF", surfaceElevated: "#F0EDE4",
  textPrimary: "#171A22", textSecondary: "#55565A", textMuted: "#77766F", accent: "#9B741F",
  success: "#15803D", warning: "#A16207", error: "#B91C1C",
  freeBadge: "#55565A", premiumBadge: "#9B741F", racingBadge: "#8F6A1D",
  divider: "#E5E0D4", cardBackground: "#FFFFFF", inputBackground: "#F5F2EA",
  inputBorder: "#D8D1C1", modalOverlay: "#00000066",
} as const;

export const colors = darkColors;
export type ThemePalette = { [K in keyof typeof darkColors]: string };

export function getThemeColors(mode: "light" | "dark" = "dark"): ThemePalette {
  return (mode === "light" ? lightColors : darkColors) as ThemePalette;
}
