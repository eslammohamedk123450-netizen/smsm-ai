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

const lightColors = {
  primary: "#0284C7",
  primaryDark: "#0369A1",
  secondary: "#0284C7",
  primarySoft: "#E0F2FE",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceElevated: "#F1F5F9",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  accent: "#0284C7",
  success: "#15803D",
  warning: "#B45309",
  error: "#DC2626",
  freeBadge: "#0284C7",
  premiumBadge: "#0284C7",
  racingBadge: "#0284C7",
  divider: "#CBD5E1",
  cardBackground: "#FFFFFF",
  inputBackground: "#F1F5F9",
  inputBorder: "#CBD5E1",
  modalOverlay: "#0F172A80",
} as const;

export const colors = darkColors;
export type ThemePalette = typeof darkColors;

export function getThemeColors(mode: "light" | "dark"" = "dark"): ThemePalette {
  return (mode === "light" ? lightColors : darkColors) as ThemePalette;
}
