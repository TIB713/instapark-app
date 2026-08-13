// code before full redesign
import { useEffect, useState, useRef } from "react";
import { View, Text, Animated, Easing, Image } from "react-native";
import { getItem, setItem, deleteItem as secureDelete } from "../lib/secure";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAppStore } from "../lib/store";
import api from "../lib/api";
import { getRouteForRole } from "../lib/routeForRole";

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  useEffect(() => {
    const restore = async () => {
      try {
        const token = await getItem("auth_token");
        if (token) {
          try {
            const { data } = await api.get("/auth/me", { timeout: 20000 });
            const role = data.role;

            if (role === "admin" || role === "superadmin" || role === "owner") {
              await AsyncStorage.removeItem("driver_session");
              useAppStore.getState().signOut();
              useAppStore.getState().setUser(data);
            } else if (role === "supervisor") {
              await AsyncStorage.removeItem("driver_session");
              useAppStore.getState().setUser(data);
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
              useAppStore.getState().signOut();
              useAppStore.getState().setDriver(driverData);
              if (eid) useAppStore.getState().setCurrentEventId(eid);
            }

            setChecking(false);
            router.replace(getRouteForRole(role) as any);
            return;

          } catch (err: any) {
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
              await secureDelete("auth_token");
              await setItem("last_known_role", "");
              setChecking(false);
              router.replace("/(auth)/login");
              return;
            } else {
              const ds = await AsyncStorage.getItem("driver_session");
              const lastRole = await getItem("last_known_role");
              const eid = await AsyncStorage.getItem("current_event_id");
              if (ds && lastRole === "driver") {
                const d = JSON.parse(ds);
                if (d?.id && d?.role === "driver") {
                  useAppStore.getState().setDriver(d);
                  if (eid) useAppStore.getState().setCurrentEventId(eid);
                  setChecking(false);
                  router.replace("/(driver)/(tabs)" as any);
                  return;
                } else {
                  await AsyncStorage.removeItem("driver_session");
                }
              } else if (lastRole && ["supervisor", "admin", "superadmin", "owner"].includes(lastRole)) {
                setChecking(false);
                router.replace(getRouteForRole(lastRole) as any);
                return;
              } else {
                setChecking(false);
                router.replace("/(auth)/login");
                return;
              }
            }
          }
        }
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
      setChecking(false);
      router.replace("/(auth)/login");
    };
    restore();
  }, []);

  return (
    <View
      testID="splash-screen"
      style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0F1B3D" }}
    >
      <View
        style={{
          width: 134,
          height: 134,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 134,
            height: 134,
            borderRadius: 67,
            borderWidth: 3,
            borderColor: "rgba(255,255,255,0.15)",
            borderTopColor: "rgba(255,255,255,0.9)",
            transform: [{ rotate: spin }],
          }}
        />
        <View
          style={{
            width: 110,
            height: 110,
            borderRadius: 55,
            overflow: "hidden",
            backgroundColor: "#fff",
          }}
        >
          <Image
            source={require("../assets/images/icon_1.png")}
            style={{ width: 110, height: 110 }}
            resizeMode="cover"
          />
        </View>
      </View>
      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600", marginTop: 24, letterSpacing: 2 }}>
        INSTAPARK
      </Text>
    </View>
  );
}
