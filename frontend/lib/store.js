import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import { deleteItem as secureDelete } from "./secure";
export const useAppStore = create((set, get) => ({
  user: null,
  driver: null,
  token: null,
  currentEventId: null,
  currentCarId: null,
  currentJourneyType: "idle",
  events: [],
  setUser: (user) => set({ user }),
  setDriver: (driver) => set({ driver }),
  setEvents: (events) => set({ events }),
  fetchEvents: async () => {
    const driver = get().driver;
    const driverId = driver?.id || driver?.user_id;
    if (!driverId) return;
    try {
      const { data } = await api.get(`/drivers/${driverId}/events`);
      set({ events: data || [] });
    } catch (e) {
      console.warn("Failed to fetch driver events", e);
    }
  },
  fetchDriverProfile: async () => {
    const driver = get().driver;
    const driverId = driver?.id || driver?.user_id;
    if (!driverId) return;
    try {
      const { data } = await api.get(`/drivers/${driverId}`);
      const newDriver = { ...driver, ...data };
      set({ driver: newDriver });
      await AsyncStorage.setItem("driver_session", JSON.stringify(newDriver));
    } catch (e) {
      console.warn("Failed to fetch driver profile", e);
    }
  },
  setToken: (token) => set({ token }),
  setCurrentEventId: (id) => {
    set({ currentEventId: id });
    AsyncStorage.setItem("current_event_id", id || "").catch(() => {});
  },
  setCurrentCarId: (id) => {
    set({ currentCarId: id });
    AsyncStorage.setItem("current_car_id", id || "").catch(() => {});
  },
  setCurrentJourneyType: (type) => {
    set({ currentJourneyType: type });
    AsyncStorage.setItem("current_journey_type", type || "idle").catch(() => {});
  },
  signOut: async () => {
    await secureDelete("auth_token").catch(() => {});
    await secureDelete("last_known_role").catch(() => {});
    await AsyncStorage.multiRemove([
      "auth_token",
      "api_url",
      "current_event_id",
      "current_car_id",
      "current_journey_type",
      "driver_session",
      "admin_session",
    ]).catch(() => {});
    set({ user: null, driver: null, token: null, currentEventId: null, currentCarId: null, currentJourneyType: "idle" });
  },
}));
