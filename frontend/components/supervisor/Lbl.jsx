import React from "react";
import { Text } from "react-native";
import { rs, rp } from "../../utils/responsive";
import { theme } from "../../utils/theme";

export function Lbl({ children }) {
  return (
    <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(3), marginBottom: rp(theme.spacing.sm), marginTop: rp(theme.spacing.xs) }}>
      {children}
    </Text>
  );
}
