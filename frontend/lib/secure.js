import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

export const getItem = async (key) => {
  if (isWeb) {
    try { return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null; } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
};

export const setItem = async (key, value) => {
  if (isWeb) {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); } catch {}
    return;
  }
  return SecureStore.setItemAsync(key, value);
};

export const deleteItem = async (key) => {
  if (isWeb) {
    try { if (typeof localStorage !== "undefined") localStorage.removeItem(key); } catch {}
    return;
  }
  return SecureStore.deleteItemAsync(key);
};
