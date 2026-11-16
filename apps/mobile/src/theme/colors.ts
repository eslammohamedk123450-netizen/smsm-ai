const darkColors = {
  primary: "#F5F5F5", onPrimary: "#111111",
  primaryDark: "#D4D4D4", secondary: "#BDBDBD", primarySoft: "#F5F5F51A",
  background: "#080808", surface: "#141414", surfaceElevated: "#202020",
  textPrimary: "#FAFAFA", textSecondary: "#D4D4D4", textMuted: "#A3A3A3", accent: "#F5F5F5",
  success: "#BDBDBD", warning: "#D4D4D4", error: "#F5F5F5",
  freeBadge: "#BDBDBD", premiumBadge: "#F5F5F5", racingBadge: "#D4D4D4",
  divider: "#383838", cardBackground: "#141414", inputBackground: "#101010",
  inputBorder: "#525252", modalOverlay: "#000000C7",
} as const;

const lightColors = {
  primary: "#262626", onPrimary: "#FFFFFF",
  primaryDark: "#171717", secondary: "#525252", primarySoft: "#26262618",
  background: "#FAFAFA", surface: "#FFFFFF", surfaceElevated: "#F5F5F5",
  textPrimary: "#171717", textSecondary: "#525252", textMuted: "#707070", accent: "#262626",
  success: "#404040", warning: "#525252", error: "#171717",
  freeBadge: "#525252", premiumBadge: "#262626", racingBadge: "#404040",
  divider: "#E5E5E5", cardBackground: "#FFFFFF", inputBackground: "#F5F5F5",
  inputBorder: "#D4D4D4", modalOverlay: "#00000066",
} as const;

export const colors = darkColors;
export type ThemePalette = { [K in keyof typeof darkColors]: string };

export function getThemeColors(mode: "light" | "dark" = "dark"): ThemePalette {
  return (mode === "light" ? lightColors : darkColors) as ThemePalette;
}
