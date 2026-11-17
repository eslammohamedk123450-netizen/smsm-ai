const darkColors = {
  primary: "#F5F5F5",
  onPrimary: "#111111",
  primaryDark: "#D4D4D4",
  secondary: "#D4D4D4",
  primarySoft: "#FFFFFF18",
  background: "#0A0A0A",
  surface: "#141414",
  surfaceElevated: "#242424",
  textPrimary: "#F7F7F7",
  textSecondary: "#B8B8B8",
  textMuted: "#929292",
  accent: "#F5F5F5",
  success: "#D4D4D4",
  warning: "#B8B8B8",
  error: "#F0F0F0",
  freeBadge: "#A3A3A3",
  premiumBadge: "#F5F5F5",
  racingBadge: "#D4D4D4",
  divider: "#303030",
  cardBackground: "#141414",
  inputBackground: "#101010",
  inputBorder: "#3A3A3A",
  modalOverlay: "#000000B8",
} as const;

const lightColors = {
  primary: "#111111",
  onPrimary: "#FFFFFF",
  primaryDark: "#262626",
  secondary: "#404040",
  primarySoft: "#11111112",
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceElevated: "#F3F3F3",
  textPrimary: "#111111",
  textSecondary: "#555555",
  textMuted: "#6B6B6B",
  accent: "#111111",
  success: "#404040",
  warning: "#666666",
  error: "#262626",
  freeBadge: "#737373",
  premiumBadge: "#111111",
  racingBadge: "#404040",
  divider: "#E5E5E5",
  cardBackground: "#FFFFFF",
  inputBackground: "#F7F7F7",
  inputBorder: "#D4D4D4",
  modalOverlay: "#00000066",
} as const;

export const colors = darkColors;
export type ThemePalette = { [K in keyof typeof darkColors]: string };

export function getThemeColors(mode: "light" | "dark" = "dark"): ThemePalette {
  return (mode === "light" ? lightColors : darkColors) as ThemePalette;
}
