import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewProps } from "react-native";
import { useSulyTheme } from "../../theme/ThemeProvider";

type Props = { children: React.ReactNode; scroll?: boolean; contentContainerStyle?: ScrollViewProps["contentContainerStyle"]; style?: ViewProps["style"] };
export function SulyScreen({ children, scroll = false, contentContainerStyle, style }: Props) {
  const { colors } = useSulyTheme();
  if (scroll) return <ScrollView style={[styles.screen, { backgroundColor: colors.background }, style]} contentContainerStyle={[styles.content, contentContainerStyle]}>{children}</ScrollView>;
  return <View style={[styles.screen, { backgroundColor: colors.background }, style]}>{children}</View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, minWidth: 0 }, content: { width: "100%", maxWidth: 1120, alignSelf: "center", padding: 20, paddingBottom: 40, gap: 16 } });
