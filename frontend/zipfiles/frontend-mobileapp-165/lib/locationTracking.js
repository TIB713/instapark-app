import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { theme } from "../utils/theme";

export const LOCATION_TASK_NAME = "driver-location-tracking";

// ── Background task definition ──────────────────────────────────────────────
// Must be defined at module level (top-level) before any component uses it.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data;
  const loc = locations?.[0];
  if (!loc) return;

  try {
    const [token, eventId, carId, journeyType, apiUrl] = await Promise.all([
      AsyncStorage.getItem("auth_token"),
      AsyncStorage.getItem("current_event_id"),
      AsyncStorage.getItem("current_car_id"),
      AsyncStorage.getItem("current_journey_type"),
      AsyncStorage.getItem("api_url"),
    ]);

    console.log("[GPS_TASK] token:", token ? "present" : "MISSING", "eventId:", eventId, "apiUrl:", apiUrl);

    if (!token || !eventId || !apiUrl) {
      console.log("[GPS_TASK] aborted, missing required value");
      return;
    }

    const resp = await fetch(`${apiUrl}/drivers/location`, {
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
    console.log("[GPS_TASK] response status:", resp.status);
    if (!resp.ok) {
      const text = await resp.text();
      console.log("[GPS_TASK] error body:", text);
    }
  } catch (e) {
    console.log("[GPS_TASK] fetch threw error:", e.message);
  }
});

// ── Start tracking ───────────────────────────────────────────────────────────
export const startLocationTracking = async () => {
  try {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== "granted") return false;
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== "granted") return false;

    const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
    if (already) return true;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "InstaPark",
        notificationBody: "Tracking your location for active event",
        notificationColor: theme.colors.primary,
      },
    });
    return true;
  } catch {
    return false;
  }
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
      AsyncStorage.setItem("current_car_id", carId ? String(carId) : ""),
      AsyncStorage.setItem("current_journey_type", journeyType || "idle"),
    ]);
  } catch {}
};

// ── Track which cars this driver has explicitly acknowledged ────────────────
// A car checked in by a supervisor/admin needs the driver to actively tap
// "Accept" before GPS journey tracking starts for it — we don't want to guess.
export const isJourneyAccepted = async (carId) => {
  try {
    const raw = await AsyncStorage.getItem("accepted_journey_cars");
    const list = raw ? JSON.parse(raw) : [];
    return list.includes(carId);
  } catch {
    return false;
  }
};

export const markJourneyAccepted = async (carId) => {
  try {
    const raw = await AsyncStorage.getItem("accepted_journey_cars");
    const list = raw ? JSON.parse(raw) : [];
    if (!list.includes(carId)) {
      list.push(carId);
      // Keep this list from growing forever — 200 recent cars is plenty
      await AsyncStorage.setItem("accepted_journey_cars", JSON.stringify(list.slice(-200)));
    }
  } catch {}
};

// ── Poll event status and auto-stop ─────────────────────────────────────────
// Call this on app foreground resume and on a timer.
// Returns true if event is still active, false if closed (and tracking stopped).
export const checkEventStatusAndStop = async () => {
  const [token, eventId, apiUrl] = await Promise.all([
    AsyncStorage.getItem("auth_token"),
    AsyncStorage.getItem("current_event_id"),
    AsyncStorage.getItem("api_url"),
  ]);
  if (!token || !eventId || !apiUrl) return true; // don't stop tracking if we can't check

  try {
    const resp = await fetch(
      `${apiUrl}/events/${eventId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return true; // don't stop tracking on network error

    const event = await resp.json();

    // Only stop for explicitly closed valet events
    // Hotel daily events have no open/close lifecycle — never stop them this way
    if (event.event_type !== "hotel_daily" && event.status === "closed") {
      await stopLocationTracking();
      return false;
    }
    return true;
  } catch {
    return true; // network failure → keep tracking, try again next interval
  }
};
