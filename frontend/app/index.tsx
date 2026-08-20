// code before full redesign
import { useEffect, useState, useRef } from "react";
import { View, Text, Animated, Easing, Image } from "react-native";
import AppLoader from "../components/AppLoader";
import { getItem, setItem, deleteItem as secureDelete } from "../lib/secure";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAppStore } from "../lib/store";
import api from "../lib/api";
import { getRouteForRole } from "../lib/routeForRole";

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [readyRoute, setReadyRoute] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const loadStartTime = useRef(Date.now()).current;
  
  useEffect(() => {
    if (readyRoute) {
      const elapsed = Date.now() - loadStartTime;
      const delay = Math.max(0, 5000 - elapsed);

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 350,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 350,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          })
        ]).start(() => {
          router.replace(readyRoute);
        });
      }, delay);
    }
  }, [readyRoute]);



  useEffect(() => {
    const restore = async () => {
      const handleSuccess = async (data) => {
        const role = data.role;
        if (role === "admin" || role === "superadmin" || role === "owner") {
          await AsyncStorage.removeItem("driver_session");
          useAppStore.getState().setUser(data);
          useAppStore.getState().setDriver(null);
        } else if (role === "supervisor") {
          await AsyncStorage.removeItem("driver_session");
          useAppStore.getState().setUser(data);
          useAppStore.getState().setDriver(null);
        } else if (role === "driver") {
          await AsyncStorage.removeItem("admin_session");
          const driverData = {
            id: data.user_id || data.id,
            name: data.name,
            role: data.role,
            provider_id: data.provider_id,
          };
          await AsyncStorage.setItem("driver_session", JSON.stringify(driverData));
          const eid = await AsyncStorage.getItem("current_event_id");
          useAppStore.getState().setUser(null);
          useAppStore.getState().setDriver(driverData);
          if (eid) useAppStore.getState().setCurrentEventId(eid);
        }

        setReadyRoute(getRouteForRole(role) as any);
      };

      try {
        const token = await getItem("auth_token");
        if (token) {
          try {
            const { data } = await api.get("/auth/me", { timeout: 20000 });
            await handleSuccess(data);
            return;
          } catch (err: any) {
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
              await secureDelete("auth_token");
              await setItem("last_known_role", "");
              setReadyRoute("/(auth)/login");
              return;
            } else {
              // Retry once after 800ms
              try {
                await new Promise(r => setTimeout(r, 800));
                const { data } = await api.get("/auth/me", { timeout: 20000 });
                await handleSuccess(data);
                return;
              } catch (err2) {
                // Fallback to stale cache
                const ds = await AsyncStorage.getItem("driver_session");
                const lastRole = await getItem("last_known_role");
                const eid = await AsyncStorage.getItem("current_event_id");
                if (ds && lastRole === "driver") {
                  const d = JSON.parse(ds);
                  if (d?.id && d?.role === "driver") {
                    useAppStore.getState().setDriver(d);
                    if (eid) useAppStore.getState().setCurrentEventId(eid);
                    setReadyRoute("/(driver)/(tabs)" as any);
                    return;
                  } else {
                    await AsyncStorage.removeItem("driver_session");
                  }
                } else if (lastRole && ["supervisor", "admin", "superadmin", "owner"].includes(lastRole)) {
                  const adminStr = await AsyncStorage.getItem("admin_session");
                  if (adminStr) {
                    const cachedUser = JSON.parse(adminStr);
                    if (cachedUser?.role === lastRole) {
                      useAppStore.getState().setUser(cachedUser);
                      setReadyRoute(getRouteForRole(lastRole) as any);
                      return;
                    }
                  }
                  // No usable cached user — don't strand the screen with user still null
                  await secureDelete("auth_token");
                  await setItem("last_known_role", "");
                  setReadyRoute("/(auth)/login");
                  return;
                } else {
                  setReadyRoute("/(auth)/login");
                  return;
                }
              }
            }
          }
        }
        
        // No token, fallback to legacy cached driver_session check
        const ds = await AsyncStorage.getItem("driver_session");
        const eid = await AsyncStorage.getItem("current_event_id");
        if (ds) {
          const d = JSON.parse(ds);
          if (!d?.id || d?.role !== "driver") {
            await AsyncStorage.removeItem("driver_session");
            setChecking(false);
            router.replace("/(auth)/login");
            return;
          }
          useAppStore.getState().setDriver(d);
          if (eid) useAppStore.getState().setCurrentEventId(eid);
          setChecking(false);
          router.replace("/(driver)/(tabs)" as any);
          return;
        }
      } catch { }
      setReadyRoute("/(auth)/login");
    };
    restore();
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      <AppLoader />
    </Animated.View>
  );
}
