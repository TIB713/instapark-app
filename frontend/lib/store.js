import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useAppStore = create((set) => ({
  user: null,
  driver: null,
  token: null,
  currentEventId: null,
  setUser: (user) => set({ user }),
  setDriver: (driver) => set({ driver }),
  setToken: (token) => set({ token }),
  setCurrentEventId: (id) => {
    set({ currentEventId: id });
    AsyncStorage.setItem("current_event_id", id || "").catch(() => {});
  },
  signOut: () =>
    set({ user: null, driver: null, token: null, currentEventId: null }),
}));
