import { confirmDialog } from "../../lib/confirmDialog";
import { useEffect, useState, useCallback } from "react";
import { rs, rp } from '../../utils/responsive';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteItem as secureDelete } from "../../lib/secure";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { startLocationTracking, stopLocationTracking, updateJourney } from "../../lib/locationTracking";

const cardShadow = {
  shadowColor: "#059669",
  shadowOpacity: 0.1,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function DriverHome() {
  const router = useRouter();
  const { driver, setCurrentEventId, signOut } = useAppStore();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(async (attempt = 0) => {
    const driverId = driver?.id || driver?.user_id;
    if (!driverId) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get(`/drivers/${driverId}/events`);
      setEvents(data || []);
      setLoading(false);
      setRefreshing(false);
    } catch (e) {
      const isNetworkError = !e.response;
      if (isNetworkError && attempt < 3) {
        const delay = [1500, 3000, 5000][attempt];
        console.warn(`[EVENTS] Network error attempt ${attempt + 1}, retrying in ${delay}ms`);
        if (attempt === 0) {
          // On first failure, unblock the UI immediately so driver is not frozen
          // They will see empty events briefly, then list populates when retry succeeds
          setLoading(false);
          setRefreshing(false);
        }
        setTimeout(() => fetchEvents(attempt + 1), delay);
        return;
      }
      // All retries exhausted or a real server error — unblock the UI
      console.error("Failed to fetch driver events", e);
      setLoading(false);
      setRefreshing(false);
    }
  }, [driver]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSignOut = () => {
    const doSignOut = async () => {
      const driverId = driver?.id || driver?.user_id;
      if (driverId) {
        await api.patch(`/drivers/${driverId}/duty-status`, { duty_status: "offline" }).catch(() => {});
      }
      await stopLocationTracking();
      await secureDelete("auth_token");
      await AsyncStorage.multiRemove(["driver_session", "current_event_id"]);
      signOut();
      router.replace("/(auth)/login");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out?")) doSignOut();
      return;
    }
    confirmDialog.destructiveConfirm("Sign out", "Are you sure?", doSignOut, "Sign Out");
  };

  const openEvent = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    // Reset journey to idle for new event session
    await updateJourney(null, "idle");
    // Start tracking — survives screen changes, lock, minimize
    await startLocationTracking();
    // Mark this driver available for dispatch — automatic, no manual toggle.
    // Safe to call even if already available or mid-task; a busy driver simply won't flip.
    const driverId = driver?.id || driver?.user_id;
    if (driverId) {
      api.patch(`/drivers/${driverId}/duty-status`, { duty_status: "available" }).catch(() => {});
    }
    router.push("/(driver)/tasks");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#ECFDF5" }} testID="driver-home">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#059669" }}>
        <View
          style={{
            backgroundColor: "#059669",
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
            paddingBottom: rp(32),
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(8,145,178,0.5)",
              borderBottomLeftRadius: 44,
              borderBottomRightRadius: 44,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: rs(12), letterSpacing: rs(1.5), fontWeight: "700" }}>WELCOME</Text>
              <Text style={{ color: "#fff", fontSize: rs(26), fontWeight: "900", marginTop: rp(2) }}>{driver?.name || "Driver"}</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: rs(13), marginTop: rp(4) }}>My assigned events</Text>
            </View>
            <TouchableOpacity
              onPress={handleSignOut}
              testID="driver-signout"
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(12) }}
            >
              <Ionicons name="log-out-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: rp(16) }}
        contentContainerStyle={{ paddingTop: rp(20), paddingBottom: rp(40) }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchEvents();
            }}
            tintColor="#059669"
          />
        }
      >
        {loading && <ActivityIndicator color="#059669" />}
        {!loading && events.length === 0 && (
          <View style={{ alignItems: "center", marginTop: rp(60), paddingHorizontal: rp(32) }}>
            <Text style={{ fontSize: rs(64) }}>📅</Text>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: rs(16), marginTop: rp(12), textAlign: "center" }}>
              No active events assigned
            </Text>
            <Text style={{ color: "#6B7280", textAlign: "center", marginTop: rp(6), fontSize: rs(13) }}>
              Contact your admin to get assigned
            </Text>
          </View>
        )}
        {events.map((e) => (
          <TouchableOpacity
            key={e.id}
            onPress={() => openEvent(e)}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#fff",
              borderRadius: rp(24),
              padding: rp(18),
              marginBottom: rp(12),
              flexDirection: "row",
              alignItems: "center",
              borderLeftWidth: rp(4),
              borderLeftColor: "#059669",
              ...cardShadow,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(17) }}>{e.name}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(6), marginTop: rp(8) }}>
                <View style={chipStyle}>
                  <Ionicons name="calendar-outline" size={11} color="#6B7280" />
                  <Text style={chipText}>{e.date}</Text>
                </View>
                <View style={chipStyle}>
                  <Ionicons name="location-outline" size={11} color="#6B7280" />
                  <Text style={chipText}>{e.venue}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: "#D1FAE5", alignSelf: "flex-start", paddingHorizontal: rp(10), paddingVertical: rp(3), borderRadius: rp(99), marginTop: rp(10) }}>
                <Text style={{ color: "#059669", fontSize: rs(10), fontWeight: "800", letterSpacing: rs(1) }}>ACTIVE</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#059669" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const chipStyle = { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(99), gap: rp(4) };
const chipText = { color: "#6B7280", fontSize: rs(11), fontWeight: "600" };
