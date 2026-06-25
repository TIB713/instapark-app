import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const LOCATION_TASK_NAME = "driver-location-tracking";

// ── Background task definition ──────────────────────────────────────────────
// Must be defined at module level (top-level) before any component uses it.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data;
  const loc = locations?.[0];
  if (!loc) return;

  try {
    // Read all needed values from AsyncStorage (survives app kills)
    const [token, eventId, carId, journeyType] = await Promise.all([
      AsyncStorage.getItem("auth_token"),
      AsyncStorage.getItem("current_event_id"),
      AsyncStorage.getItem("current_car_id"),
      AsyncStorage.getItem("current_journey_type"),
    ]);

    if (!token || !eventId) return;

    await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/drivers/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        event_id: eventId,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        car_id: carId || null,
        journey_type: journeyType || "idle",
      }),
    });
  } catch {}
});

// ── Start tracking ───────────────────────────────────────────────────────────
export const startLocationTracking = async () => {
  try {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== "granted") return;
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== "granted") return;

    const already = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    ).catch(() => false);
    if (already) return;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
      distanceInterval: 10,          // only ping when moved 10+ metres
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "InstaPark",
        notificationBody: "Tracking your location for active event",
        notificationColor: "#059669",
      },
    });
  } catch {}
};

// ── Stop tracking ────────────────────────────────────────────────────────────
export const stopLocationTracking = async () => {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    ).catch(() => false);
    if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

    // Clear journey state from AsyncStorage
    await AsyncStorage.multiRemove([
      "current_event_id",
      "current_car_id",
      "current_journey_type",
    ]);
  } catch {}
};

// ── Update journey context ───────────────────────────────────────────────────
// Call this whenever the driver starts/finishes handling a car.
// carId: string | null
// journeyType: "idle" | "checkin" | "parked" | "retrieval" | "delivered"
export const updateJourney = async (carId, journeyType) => {
  try {
    await Promise.all([
      AsyncStorage.setItem("current_car_id", carId || ""),
      AsyncStorage.setItem("current_journey_type", journeyType || "idle"),
    ]);
  } catch {}
};

// ── Poll event status and auto-stop ─────────────────────────────────────────
// Call this on app foreground resume and on a timer.
// Returns true if event is still active, false if closed (and tracking stopped).
export const checkEventStatusAndStop = async () => {
  try {
    const [token, eventId] = await Promise.all([
      AsyncStorage.getItem("auth_token"),
      AsyncStorage.getItem("current_event_id"),
    ]);
    if (!token || !eventId) return false;

    const resp = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/api/v1/events/${eventId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return false;
    const event = await resp.json();

    if (event.status === "closed") {
      await stopLocationTracking();
      return false;
    }
    return true;
  } catch {
    return false;
  }
};
