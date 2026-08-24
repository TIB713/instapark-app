import { Stack } from "expo-router";
import { SupervisorProvider } from "../../context/SupervisorContext";

export default function SupervisorLayout() {
  return (
    <SupervisorProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SupervisorProvider>
  );
}
