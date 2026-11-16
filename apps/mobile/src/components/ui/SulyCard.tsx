import { StyleSheet, View, type ViewProps } from "react-native";
import { useSulyTheme } from "../../theme/ThemeProvider";
type Props = ViewProps & { padded?: boolean };
export function SulyCard({ children, style, padded = true, ...props }: Props) {
  const { colors } = useSulyTheme();
  return <View {...props} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }, padded && styles.padded, style]}>{children}</View>;
}
const styles = StyleSheet.create({ card: { borderWidth: 1, borderRadius: 18 }, padded: { padding: 16 } });
