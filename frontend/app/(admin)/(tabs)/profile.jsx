import React from "react";
import { View, Text, TouchableOpacity, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "../../../lib/store";
import { confirmDialog } from "../../../lib/confirmDialog";
import { theme } from "../../../utils/theme";
import { rs, rp } from "../../../utils/responsive";

import { Card, Btn } from "../../../components/valet/ui";
import { Hero } from "../../../components/admin/Hero";

export default function AdminProfile() {
  const router = useRouter();
  const { user } = useAppStore();
  const isHotelOwner = user?.provider_type === "hotel_owner";

  const handleSignOut = () => {
    const doSignOut = async () => {
      await useAppStore.getState().signOut();
      router.replace("/(auth)/login");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out?")) doSignOut();
      return;
    }
    confirmDialog.destructiveConfirm("Sign out", "Are you sure you want to sign out?", doSignOut, "Sign Out");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: rp(100) }} showsVerticalScrollIndicator={false}>
        <Hero
          align="center"
          eyebrow={isHotelOwner ? "OWNER ACCOUNT" : "ADMIN ACCOUNT"}
          title={user?.name || "Admin"}
        // badges={[{ label: isHotelOwner ? "OWNER" : "ADMIN", tone: "warning" }]}
        />

        <View style={{ paddingHorizontal: rp(theme.spacing.lg), paddingTop: rp(theme.spacing.xl), flex: 1, paddingBottom: rp(80) }}>

          <Text style={{
            fontFamily: theme.fontFamily.bold, fontSize: rs(11),
            fontWeight: "700",
            color: theme.colors.textSecondary,
            letterSpacing: rs(1.5),
            textTransform: "uppercase",
            marginBottom: rp(theme.spacing.sm),
          }}>
            NAVIGATION
          </Text>

          <Card style={{ padding: 0, overflow: 'hidden', marginBottom: rp(theme.spacing.xxl) }}>
            <TouchableOpacity
              onPress={() => router.push("/(admin)/(tabs)/hotels")}
              style={{ flexDirection: 'row', alignItems: 'center', padding: rp(theme.spacing.lg), borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
            >
              <View style={{ backgroundColor: theme.colors.infoLight, padding: rp(8), borderRadius: rp(8), marginRight: rp(theme.spacing.md) }}>
                <Ionicons name="business-outline" size={20} color={theme.colors.info} />
              </View>
              <Text style={{ fontFamily: theme.fontFamily.semibold, flex: 1, fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Hotels</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(admin)/(tabs)/all-events")}
              style={{ flexDirection: 'row', alignItems: 'center', padding: rp(theme.spacing.lg), borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
            >
              <View style={{ backgroundColor: theme.colors.primaryLight, padding: rp(8), borderRadius: rp(8), marginRight: rp(theme.spacing.md) }}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              </View>
              <Text style={{ fontFamily: theme.fontFamily.semibold, flex: 1, fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>All events</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(admin)/(tabs)/manage-employees")}
              style={{ flexDirection: 'row', alignItems: 'center', padding: rp(theme.spacing.lg) }}
            >
              <View style={{ backgroundColor: theme.colors.primaryLight, padding: rp(8), borderRadius: rp(8), marginRight: rp(theme.spacing.md) }}>
                <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
              </View>
              <Text style={{ fontFamily: theme.fontFamily.semibold, flex: 1, fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Team</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </Card>

          <Btn variant="danger" onPress={handleSignOut} style={{ marginTop: rp(40) }}>
            Sign Out
          </Btn>

        </View>
      </ScrollView>
    </View>
  );
}
