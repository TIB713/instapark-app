import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { getItem } from "../lib/secure";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAppStore } from "../lib/store";
import api from "../lib/api";

export default function Index() {
  const { setUser, setDriver, setCurrentEventId } = useAppStore();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const token = await getItem("auth_token");
        if (token) {
          try {
            const { data } = await api.get("/auth/me");
            setUser(data);
            setChecking(false);
            router.replace("/(admin)/dashboard");
            return;
          } catch {
            // token invalid — fall through to driver/login
          }
        }
        const ds = await AsyncStorage.getItem("driver_session");
        const eid = await AsyncStorage.getItem("current_event_id");
        if (ds) {
          const d = JSON.parse(ds);
          setDriver(d);
          if (eid) setCurrentEventId(eid);
          setChecking(false);
          router.replace("/(driver)");
          return;
        }
      } catch {}
      setChecking(false);
      router.replace("/(auth)/login");
    };
    restore();
  }, []);

  return (
    <View
      testID="splash-screen"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0F2044",
      }}
    >
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}
