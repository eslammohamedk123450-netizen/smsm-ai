const darkColors = {
  primary: "#0EA5E9",
  primaryDark: "#0284C7",
  secondary: "#0EA5E9",
  primarySoft: "#0C4A6E40",
  background: "#000000",
  surface: "#111111",
  surfaceElevated: "#1F1F1F",
  textPrimary: "#F5F5F5",
  textSecondary: "#A1A1AA",
  textMuted: "#A1A1AA",
  accent: "#0EA5E9",
  success: "#4ADE80",
  warning: "#F59E0B",
  error: "#F87171",
  freeBadge: "#0EA5E9",
  premiumBadge: "#0EA5E9",
  racingBadge: "#0EA5E9",
  divider: "#262626",
  cardBackground: "#111111",
  inputBackground: "#1F1F1F",
  inputBorder: "#262626",
  modalOverlay: "#000000CC",
} as const;

const lightColors = darkColors;

export const colors = darkColors;
export type ThemePalette = typeof darkColors;
export function getThemeColors(_mode?: "light" | "dark"): ThemePalette {
  return darkColors as ThemePalette;
}
