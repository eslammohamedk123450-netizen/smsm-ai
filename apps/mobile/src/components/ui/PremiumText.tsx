import { StyleSheet, Text as NativeText, type TextProps } from "react-native";

export function PremiumText({ style, ...props }: TextProps) {
  const fontWeight = StyleSheet.flatten(style)?.fontWeight;
  const bold = fontWeight === "bold" || fontWeight === "600" || fontWeight === "700" || fontWeight === "800" || (typeof fontWeight === "number" && fontWeight >= 600);
  const fontFamily = bold ? "Cairo_700Bold" : "Cairo_400Regular";
  return <NativeText {...props} style={[{ fontFamily }, style]} />;
}
