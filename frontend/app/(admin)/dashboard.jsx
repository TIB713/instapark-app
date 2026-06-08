import { useState, useCallback } from "react";
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

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export default function Dashboard() {
  const router = useRouter();
  const { user, setCurrentEventId, signOut } = useAppStore();
  const [events, setEvents] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isHotelOwner = user?.provider_type === "hotel_owner";
  const isValetProvider = !isHotelOwner;

  const fetchAll = useCallback(async () => {
    try {
      const { data: evs } = await api.get("/events");
      const seen = new Set();
      const unique = (evs || []).filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      const sorted = unique.sort((a, b) => new Date(b.date) - new Date(a.date));
      const recent = sorted.slice(0, 5);
      setEvents(recent);
      try {
        const { data: drs } = await api.get("/drivers");
        setDrivers(drs || []);
      } catch {
        setDrivers([]);
      }
      try {
        const { data: sups } = await api.get("/supervisors");
        setSupervisors(sups || []);
      } catch {
        setSupervisors([]);
      }
      try {
        const { data: hts } = await api.get("/hotels");
        setHotels(hts || []);
      } catch {
        setHotels([]);
      }
    } catch (err) {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

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
    router.push("/(admin)/event-detail");
  };

  const specialEvents = events.filter(e => e.event_type === "hotel_special");
  const dailyEvents = events.filter(e => e.event_type === "hotel_daily");
  const todayStr = new Date().toISOString().split("T")[0];
  const todaySpecial = specialEvents.filter(e => e.date === todayStr);
  const todayDaily = dailyEvents.find(e => e.date === todayStr);
  const active = events.filter((e) => e.status === "active");
  const past = events.filter((e) => e.status !== "active");
  const avgRating =
    events.filter((e) => e.avg_rating).length > 0
      ? (
          events.reduce((s, e) => s + (e.avg_rating || 0), 0) /
          events.filter((e) => e.avg_rating).length
        ).toFixed(1)
      : "—";

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F5F3FF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const statCards = isHotelOwner ? [
    { id: "hotel_special", testID: "stat-special-events", color: "#1D4ED8", icon: "star", value: specialEvents.length, label: "TOTAL SPECIAL EVENTS", onPress: () => router.push({ pathname: "/(admin)/all-events", params: { filter: "special" } }) },
    { id: "hotel_active_today", testID: "stat-active-today", color: "#059669", icon: "pulse", value: events.filter(e => e.date === todayStr && e.status === "active").length, label: "ACTIVE TODAY", onPress: () => router.push("/(admin)/hotels") },
    { id: "hotel_drivers", testID: "stat-drivers", color: "#4F46E5", icon: "people", value: drivers.length, label: "DRIVERS", onPress: () => router.push("/(admin)/manage-employees") },
    { id: "hotel_supervisors", testID: "stat-supervisors", color: "#0F2044", icon: "shield-checkmark", value: supervisors.length, label: "SUPERVISORS", onPress: () => router.push("/(admin)/manage-employees") },
    { id: "hotel_guest_qr", testID: "stat-guest-qr", color: "#D97706", icon: "qr-code-outline", value: null, label: "GUEST QR", onPress: () => router.push("/(admin)/pre-register-qr") },
  ] : [
    { id: "total", testID: "stat-total-events", color: "#7C3AED", icon: "calendar", value: events.length, label: "TOTAL EVENTS", onPress: () => router.push("/(admin)/all-events") },
    { id: "active", testID: "stat-active", color: "#059669", icon: "pulse", value: active.length, label: "ACTIVE NOW", onPress: () => router.push("/(admin)/all-events") },
    { id: "supervisors", testID: "stat-supervisors", color: "#0F2044", icon: "shield-checkmark", value: supervisors.length, label: "SUPERVISORS", onPress: () => router.push("/(admin)/manage-employees") },
    { id: "drivers", testID: "stat-drivers", color: "#4F46E5", icon: "people", value: drivers.length, label: "DRIVERS", onPress: () => router.push("/(admin)/manage-employees") },
    { id: "hotels", testID: "stat-hotels", color: "#1D4ED8", icon: "business-outline", value: hotels.length, label: "HOTELS", onPress: () => router.push("/(admin)/hotels") },
    { id: "rating", testID: "stat-rating", color: "#F59E0B", icon: "star", value: avgRating, label: "AVG RATING", onPress: () => router.push("/(admin)/all-events") },
    { id: "guest_qr", testID: "stat-guest-qr", color: "#D97706", icon: "qr-code-outline", value: null, label: "GUEST QR", onPress: () => router.push("/(admin)/pre-register-qr") },
  ];

  return (
    <View testID="admin-dashboard" style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
        <View
          style={{
            backgroundColor: "#7C3AED",
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingBottom: 36,
            paddingHorizontal: 20,
            paddingTop: 8,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(79,70,229,0.5)",
              borderBottomLeftRadius: 44,
              borderBottomRightRadius: 44,
            }}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>{greeting()},</Text>
              <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 4 }}>
                {user?.name || "Admin"}
              </Text>
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

      <ScrollView
        style={{ flex: 1, marginTop: -20 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
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
                <Ionicons name={s.id.includes("guest_qr") ? "information-circle-outline" : s.icon} size={22} color="#fff" />
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 99, padding: 4 }}>
                  <Ionicons name="chevron-forward" size={14} color="#fff" />
                </View>
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

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Text style={labelStyle}>QUICK ACTIONS</Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            {isHotelOwner ? (
              <TouchableOpacity
                testID="quick-create-special"
                onPress={() => router.push({ pathname: "/(admin)/create-event", params: { type: "special" } })}
                activeOpacity={0.85}
                style={[quickAction, cardShadow]}
              >
                <View style={{ backgroundColor: "#EDE9FE", borderRadius: 99, padding: 10 }}>
                  <Ionicons name="add-circle" size={22} color="#7C3AED" />
                </View>
                <Text style={{ fontWeight: "800", color: "#111827", marginTop: 10, fontSize: 14 }}>Create Special Event</Text>
                <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>Add a special event</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                testID="quick-new-event"
                onPress={() => router.push("/(admin)/create-event")}
                activeOpacity={0.85}
                style={[quickAction, cardShadow]}
              >
                <View style={{ backgroundColor: "#EDE9FE", borderRadius: 99, padding: 10 }}>
                  <Ionicons name="add-circle" size={22} color="#7C3AED" />
                </View>
                <Text style={{ fontWeight: "800", color: "#111827", marginTop: 10, fontSize: 14 }}>New Event</Text>
                <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>Create new valet event</Text>
              </TouchableOpacity>
            )}

            {isHotelOwner ? (
              <TouchableOpacity
                testID="quick-guest-qr"
                onPress={() => router.push("/(admin)/pre-register-qr")}
                activeOpacity={0.85}
                style={[quickAction, cardShadow]}
              >
                <View style={{ backgroundColor: "#FEF3C7", borderRadius: 99, padding: 10 }}>
                  <Ionicons name="qr-code-outline" size={22} color="#D97706" />
                </View>
                <Text style={{ fontWeight: "800", color: "#111827", marginTop: 10, fontSize: 14 }}>Guest QR</Text>
                <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>Pre-registration code</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                testID="quick-hotels"
                onPress={() => router.push("/(admin)/hotels")}
                activeOpacity={0.85}
                style={[quickAction, cardShadow]}
              >
                <View style={{ backgroundColor: "#EBF5FF", borderRadius: 99, padding: 10 }}>
                  <Ionicons name="business-outline" size={22} color="#1D4ED8" />
                </View>
                <Text style={{ fontWeight: "800", color: "#111827", marginTop: 10, fontSize: 14 }}>Hotels</Text>
                <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>Manage hotel contracts</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <TouchableOpacity
              testID="quick-manage-employees"
              onPress={() => router.push("/(admin)/manage-employees")}
              activeOpacity={0.85}
              style={[quickAction, cardShadow]}
            >
              <View style={{ backgroundColor: "rgba(15,32,68,0.1)", borderRadius: 99, padding: 10 }}>
                <Ionicons name="people-outline" size={22} color="#0F2044" />
              </View>
              <Text style={{ fontWeight: "800", color: "#111827", marginTop: 10, fontSize: 14 }}>Employees</Text>
              <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>Manage your team</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </View>
        </View>

        {/* TODAY'S EVENTS — hotel owner */}
        {isHotelOwner ? (
          <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
            <Text style={labelStyle}>TODAY'S EVENTS</Text>
            <View style={{ height: 12 }} />

            {/* Daily Operations Card */}
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(admin)/all-events", params: { filter: "daily" } })}
              activeOpacity={0.85}
              style={[cardBase, cardShadow, { borderLeftWidth: 4, borderLeftColor: "#0284C7", flexDirection: "row", alignItems: "center", marginBottom: 12 }]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>Daily Operations</Text>
                  <View style={{ backgroundColor: "#0284C7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>🏨 DAILY</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                  <View style={{ backgroundColor: todayDaily?.status === "active" ? "#D1FAE5" : "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                    <Text style={{ color: todayDaily?.status === "active" ? "#059669" : "#6B7280", fontWeight: "800", fontSize: 10, letterSpacing: 1 }}>
                      {todayDaily ? (todayDaily.status === "active" ? "ACTIVE" : "CLOSED") : "NO EVENT TODAY"}
                    </Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
            </TouchableOpacity>

            {/* Special Event Cards */}
            {todaySpecial.length === 0 ? (
              <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 12, marginLeft: 4 }}>No special events today</Text>
            ) : (
              todaySpecial.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => openEvent(e)}
                  activeOpacity={0.85}
                  style={[cardBase, cardShadow, { borderLeftWidth: 4, borderLeftColor: "#1D4ED8", flexDirection: "row", alignItems: "center", marginBottom: 12 }]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>{e.name}</Text>
                      <View style={{ backgroundColor: "#1D4ED8", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>⭐ SPECIAL</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="time-outline" size={13} color="#1D4ED8" />
                        <Text style={{ color: "#6B7280", fontSize: 12, marginLeft: 4 }}>{e.start_time}—{e.end_time}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                      <View style={{ backgroundColor: e.status === "active" ? "#D1FAE5" : "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                        <Text style={{ color: e.status === "active" ? "#059669" : "#6B7280", fontWeight: "800", fontSize: 10, letterSpacing: 1 }}>
                          {e.status === "active" ? "ACTIVE" : "CLOSED"}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              ))
            )}

            {/* Past Special Events */}
            {specialEvents.filter(e => e.status !== "active").length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={labelStyle}>PAST SPECIAL EVENTS</Text>
                <View style={{ height: 12 }} />
                {specialEvents.filter(e => e.status !== "active").slice(0, 5).map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => openEvent(e)}
                    activeOpacity={0.85}
                    style={[cardBase, cardShadow, { borderLeftWidth: 4, borderLeftColor: "#D1D5DB", flexDirection: "row", alignItems: "center", marginBottom: 12 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontWeight: "900", color: "#374151", fontSize: 15 }}>{e.name}</Text>
                        <View style={{ backgroundColor: "#1D4ED8", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>⭐ SPECIAL</Text>
                        </View>
                      </View>
                      <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>{e.date} · {e.venue}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Active events — valet provider */}
            <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <Text style={labelStyle}>ACTIVE EVENTS</Text>
                <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 10, paddingVertical: 2, borderRadius: 99, marginLeft: 8 }}>
                  <Text style={{ color: "#059669", fontWeight: "800", fontSize: 11 }}>{active.length}</Text>
                </View>
              </View>
              {active.length === 0 ? (
                <View style={[cardBase, cardShadow, { alignItems: "center", paddingVertical: 28 }]}>
                  <Text style={{ fontSize: 36 }}>📅</Text>
                  <Text style={{ color: "#6B7280", marginTop: 6, fontSize: 13 }}>No active events</Text>
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
                          <Ionicons name="calendar-outline" size={13} color="#7C3AED" />
                          <Text style={{ color: "#6B7280", fontSize: 12, marginLeft: 4 }}>{e.date}</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Ionicons name="time-outline" size={13} color="#7C3AED" />
                          <Text style={{ color: "#6B7280", fontSize: 12, marginLeft: 4 }}>{e.start_time}—{e.end_time}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <Ionicons name="location-outline" size={13} color="#7C3AED" />
                        <Text style={{ color: "#6B7280", fontSize: 12, marginLeft: 4 }}>{e.venue}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                        <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                          <Text style={{ color: "#059669", fontWeight: "800", fontSize: 10, letterSpacing: 1 }}>ACTIVE</Text>
                        </View>
                        <Text style={{ color: "#9CA3AF", fontSize: 11, marginLeft: 8 }}>Max {e.max_cars} cars</Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: "#F3F4F6", borderRadius: 99, marginTop: 10, overflow: "hidden" }}>
                        <View style={{ height: 4, width: `${Math.min(100, ((e.total_cars || 0) / Math.max(1, e.max_cars)) * 100)}%`, backgroundColor: "#059669", borderRadius: 99 }} />
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ))
              )}
            </View>

            {past.length > 0 && (
              <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                <Text style={labelStyle}>PAST EVENTS</Text>
                <View style={{ height: 12 }} />
                {past.slice(0, 5).map((e) => (
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
          </>
        )}
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
