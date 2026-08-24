import { useAppStore } from "./store";

export function getRouteForRole(role) {
  if (role === "admin" || role === "owner" || role === "superadmin") {
    return "/(admin)/dashboard";
  } else if (role === "supervisor") {
    return "/(supervisor)/(tabs)";
  } else if (role === "driver") {
    const currentEventId = useAppStore.getState().currentEventId;
    return currentEventId ? "/(driver)/(tabs)" : "/(driver)/(tabs)/profile";
  }
  return "/";
}

