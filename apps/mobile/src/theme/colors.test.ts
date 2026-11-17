import { getThemeColors } from "./colors";

function luminance(hex: string): number {
  const normalized = hex.replace("#", "").slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(normalized)) throw new Error(`Unsupported color token: ${hex}`);
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("SULY shared theme tokens", () => {
  it("provides the same semantic token set in light and dark themes", () => {
    const dark = getThemeColors("dark");
    const light = getThemeColors("light");
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    for (const [key, value] of Object.entries(dark)) {
      expect(value).toMatch(/^#[0-9a-f]{6,8}$/i);
      expect(light[key as keyof typeof light]).toMatch(/^#[0-9a-f]{6,8}$/i);
    }
  });

  it.each(["dark", "light"] as const)("keeps body text readable on every shared content surface in %s mode", (mode) => {
    const palette = getThemeColors(mode);
    const surfaces = [palette.background, palette.surface, palette.surfaceElevated, palette.cardBackground, palette.inputBackground];
    const textColors = [palette.textPrimary, palette.textSecondary, palette.textMuted];
    for (const foreground of textColors) {
      for (const background of surfaces) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(["dark", "light"] as const)("keeps primary button text readable in %s mode", (mode) => {
    const palette = getThemeColors(mode);
    expect(contrast(palette.onPrimary, palette.primary)).toBeGreaterThanOrEqual(4.5);
  });
});


  it("preserves the approved monochrome minimal identity", () => {
    const dark = getThemeColors("dark");
    const light = getThemeColors("light");
    expect(dark.primary).toBe("#F5F5F5");
    expect(dark.background).toBe("#0A0A0A");
    expect(dark.surface).toBe("#141414");
    expect(dark.surfaceElevated).toBe("#242424");
    expect(dark.textPrimary).toBe("#F7F7F7");
    expect(light.primary).toBe("#111111");
  });
