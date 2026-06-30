import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useAppStore = create((set) => ({
  user: null,
  driver: null,
  token: null,
  currentEventId: null,
  currentCarId: null,
  currentJourneyType: "idle",
  setUser: (user) => set({ user }),
  setDriver: (driver) => set({ driver }),
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
  signOut: () => {
    // Clear AsyncStorage keys that the background task reads
    AsyncStorage.multiRemove([
      "auth_token",
      "api_url",
      "current_event_id",
      "current_car_id",
      "current_journey_type",
    ]).catch(() => {});
    set({ user: null, driver: null, token: null, currentEventId: null, currentCarId: null, currentJourneyType: "idle" });
  },
}));
