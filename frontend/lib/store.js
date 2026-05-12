import { create } from "zustand";

export const useAppStore = create((set) => ({
  user: null,
  driver: null,
  token: null,
  currentEventId: null,
  setUser: (user) => set({ user }),
  setDriver: (driver) => set({ driver }),
  setToken: (token) => set({ token }),
  setCurrentEventId: (id) => set({ currentEventId: id }),
  signOut: () =>
    set({ user: null, driver: null, token: null, currentEventId: null }),
}));
