import { useState, useCallback, useEffect } from "react";
import { rs, rp } from '../../utils/responsive';
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
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
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
            paddingBottom: rp(36),
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: rs(13) }}>{greeting()},</Text>
              <View>
                <Text style={{ color: "#fff", fontSize: rs(26), fontWeight: "900", marginTop: rp(4) }}>
                  {user?.name || "Supervisor"}
                </Text>
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "flex-start", paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(6), marginTop: rp(4) }}>
                  <Text style={{ color: "#fff", fontSize: rs(10), fontWeight: "800", letterSpacing: rs(1) }}>SUPERVISOR</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              testID="signout-btn"
              onPress={handleSignOut}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(12) }}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {wsStatus === "disconnected" && (
        <View style={{ backgroundColor: "#FEF3C7", padding: rp(8), margin: rp(12), borderRadius: rp(12), flexDirection: "row", alignItems: "center", gap: rp(8) }}>
          <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
          <Text style={{ color: "#92400E", fontSize: rs(12) }}>Live updates paused — reconnecting...</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1, marginTop: -20 }}
        contentContainerStyle={{ paddingBottom: rp(100) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT_COLOR} />}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: rp(16), gap: rp(12) }}
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
                borderRadius: rp(24),
                paddingHorizontal: rp(18),
                paddingVertical: rp(18),
                minWidth: rp(150),
                shadowColor: s.color,
                shadowOpacity: 0.25,
                shadowRadius: rp(14),
                shadowOffset: { width: 0, height: rp(6) },
                elevation: 5,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Ionicons name={s.id === "guest_qr" ? "information-circle-outline" : s.icon} size={22} color="#fff" />
                {s.onPress && (
                  <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: rp(99), padding: rp(4) }}>
                    <Ionicons name="chevron-forward" size={14} color="#fff" />
                  </View>
                )}
              </View>
              {s.value !== null ? (
                <Text style={{ color: "#fff", fontSize: rs(32), fontWeight: "900", marginTop: rp(10) }}>{s.value}</Text>
              ) : (
                <View style={{ marginTop: rp(10) }}>
                  <Ionicons name={s.icon} size={32} color="#fff" />
                </View>
              )}
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: rs(10), fontWeight: "700", letterSpacing: rs(2), marginTop: rp(2) }}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Hotel section */}
        {user?.hotel_id && hotel && (
          <View style={{ paddingHorizontal: rp(16), marginTop: rp(24) }}>
            <Text style={labelStyle}>MY HOTEL</Text>
            <View style={[cardBase, cardShadow, { flexDirection: "row", alignItems: "center", padding: rp(16) }]}>
              <View style={{ backgroundColor: "#EFF6FF", padding: rp(10), borderRadius: rp(12), marginRight: rp(14) }}>
                <Ionicons name="business" size={24} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rs(18), fontWeight: "900", color: "#111827" }}>{hotel.name}</Text>
                <Text style={{ fontSize: rs(12), color: "#6B7280", marginTop: rp(2) }}>Primary Assigned Location</Text>
              </View>
            </View>

            {todayDaily && (
              <TouchableOpacity
                onPress={() => openEvent(todayDaily)}
                style={[cardBase, cardShadow, { marginTop: rp(12), borderLeftWidth: rp(4), borderLeftColor: "#1D4ED8", padding: rp(16) }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: rp(6) }}>
                      <Text style={{ fontSize: rs(14), fontWeight: "800", color: "#1D4ED8" }}>TODAY'S DAILY EVENT</Text>
                      <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: rp(6), paddingVertical: rp(1), borderRadius: rp(4) }}>
                        <Text style={{ color: "#059669", fontSize: rs(9), fontWeight: "800" }}>ACTIVE</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: rs(16), fontWeight: "900", color: "#111827", marginTop: rp(4) }}>{todayDaily.name}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: rp(16), marginTop: rp(24) }}>
          <Text style={labelStyle}>QUICK ACTIONS</Text>
          <View style={{ flexDirection: "row", gap: rp(12), marginTop: rp(4) }}>
            <TouchableOpacity
              testID="quick-manage-employees"
              onPress={() => router.push("/(supervisor)/manage-employees")}
              activeOpacity={0.85}
              style={[quickAction, cardShadow]}
            >
              <View style={{ backgroundColor: "rgba(15,32,68,0.1)", borderRadius: rp(99), padding: rp(10) }}>
                <Ionicons name="people-outline" size={22} color={ACCENT_COLOR} />
              </View>
              <Text style={{ fontWeight: "800", color: "#111827", marginTop: rp(10), fontSize: rs(14) }}>Employees</Text>
              <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginTop: rp(2) }}>View your team</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="quick-guest-qr"
              onPress={() => router.push("/(admin)/pre-register-qr")}
              activeOpacity={0.85}
              style={[quickAction, cardShadow]}
            >
              <View style={{ backgroundColor: "rgba(217,119,6,0.1)", borderRadius: rp(99), padding: rp(10) }}>
                <Ionicons name="qr-code-outline" size={22} color="#D97706" />
              </View>
              <Text style={{ fontWeight: "800", color: "#111827", marginTop: rp(10), fontSize: rs(14) }}>Guest QR</Text>
              <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginTop: rp(2) }}>Share pre-registration</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active events */}
        <View style={{ paddingHorizontal: rp(16), marginTop: rp(28) }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(12) }}>
            <Text style={labelStyle}>ACTIVE ASSIGNED EVENTS</Text>
            <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: rp(10), paddingVertical: rp(2), borderRadius: rp(99), marginLeft: rp(8) }}>
              <Text style={{ color: "#059669", fontWeight: "800", fontSize: rs(11) }}>{active.length}</Text>
            </View>
          </View>

          {events.length === 0 ? (
            <View style={[cardBase, cardShadow, { alignItems: "center", paddingVertical: rp(32) }]}>
              <Text style={{ fontSize: rs(40) }}>📋</Text>
              <Text style={{ color: "#111827", fontWeight: "800", marginTop: rp(12), fontSize: rs(15) }}>No events assigned yet</Text>
              <Text style={{ color: "#6B7280", marginTop: rp(4), fontSize: rs(13), textAlign: "center", paddingHorizontal: rp(20) }}>
                Your assigned events will appear here once the admin assigns you to one
              </Text>
            </View>
          ) : active.length === 0 ? (
            <View style={[cardBase, cardShadow, { alignItems: "center", paddingVertical: rp(28) }]}>
              <Text style={{ fontSize: rs(36) }}>📅</Text>
              <Text style={{ color: "#111827", fontWeight: "800", marginTop: rp(8) }}>No active events</Text>
              <Text style={{ color: "#6B7280", marginTop: rp(4), fontSize: rs(13), textAlign: "center", paddingHorizontal: rp(20) }}>
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
                style={[cardBase, cardShadow, { borderLeftWidth: rp(4), borderLeftColor: "#059669", flexDirection: "row", alignItems: "center", marginBottom: rp(12) }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8) }}>
                    <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(16) }}>{e.name}</Text>
                    {e.event_type === "hotel_daily" && (
                      <View style={{ backgroundColor: "#0284C7", borderRadius: rp(6), paddingHorizontal: rp(6), paddingVertical: rp(2) }}>
                        <Text style={{ color: "#fff", fontSize: rs(9), fontWeight: "800" }}>🏨 AUTO</Text>
                      </View>
                    )}
                    {e.event_type === "hotel_special" && (
                      <View style={{ backgroundColor: "#1D4ED8", borderRadius: rp(6), paddingHorizontal: rp(6), paddingVertical: rp(2) }}>
                        <Text style={{ color: "#fff", fontSize: rs(9), fontWeight: "800" }}>🏨 SPECIAL</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6), flexWrap: "wrap", gap: rp(12) }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="calendar-outline" size={13} color={ACCENT_COLOR} />
                      <Text style={{ color: "#6B7280", fontSize: rs(12), marginLeft: rp(4) }}>{e.date}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="time-outline" size={13} color={ACCENT_COLOR} />
                      <Text style={{ color: "#6B7280", fontSize: rs(12), marginLeft: rp(4) }}>{e.start_time}—{e.end_time}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(4) }}>
                    <Ionicons name="location-outline" size={13} color={ACCENT_COLOR} />
                    <Text style={{ color: "#6B7280", fontSize: rs(12), marginLeft: rp(4) }}>{e.venue}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(10) }}>
                    <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                      <Text style={{ color: "#059669", fontWeight: "800", fontSize: rs(10), letterSpacing: rs(1) }}>ACTIVE</Text>
                    </View>
                    <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginLeft: rp(8) }}>Max {e.max_cars} cars</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginLeft: rp(8) }} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {past.length > 0 && (
          <View style={{ paddingHorizontal: rp(16), marginTop: rp(24) }}>
            <Text style={labelStyle}>RECENT EVENTS</Text>
            <View style={{ height: rp(12) }} />
            {past.map((e) => (
              <TouchableOpacity
                key={e.id}
                onPress={() => openEvent(e)}
                activeOpacity={0.85}
                style={[cardBase, cardShadow, { borderLeftWidth: rp(4), borderLeftColor: "#D1D5DB", flexDirection: "row", alignItems: "center", marginBottom: rp(12) }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8) }}>
                    <Text style={{ fontWeight: "900", color: "#374151", fontSize: rs(15) }}>{e.name}</Text>
                    {e.event_type === "hotel_daily" && (
                      <View style={{ backgroundColor: "#0284C7", borderRadius: rp(6), paddingHorizontal: rp(6), paddingVertical: rp(2) }}>
                        <Text style={{ color: "#fff", fontSize: rs(9), fontWeight: "800" }}>🏨 AUTO</Text>
                      </View>
                    )}
                    {e.event_type === "hotel_special" && (
                      <View style={{ backgroundColor: "#1D4ED8", borderRadius: rp(6), paddingHorizontal: rp(6), paddingVertical: rp(2) }}>
                        <Text style={{ color: "#fff", fontSize: rs(9), fontWeight: "800" }}>🏨 SPECIAL</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginTop: rp(4) }}>{e.date} · {e.venue}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ marginTop: rp(24), paddingBottom: rp(20), alignItems: "center" }}>
          <Text style={{ color: "#9CA3AF", fontSize: rs(12), textAlign: "center", fontStyle: "italic" }}>
            Drivers are managed by your admin. You can view but cannot add or remove drivers.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const labelStyle = {
  fontSize: rs(11),
  fontWeight: "700",
  color: "#6B7280",
  letterSpacing: rs(3),
  textTransform: "uppercase",
  marginBottom: rp(8),
};

const cardBase = {
  backgroundColor: "#FFFFFF",
  borderRadius: rp(24),
  padding: rp(18),
};

const quickAction = {
  flex: 1,
  backgroundColor: "#FFFFFF",
  borderRadius: rp(24),
  padding: rp(16),
};
