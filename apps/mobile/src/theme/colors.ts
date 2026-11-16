const darkColors = {
  primary: "#737373", onPrimary: "#FFFFFF", /* Accessible foreground for primary surfaces. */
  primaryDark: "#525252", secondary: "#BDBDBD", primarySoft: "#FFFFFF18",
  background: "#090909", surface: "#141414", surfaceElevated: "#202020",
  textPrimary: "#F5F5F5", textSecondary: "#B7B7B7", textMuted: "#858585", accent: "#F5F5F5",
  success: "#4ADE80", warning: "#FBBF24", error: "#F87171",
  freeBadge: "#D4D4D4", premiumBadge: "#FFFFFF", racingBadge: "#A3A3A3",
  divider: "#2B2B2B", cardBackground: "#141414", inputBackground: "#1B1B1B",
  inputBorder: "#353535", modalOverlay: "#000000B8",
} as const;

const lightColors = {
  primary: "#171717", onPrimary: "#FFFFFF", /* Accessible foreground for primary surfaces. */
  primaryDark: "#000000", secondary: "#525252", primarySoft: "#1717170D",
  background: "#F7F7F7", surface: "#FFFFFF", surfaceElevated: "#F0F0F0",
  textPrimary: "#111111", textSecondary: "#525252", textMuted: "#707070", accent: "#111111",
  success: "#15803D", warning: "#A16207", error: "#B91C1C",
  freeBadge: "#404040", premiumBadge: "#111111", racingBadge: "#737373",
  divider: "#E5E5E5", cardBackground: "#FFFFFF", inputBackground: "#F3F3F3",
  inputBorder: "#D4D4D4", modalOverlay: "#00000066",
} as const;

export const colors = darkColors;
export type ThemePalette = { [K in keyof typeof darkColors]: string };

export function getThemeColors(mode: "light" | "dark" = "dark"): ThemePalette {
  return (mode === "light" ? lightColors : darkColors) as ThemePalette;
}
