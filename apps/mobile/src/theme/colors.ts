const darkColors = {
  primary: "#0EA5E9",
  primaryDark: "#0284C7",
  secondary: "#0EA5E9",
  primarySoft: "#0C4A6E40",
  background: "#0A0F1E",
  surface: "#131C2E",
  surfaceElevated: "#182337",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#94A3B8",
  accent: "#0EA5E9",
  success: "#0EA5E9",
  warning: "#F59E0B",
  error: "#EF4444",
  freeBadge: "#0EA5E9",
  premiumBadge: "#8B5CF6",
  racingBadge: "#22D3EE",
  divider: "#1E293B",
  cardBackground: "#131C2E",
  inputBackground: "#131C2E",
  inputBorder: "#1E293B",
  modalOverlay: "#00000099",
} as const;

const lightColors = darkColors;

export const colors = darkColors;
export type ThemePalette = typeof darkColors;
export function getThemeColors(_mode?: "light" | "dark"): ThemePalette {
  return darkColors as ThemePalette;
}
