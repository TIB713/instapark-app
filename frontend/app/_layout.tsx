import { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getItem } from "../lib/secure";
import { useAppStore } from "../lib/store";
import { cleanupOldOfflinePhotos } from "../lib/offline";
import "../global.css";

export default function RootLayout() {
  useEffect(() => {
    const hydrate = async () => {
      try {
        const lastRole = await getItem("last_known_role");
        if (lastRole) useAppStore.setState({ lastKnownRole: lastRole });
        const eventId = await AsyncStorage.getItem("current_event_id");
        const driverStr = await AsyncStorage.getItem("driver_data");
        if (eventId) useAppStore.getState().setCurrentEventId(eventId);
        if (driverStr) useAppStore.getState().setDriver(JSON.parse(driverStr));
      } catch (e) {
        console.error("Hydration error:", e);
      }
    };
    hydrate();
    cleanupOldOfflinePhotos();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(admin)/dashboard" />
        <Stack.Screen name="(admin)/create-event" />
        <Stack.Screen name="(admin)/edit-event" />
        <Stack.Screen name="(admin)/event-detail" />
        <Stack.Screen name="(admin)/all-events" />
        <Stack.Screen name="(admin)/driver-stats" />
        <Stack.Screen name="(admin)/driver-event-cars" />
        <Stack.Screen name="(admin)/supervisor-detail" />
        <Stack.Screen name="(admin)/qr-display" />
        <Stack.Screen name="(admin)/hotels" />
        <Stack.Screen name="(admin)/hotel-detail" />
        <Stack.Screen name="(admin)/manage-employees" />
        <Stack.Screen name="(admin)/pre-register-qr" />
        <Stack.Screen name="(driver)/scanner" />
        <Stack.Screen name="(supervisor)/dashboard" />
        <Stack.Screen name="(supervisor)/event-detail" />
        <Stack.Screen name="(supervisor)/manage-employees" />
        <Stack.Screen name="(driver)/index" />
        <Stack.Screen name="(driver)/checkin" />
        <Stack.Screen name="(driver)/qr-display" />
        <Stack.Screen name="(driver)/tasks" />
        <Stack.Screen name="(driver)/failed-syncs" />
      </Stack>
    </SafeAreaProvider>
  );
}
