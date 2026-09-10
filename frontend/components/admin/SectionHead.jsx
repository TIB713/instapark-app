import { View, Text } from "react-native";
import { TouchableOpacity } from "react-native";
import { theme } from "../../utils/theme";
import { rs, rp } from "../../utils/responsive";

export function SectionHead({ title, actionLabel, onActionPress, style }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rp(theme.spacing.sm) }, style]}>
      <Text
        style={{
          fontSize: rs(theme.fontSize.caption),
          fontWeight: theme.fontWeight.bold,
          fontFamily: theme.fontFamily.bold,
          color: theme.colors.textSecondary,
          letterSpacing: rs(3),
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
      {actionLabel && onActionPress && (
        <TouchableOpacity onPress={onActionPress} activeOpacity={0.7}>
          <Text style={{ fontSize: rs(theme.fontSize.caption), fontWeight: theme.fontWeight.bold, fontFamily: theme.fontFamily.bold, color: theme.colors.primary }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
