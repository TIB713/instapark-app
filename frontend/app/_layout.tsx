import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

export default function RootLayout() {
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
        <Stack.Screen name="(admin)/manage-drivers" />
        <Stack.Screen name="(admin)/driver-stats" />
        <Stack.Screen name="(admin)/qr-display" />
        <Stack.Screen name="(driver)/index" />
        <Stack.Screen name="(driver)/checkin" />
        <Stack.Screen name="(driver)/qr-display" />
        <Stack.Screen name="(driver)/tasks" />
      </Stack>
    </SafeAreaProvider>
  );
}
