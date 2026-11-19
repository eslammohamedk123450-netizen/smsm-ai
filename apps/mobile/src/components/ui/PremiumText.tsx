import { StyleSheet, Text as NativeText, type TextProps } from "react-native";
import { useAppLocale } from "../../theme/LocaleProvider";

/** Shared text primitive: keep typography and text direction in sync with the app locale. */
export function PremiumText({ style, ...props }: TextProps) {
  const { isArabic } = useAppLocale();
  const flattened = StyleSheet.flatten(style);
  const fontWeight = flattened?.fontWeight;
  const bold = fontWeight === "bold" || fontWeight === "600" || fontWeight === "700" || fontWeight === "800" || (typeof fontWeight === "number" && fontWeight >= 600);
  const fontFamily = bold ? "Cairo_700Bold" : "Cairo_400Regular";
  const textAlign = flattened?.textAlign === "right" || flattened?.textAlign === "left"
    ? (isArabic ? "right" : "left")
    : flattened?.textAlign;
  return <NativeText {...props} style={StyleSheet.flatten([{ fontFamily, writingDirection: isArabic ? "rtl" : "ltr" }, style, textAlign ? { textAlign } : null])} />;
}
