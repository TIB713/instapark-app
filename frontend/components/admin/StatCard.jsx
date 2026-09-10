import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../utils/theme";
import { rs, rp } from "../../utils/responsive";

export function StatCard({ label, value, icon, testID, onPress }) {
  const content = (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: rp(theme.radius.md),
        paddingHorizontal: rp(theme.spacing.lg),
        paddingVertical: rp(theme.spacing.lg),
        minWidth: rp(120),
        alignItems: "center",
        shadowColor: theme.colors.primary,
        shadowOpacity: 0.08,
        shadowRadius: rp(16),
        shadowOffset: { width: 0, height: rp(4) },
        elevation: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: rp(theme.spacing.sm) }}>
        <View style={{ backgroundColor: theme.colors.primaryLight, borderRadius: rp(theme.radius.pill), padding: rp(6) }}>
          <Ionicons name={icon} size={value !== null ? rs(20) : rs(24)} color={theme.colors.primary} />
        </View>
        {value !== null && (
          <Text style={{ color: theme.colors.textPrimary, fontSize: rs(theme.fontSize.display), fontWeight: "900", fontFamily: theme.fontFamily.bold }}>
            {value}
          </Text>
        )}
      </View>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: rs(theme.fontSize.caption),
          fontWeight: theme.fontWeight.bold,
          fontFamily: theme.fontFamily.bold,
          letterSpacing: rs(2),
          marginTop: rp(theme.spacing.sm),
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View testID={testID}>{content}</View>;
}
