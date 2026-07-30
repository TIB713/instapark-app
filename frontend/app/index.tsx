import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { getItem, setItem, deleteItem as secureDelete } from "../lib/secure";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAppStore } from "../lib/store";
import api from "../lib/api";
import { getRouteForRole } from "../lib/routeForRole";

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const token = await getItem("auth_token");
        if (token) {
          try {
            const { data } = await api.get("/auth/me");
            const role = data.role;
            
            if (role === "admin" || role === "superadmin" || role === "owner") {
              await AsyncStorage.removeItem("driver_session");
              useAppStore.getState().signOut();
              useAppStore.getState().setUser(data);
            } else if (role === "supervisor") {
              useAppStore.getState().setUser(data);
            } else if (role === "driver") {
              const driverData = {
                id: data.user_id || data.id,
                name: data.name,
                role: data.role,
                provider_id: data.provider_id,
              };
              await AsyncStorage.setItem("driver_session", JSON.stringify(driverData));
              const eid = await AsyncStorage.getItem("current_event_id");
              useAppStore.getState().signOut();
              useAppStore.getState().setDriver(driverData);
              if (eid) useAppStore.getState().setCurrentEventId(eid);
            }

            setChecking(false);
            router.replace(getRouteForRole(role));
            return;

          } catch {
            await secureDelete("auth_token");
            await setItem("last_known_role", "");
            setChecking(false);
            router.replace("/(auth)/login");
            return;
          }
        }
        const ds = await AsyncStorage.getItem("driver_session");
        const eid = await AsyncStorage.getItem("current_event_id");
        if (ds) {
          const d = JSON.parse(ds);
          useAppStore.getState().setDriver(d);
          if (eid) useAppStore.getState().setCurrentEventId(eid);
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
      style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#6D28D9" }}
    >
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}
