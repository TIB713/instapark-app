import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteItem as secureDelete } from "../../lib/secure";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { connectWS, disconnectWS } from "../../lib/websocket";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const ACCENT_COLOR = "#0F2044";

const cardShadow = {
  shadowColor: ACCENT_COLOR,
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export default function SupervisorDashboard() {
  const router = useRouter();
  const { user, setCurrentEventId, signOut } = useAppStore();
  const [events, setEvents] = useState([]);
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wsStatus, setWsStatus] = useState("connecting");

  const fetchAll = useCallback(async () => {
    const supervisorId = user?.id || user?.user_id;
    if (!supervisorId) return;

    try {
      setLoading(true);
      const [eventsRes, hotelRes] = await Promise.all([
        api.get(`/supervisors/${supervisorId}/events`),
        user?.hotel_id ? api.get(`/hotels/${user.hotel_id}`) : Promise.resolve({ data: null })
      ]);
      
      const sorted = (eventsRes.data || []).sort((a, b) => new Date(b.date) - new Date(a.date));
      setEvents(sorted);
      if (hotelRes.data) setHotel(hotelRes.data);
    } catch (e) {
      console.log("Error fetching supervisor dashboard data:", e?.response?.status, e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  useEffect(() => {
    const activeEvent = events.find((e) => e.status === "active");
    if (!activeEvent) {
      setWsStatus("disconnected");
      return;
    }
    setWsStatus("connecting");
    let connected = false;
    const disconnectTimer = setTimeout(() => {
      if (!connected) setWsStatus("disconnected");
    }, 8000);

    connectWS(`/event/${activeEvent.id}`, () => {
      connected = true;
      setWsStatus("connected");
    });

    return () => {
      clearTimeout(disconnectTimer);
      disconnectWS(`/event/${activeEvent.id}`);
    };
  }, [events]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const handleSignOut = () => {
    const doSignOut = async () => {
      await secureDelete("auth_token");
      await AsyncStorage.multiRemove(["driver_session", "current_event_id"]);
      signOut();
      router.replace("/(auth)/login");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out?")) doSignOut();
      return;
    }
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: doSignOut },
    ]);
  };

  const openEvent = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(supervisor)/event-detail");
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todayDaily = events.find(e => e.hotel_id === user?.hotel_id && e.date === todayStr && e.event_type === "hotel_daily");
  
  const active = events.filter((e) => e.status === "active").slice(0, 5);
  const past = events.filter((e) => e.status !== "active").slice(0, 5);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F5F3FF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={ACCENT_COLOR} />
      </View>
    );
  }

  const statCards = [
    { id: "total", testID: "stat-total-events", color: ACCENT_COLOR, icon: "calendar", value: events.length, label: "TOTAL EVENTS" },
    { id: "active", testID: "stat-active", color: "#059669", icon: "pulse", value: events.filter(e => e.status === "active").length, label: "ACTIVE NOW" },
    { 
      id: "guest_qr", 
      testID: "stat-guest-qr", 
      color: "#D97706", 
      icon: "qr-code-outline", 
      value: null, 
      label: "GUEST QR", 
      onPress: () => router.push({ 
        pathname: "/(admin)/pre-register-qr", 
        params: user?.hotel_id ? { hotelId: user.hotel_id } : {} 
      }) 
    },
  ];

  return (
    <View testID="supervisor-dashboard" style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: ACCENT_COLOR }}>
        <View
          style={{
            backgroundColor: ACCENT_COLOR,
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingBottom: 36,
            paddingHorizontal: 20,
            paddingTop: 8,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>{greeting()},</Text>
              <View>
                <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 4 }}>
                  {user?.name || "Supervisor"}
                </Text>
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>SUPERVISOR</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              testID="signout-btn"
              onPress={handleSignOut}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99, padding: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {wsStatus === "disconnected" && (
        <View style={{ backgroundColor: "#FEF3C7", padding: 8, margin: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
          <Text style={{ color: "#92400E", fontSize: 12 }}>Live updates paused — reconnecting...</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1, marginTop: -20 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT_COLOR} />}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        >
          {statCards.map((s) => (
            <TouchableOpacity
              key={s.id}
              testID={s.testID}
              onPress={s.onPress}
              disabled={!s.onPress}
              activeOpacity={0.85}
              style={{
                backgroundColor: s.color,
                borderRadius: 24,
                paddingHorizontal: 18,
                paddingVertical: 18,
                minWidth: 150,
                shadowColor: s.color,
                shadowOpacity: 0.25,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Ionicons name={s.id === "guest_qr" ? "information-circle-outline" : s.icon} size={22} color="#fff" />
                {s.onPress && (
                  <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 99, padding: 4 }}>
                    <Ionicons name="chevron-forward" size={14} color="#fff" />
                  </View>
                )}
              </View>
              {s.value !== null ? (
                <Text style={{ color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 10 }}>{s.value}</Text>
              ) : (
                <View style={{ marginTop: 10 }}>
                  <Ionicons name={s.icon} size={32} color="#fff" />
                </View>
              )}
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginTop: 2 }}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Hotel section */}
        {user?.hotel_id && hotel && (
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text style={labelStyle}>MY HOTEL</Text>
            <View style={[cardBase, cardShadow, { flexDirection: "row", alignItems: "center", padding: 16 }]}>
              <View style={{ backgroundColor: "#EFF6FF", padding: 10, borderRadius: 12, marginRight: 14 }}>
                <Ionicons name="business" size={24} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>{hotel.name}</Text>
                <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Primary Assigned Location</Text>
              </View>
            </View>

            {todayDaily && (
              <TouchableOpacity
                onPress={() => openEvent(todayDaily)}
                style={[cardBase, cardShadow, { marginTop: 12, borderLeftWidth: 4, borderLeftColor: "#1D4ED8", padding: 16 }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: "#1D4ED8" }}>TODAY'S DAILY EVENT</Text>
                      <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: "#059669", fontSize: 9, fontWeight: "800" }}>ACTIVE</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: "#111827", marginTop: 4 }}>{todayDaily.name}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Text style={labelStyle}>QUICK ACTIONS</Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <TouchableOpacity
              testID="quick-manage-employees"
              onPress={() => router.push("/(supervisor)/manage-employees")}
              activeOpacity={0.85}
              style={[quickAction, cardShadow]}
            >
              <View style={{ backgroundColor: "rgba(15,32,68,0.1)", borderRadius: 99, padding: 10 }}>
                <Ionicons name="people-outline" size={22} color={ACCENT_COLOR} />
              </View>
              <Text style={{ fontWeight: "800", color: "#111827", marginTop: 10, fontSize: 14 }}>Employees</Text>
              <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>View your team</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="quick-guest-qr"
              onPress={() => router.push("/(admin)/pre-register-qr")}
              activeOpacity={0.85}
              style={[quickAction, cardShadow]}
            >
              <View style={{ backgroundColor: "rgba(217,119,6,0.1)", borderRadius: 99, padding: 10 }}>
                <Ionicons name="qr-code-outline" size={22} color="#D97706" />
              </View>
              <Text style={{ fontWeight: "800", color: "#111827", marginTop: 10, fontSize: 14 }}>Guest QR</Text>
              <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>Share pre-registration</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active events */}
        <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Text style={labelStyle}>ACTIVE ASSIGNED EVENTS</Text>
            <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 10, paddingVertical: 2, borderRadius: 99, marginLeft: 8 }}>
              <Text style={{ color: "#059669", fontWeight: "800", fontSize: 11 }}>{active.length}</Text>
            </View>
          </View>

          {events.length === 0 ? (
            <View style={[cardBase, cardShadow, { alignItems: "center", paddingVertical: 32 }]}>
              <Text style={{ fontSize: 40 }}>📋</Text>
              <Text style={{ color: "#111827", fontWeight: "800", marginTop: 12, fontSize: 15 }}>No events assigned yet</Text>
              <Text style={{ color: "#6B7280", marginTop: 4, fontSize: 13, textAlign: "center", paddingHorizontal: 20 }}>
                Your assigned events will appear here once the admin assigns you to one
              </Text>
            </View>
          ) : active.length === 0 ? (
            <View style={[cardBase, cardShadow, { alignItems: "center", paddingVertical: 28 }]}>
              <Text style={{ fontSize: 36 }}>📅</Text>
              <Text style={{ color: "#111827", fontWeight: "800", marginTop: 8 }}>No active events</Text>
              <Text style={{ color: "#6B7280", marginTop: 4, fontSize: 13, textAlign: "center", paddingHorizontal: 20 }}>
                Check the "Recent Events" section below for your past assignments
              </Text>
            </View>
          ) : (
            active.map((e) => (
              <TouchableOpacity
                key={e.id}
                testID={`active-event-${e.id}`}
                onPress={() => openEvent(e)}
                activeOpacity={0.85}
                style={[cardBase, cardShadow, { borderLeftWidth: 4, borderLeftColor: "#059669", flexDirection: "row", alignItems: "center", marginBottom: 12 }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>{e.name}</Text>
                    {e.event_type === "hotel_daily" && (
                      <View style={{ backgroundColor: "#0284C7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>🏨 AUTO</Text>
                      </View>
                    )}
                    {e.event_type === "hotel_special" && (
                      <View style={{ backgroundColor: "#1D4ED8", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>🏨 SPECIAL</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="calendar-outline" size={13} color={ACCENT_COLOR} />
                      <Text style={{ color: "#6B7280", fontSize: 12, marginLeft: 4 }}>{e.date}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="time-outline" size={13} color={ACCENT_COLOR} />
                      <Text style={{ color: "#6B7280", fontSize: 12, marginLeft: 4 }}>{e.start_time}—{e.end_time}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <Ionicons name="location-outline" size={13} color={ACCENT_COLOR} />
                    <Text style={{ color: "#6B7280", fontSize: 12, marginLeft: 4 }}>{e.venue}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                    <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                      <Text style={{ color: "#059669", fontWeight: "800", fontSize: 10, letterSpacing: 1 }}>ACTIVE</Text>
                    </View>
                    <Text style={{ color: "#9CA3AF", fontSize: 11, marginLeft: 8 }}>Max {e.max_cars} cars</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {past.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text style={labelStyle}>RECENT EVENTS</Text>
            <View style={{ height: 12 }} />
            {past.map((e) => (
              <TouchableOpacity
                key={e.id}
                onPress={() => openEvent(e)}
                activeOpacity={0.85}
                style={[cardBase, cardShadow, { borderLeftWidth: 4, borderLeftColor: "#D1D5DB", flexDirection: "row", alignItems: "center", marginBottom: 12 }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontWeight: "900", color: "#374151", fontSize: 15 }}>{e.name}</Text>
                    {e.event_type === "hotel_daily" && (
                      <View style={{ backgroundColor: "#0284C7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>🏨 AUTO</Text>
                      </View>
                    )}
                    {e.event_type === "hotel_special" && (
                      <View style={{ backgroundColor: "#1D4ED8", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>🏨 SPECIAL</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>{e.date} · {e.venue}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ marginTop: 24, paddingBottom: 20, alignItems: "center" }}>
          <Text style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center", fontStyle: "italic" }}>
            Drivers are managed by your admin. You can view but cannot add or remove drivers.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const labelStyle = {
  fontSize: 11,
  fontWeight: "700",
  color: "#6B7280",
  letterSpacing: 3,
  textTransform: "uppercase",
  marginBottom: 8,
};

const cardBase = {
  backgroundColor: "#FFFFFF",
  borderRadius: 24,
  padding: 18,
};

const quickAction = {
  flex: 1,
  backgroundColor: "#FFFFFF",
  borderRadius: 24,
  padding: 16,
};
