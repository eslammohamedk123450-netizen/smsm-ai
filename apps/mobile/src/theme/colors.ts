const darkColors = {
  primary: "#10B981",
  primaryDark: "#059669",
  secondary: "#10B981",
  background: "#0F172A",
  surface: "#1E293B",
  surfaceElevated: "#334155",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  accent: "#10B981",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  freeBadge: "#10B981",
  premiumBadge: "#8B5CF6",
  racingBadge: "#22D3EE",
  divider: "#334155",
  cardBackground: "#1E293B",
  inputBackground: "#1E293B",
  inputBorder: "#334155",
} as const;

const lightColors = {
  primary: "#059669",
  primaryDark: "#047857",
  secondary: "#059669",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceElevated: "#F1F5F9",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  accent: "#059669",
  success: "#059669",
  warning: "#B45309",
  error: "#DC2626",
  freeBadge: "#059669",
  premiumBadge: "#7C3AED",
  racingBadge: "#0891B2",
  divider: "#E2E8F0",
  cardBackground: "#FFFFFF",
  inputBackground: "#F1F5F9",
  inputBorder: "#CBD5E1",
} as const;

export const colors = darkColors;
export type ThemePalette = typeof darkColors;
export function getThemeColors(mode: "light" | "dark"): ThemePalette {
  return (mode === "light" ? lightColors : darkColors) as ThemePalette;
}
