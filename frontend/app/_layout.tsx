import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getItem } from "../lib/secure";
import { useAppStore } from "../lib/store";
import { AppState } from "react-native";
import { checkEventStatusAndStop } from "../lib/locationTracking";
import { cleanupOldOfflinePhotos } from "../lib/offline";
import { ConfirmDialogHost } from "../lib/confirmDialog";
import "../global.css";
import { Text, TextInput } from "react-native";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { theme } from "../utils/theme";

// @ts-ignore
if (Text.defaultProps == null) Text.defaultProps = {};
// @ts-ignore
Text.defaultProps.allowFontScaling = false;
// @ts-ignore
Text.defaultProps.maxFontSizeMultiplier = 1;
// @ts-ignore
Text.defaultProps.style = { ...Text.defaultProps?.style, fontFamily: theme.fontFamily.regular };

// @ts-ignore
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
// @ts-ignore
TextInput.defaultProps.allowFontScaling = false;
// @ts-ignore
TextInput.defaultProps.maxFontSizeMultiplier = 1;
// @ts-ignore
TextInput.defaultProps.style = { ...TextInput.defaultProps?.style, fontFamily: theme.fontFamily.regular };

export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    // Handle notification tap when app is in background or closed
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!data?.screen) return;
      switch (data.screen) {
        case 'retrievals':
          router.push('/(driver)/(tabs)' as any);
          break;
        case 'sos':
          router.push('/(supervisor)/(tabs)/event-detail');
          break;
        case 'incidents':
          router.push('/(supervisor)/(tabs)/event-detail');
          break;
        case 'event_detail':
          router.push('/(admin)/event-detail');
          break;
        default:
          break;
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const lastRole = await getItem("last_known_role");
        if (lastRole) useAppStore.setState({ lastKnownRole: lastRole });
        const eventId = await AsyncStorage.getItem("current_event_id");
        const driverStr = await AsyncStorage.getItem("driver_session");
        if (eventId) useAppStore.getState().setCurrentEventId(eventId);
        if (driverStr) {
          useAppStore.getState().setDriver(JSON.parse(driverStr));
          useAppStore.getState().fetchEvents();
        }
      } catch (e) {
        console.error("Hydration error:", e);
      }
    };
    hydrate();
    cleanupOldOfflinePhotos();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active") {
        // App came to foreground — check if event is still open
        await checkEventStatusAndStop();
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ConfirmDialogHost />
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
        <Stack.Screen name="(supervisor)" />
        <Stack.Screen name="(driver)/(tabs)" />
        <Stack.Screen name="(driver)/failed-syncs" />
              </Stack>
    </SafeAreaProvider>
  );
}
