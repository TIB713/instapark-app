import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

export const getItem = async (key) => {
  if (isWeb) {
    try { return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null; } catch { return null; }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    console.warn(`[SecureStore] getItem("${key}") failed`, e);
    return null;
  }
};

export const setItem = async (key, value) => {
  if (isWeb) {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); } catch {}
    return;
  }
  try {
    return await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.warn(`[SecureStore] setItem("${key}") failed`, e);
  }
};

export const deleteItem = async (key) => {
  if (isWeb) {
    try { if (typeof localStorage !== "undefined") localStorage.removeItem(key); } catch {}
    return;
  }
  try {
    return await SecureStore.deleteItemAsync(key);
  } catch (e) {
    console.warn(`[SecureStore] deleteItem("${key}") failed`, e);
  }
};
