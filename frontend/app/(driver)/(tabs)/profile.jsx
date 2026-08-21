import React, { useState } from 'react';
import { View, Text, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../../lib/store';
import { deleteItem } from '../../../lib/secure';
import { confirmDialog } from '../../../lib/confirmDialog';
import { Screen, TopBar, Card, Btn, StatusPill, Sheet, EmptyState } from '../../../components/valet/ui';
import { rp, rs } from '../../../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../utils/theme';
import Heading from '../../../components/Heading';
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../../lib/api";
import { startLocationTracking, stopLocationTracking, updateJourney } from "../../../lib/locationTracking";

export default function ProfileScreen() {
  const router = useRouter();
  const { driver, currentEventId, events, signOut, fetchDriverProfile } = useAppStore();
  const currentEvent = events?.find(e => e.id === currentEventId);
  const [sheetOpen, setSheetOpen] = useState(false);

  React.useEffect(() => {
    if (fetchDriverProfile) {
      fetchDriverProfile();
    }
  }, []);

  const initials = driver?.name?.substring(0, 2)?.toUpperCase() || "DR";
  const isAvailable = driver?.duty_status === "available" || driver?.duty_status === "busy";

  const handleSignOut = () => {
    const doSignOut = async () => {
      try {
        const driverId = driver?.id || driver?.user_id;
        if (driverId) {
          api.patch(`/drivers/${driverId}/duty-status`, { duty_status: "offline" }).catch(() => { });
        }
        await stopLocationTracking();
        await useAppStore.getState().signOut();
      } catch (e) {
        console.warn("Failed to clear auth storage", e);
      }
      router.replace("/(auth)/login");
    };

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out?")) doSignOut();
    } else {
      confirmDialog.destructiveConfirm("Sign out", "Are you sure you want to sign out?", doSignOut, "Sign Out");
    }
  };

  const openEvent = async (e) => {
    useAppStore.getState().setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    await updateJourney(null, "idle");
    const locationStarted = await startLocationTracking();
    if (!locationStarted) {
      confirmDialog.info(
        "Location permission needed",
        "InstaPark couldn't start sharing your location. Your supervisor won't be able to see you on the map. Please enable location permission for this app in your device settings."
      );
    }
    const driverId = driver?.id || driver?.user_id;
    if (driverId) {
      api.patch(`/drivers/${driverId}/duty-status`, { duty_status: "available" }).catch(() => { });
    }
    setSheetOpen(false);
  };

  return (
    <Screen scroll={true}>
      <TopBar title="Profile" />

      <View style={{ paddingHorizontal: rp(theme.spacing.lg), paddingTop: rp(theme.spacing.xxl), paddingBottom: rp(40) }}>

        {/* Driver Info Card */}
        <Card style={{ marginBottom: rp(theme.spacing.xxl), alignItems: 'center' }}>
          <View style={{
            width: rp(80),
            height: rp(80),
            borderRadius: rp(40),
            backgroundColor: theme.colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: rp(theme.spacing.lg)
          }}>
            <Heading level="display" style={{ color: theme.colors.primary }}>
              {initials}
            </Heading>
          </View>

          <Text style={{ fontSize: rs(theme.fontSize.title), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, marginBottom: rp(theme.spacing.xs) }}>
            {driver?.name || "Driver"}
          </Text>
          <Text style={{ fontSize: rs(theme.fontSize.body), color: theme.colors.textSecondary, marginBottom: rp(theme.spacing.lg) }}>
            {driver?.phone || "No phone number"}
          </Text>

          <View style={{ flexDirection: 'row', gap: rp(theme.spacing.md) }}>
            <StatusPill
              label={driver?.is_verified ? "Verified" : "Unverified"}
              tone={driver?.is_verified ? "success" : "warning"}
              icon={driver?.is_verified ? "checkmark-circle" : "warning"}
            />
            <StatusPill
              label={isAvailable ? "ON DUTY" : "OFF DUTY"}
              tone={isAvailable ? "success" : "neutral"}
            />
          </View>
        </Card>

        {/* Current Event Card */}
        <Card style={{ marginBottom: rp(theme.spacing.xxl) }}>
          <Text style={{ fontSize: rs(theme.fontSize.caption), fontWeight: theme.fontWeight.bold, color: theme.colors.textSecondary, letterSpacing: rs(1.5), marginBottom: rp(theme.spacing.md) }}>
            ACTIVE EVENT
          </Text>

          {currentEventId ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: rp(theme.spacing.xl) }}>
              <View style={{ flex: 1, paddingRight: rp(theme.spacing.lg) }}>
                <Text style={{ fontSize: rs(theme.fontSize.subtitle), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary }} numberOfLines={2}>
                  {currentEvent?.name || currentEventId}
                </Text>
                {currentEvent?.venue && (
                  <Text style={{ fontSize: rs(theme.fontSize.body), color: theme.colors.textSecondary, marginTop: rp(theme.spacing.xs) }}>
                    {currentEvent.venue}
                  </Text>
                )}
              </View>
              <View style={{ width: rp(48), height: rp(48), borderRadius: rp(24), backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="calendar" size={24} color={theme.colors.textSecondary} />
              </View>
            </View>
          ) : (
            <View style={{ marginBottom: rp(theme.spacing.xl) }}>
              <Text style={{ fontSize: rs(theme.fontSize.body), color: theme.colors.textSecondary }}>No event selected</Text>
            </View>
          )}

          <Btn variant="outline" onPress={() => setSheetOpen(true)}>
            Select Event
          </Btn>
        </Card>

        {/* Sign Out Button */}
        <Btn variant="danger" onPress={handleSignOut} testID="driver-signout">
          Sign Out
        </Btn>

      </View>

      {/* Select Event Sheet */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Text style={{
          fontSize: rs(theme.fontSize.subtitle),
          fontWeight: theme.fontWeight.bold,
          color: theme.colors.textPrimary,
          paddingHorizontal: rp(theme.spacing.lg),
          marginBottom: rp(theme.spacing.md)
        }}>
          Select Event
        </Text>
        {events?.length === 0 ? (
          <EmptyState
            title="No active events assigned"
            body="Contact your admin to get assigned."
            icon={<Ionicons name="calendar-outline" size={48} color={theme.colors.textMuted} />}
          />
        ) : (
          <ScrollView contentContainerStyle={{ padding: rp(theme.spacing.lg), gap: rp(theme.spacing.md), paddingBottom: rp(100) }}>
            {events?.map((e) => (
              <TouchableOpacity key={e.id} onPress={() => openEvent(e)} activeOpacity={0.7}>
                <Card style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderColor: currentEventId === e.id ? theme.colors.primary : theme.colors.border,
                  borderWidth: currentEventId === e.id ? 2 : 1,
                  padding: rp(theme.spacing.md)
                }}>
                  <View style={{ width: rp(40), height: rp(40), borderRadius: rp(20), backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: rp(theme.spacing.md) }}>
                    <Ionicons name="location" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: rs(theme.fontSize.bodyLarge), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary }} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={{ fontSize: rs(theme.fontSize.body), color: theme.colors.textSecondary }} numberOfLines={1}>
                      {e.venue}
                    </Text>
                    {e.date && (
                      <Text style={{ fontSize: rs(theme.fontSize.caption), color: theme.colors.textMuted, marginTop: rp(2) }}>
                        {e.date}
                      </Text>
                    )}
                  </View>
                  {currentEventId === e.id && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
                  )}
                </Card>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </Sheet>
    </Screen>
  );
}
