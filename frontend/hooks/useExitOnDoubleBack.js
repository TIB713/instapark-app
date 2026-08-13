import { useEffect, useRef } from "react";
import { BackHandler, ToastAndroid, Platform } from "react-native";

export function useExitOnDoubleBack(message = "Press back again to exit") {
  const lastBackPressRef = useRef(0);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressRef.current = now;
      if (Platform.OS === "android") {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      }
      return true;
    });
    return () => sub.remove();
  }, [message]);
}
