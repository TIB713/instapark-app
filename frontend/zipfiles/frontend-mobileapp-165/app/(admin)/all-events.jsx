import { confirmDialog } from "../../lib/confirmDialog";
import { useEffect, useState } from "react";
import { rs, rp } from '../../utils/responsive';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function AllEvents() {
  const router = useRouter();
  const { filter: incomingFilter } = useLocalSearchParams();
  const { setCurrentEventId, user } = useAppStore();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState(incomingFilter || "all");
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState(null);

  const isHotelOwner = user?.provider_type === "hotel_owner";
  const ACCENT = isHotelOwner ? "#1D4ED8" : "#7C3AED";
  const ACCENT_LIGHT = isHotelOwner ? "rgba(29,78,216,0.5)" : "rgba(79,70,229,0.5)";
  const BG_LIGHT = isHotelOwner ? "#EFF6FF" : "#F5F3FF";

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/events");
        setEvents(data || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const filtered = events
    .filter((e) => {
      // 1. Status Filter
      if (filter !== "all" && filter !== "special" && filter !== "daily") {
        if (e.status !== filter) return false;
      }

      // 2. Event Type Filter (from dashboard params)
      if (filter === "special" && e.event_type !== "hotel_special") return false;
      if (filter === "daily" && e.event_type !== "hotel_daily") return false;

      return true;
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const open = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(admin)/event-detail");
  };

  const cloneEvent = async (e, evt) => {
    e.stopPropagation();
    confirmDialog.confirm(
      "Clone event",
      `Create a copy of "${evt.name}"?`,
      async () => {
            setCloningId(evt.id);
            try {
              const { data } = await api.post(
                `/events/${evt.id}/clone`
              );
              setEvents(prev => [data, ...prev]);
              confirmDialog.info(
                "Cloned!",
                `"${data.name}" created successfully.`
              );
            } catch {
              confirmDialog.info("Couldn't clone event", "Something went wrong cloning the event. Check your connection and try again.");
            } finally {
              setCloningId(null);
            }
          }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG_LIGHT }} testID="all-events-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: ACCENT }}>
        <View
          style={{
            backgroundColor: ACCENT,
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
            paddingBottom: rp(24),
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: ACCENT_LIGHT,
              borderBottomLeftRadius: 44,
              borderBottomRightRadius: 44,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8) }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(12), flex: 1 }}>
              All Events
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ flexDirection: "row", gap: rp(8), paddingHorizontal: rp(16), paddingTop: rp(16) }}>
        {["all", "active", "closed", ...(isHotelOwner ? ["special", "daily"] : [])].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: rp(16),
              paddingVertical: rp(8),
              borderRadius: rp(99),
              backgroundColor: filter === f ? ACCENT : "#fff",
              borderWidth: rp(1),
              borderColor: filter === f ? ACCENT : "#E5E7EB",
            }}
          >
            <Text
              style={{
                fontSize: rs(11),
                fontWeight: "800",
                color: filter === f ? "#fff" : "#6B7280",
                letterSpacing: rs(1.5),
              }}
            >
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
        contentContainerStyle={{ paddingBottom: rp(100) }}
      >
        {loading && <ActivityIndicator color={ACCENT} />}
        {filtered.map((e) => (
          <TouchableOpacity
            key={e.id}
            onPress={() => open(e)}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#fff",
              borderRadius: rp(24),
              padding: rp(16),
              marginBottom: rp(12),
              flexDirection: "row",
              alignItems: "center",
              borderLeftWidth: rp(4),
              borderLeftColor: e.status === "active" ? "#059669" : "#9CA3AF",
              ...cardShadow,
              shadowColor: ACCENT,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(16) }}>{e.name}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(6), marginTop: rp(8) }}>
                <View style={chipStyle}>
                  <Ionicons name="calendar-outline" size={11} color="#6B7280" />
                  <Text style={chipText}>
                    {e.date}{e.start_time ? ` · ${e.start_time}—${e.end_time}` : ""}
                  </Text>
                </View>
                <View style={chipStyle}>
                  <Ionicons name="location-outline" size={11} color="#6B7280" />
                  <Text style={chipText}>{e.venue}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(10) }}>
                <View
                  style={{
                    paddingHorizontal: rp(8),
                    paddingVertical: rp(3),
                    borderRadius: rp(99),
                    backgroundColor: e.status === "active" ? "#D1FAE5" : "#F3F4F6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: rs(10),
                      fontWeight: "800",
                      color: e.status === "active" ? "#059669" : "#6B7280",
                      letterSpacing: rs(1),
                    }}
                  >
                    {e.status?.toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginLeft: rp(8) }}>Max {e.max_cars}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8) }}>
              <TouchableOpacity
                onPress={(ev) => cloneEvent(ev, e)}
                disabled={cloningId === e.id}
                style={{
                  backgroundColor: BG_LIGHT,
                  borderRadius: rp(20),
                  paddingHorizontal: rp(10),
                  paddingVertical: rp(6),
                  borderWidth: rp(1),
                  borderColor: isHotelOwner ? "#BFDBFE" : "#DDD6FE",
                }}
              >
                {cloningId === e.id ? (
                  <ActivityIndicator size={14} color={ACCENT} />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4) }}>
                    <Ionicons name="copy-outline" size={14} color={ACCENT} />
                    <Text style={{ color: ACCENT, fontSize: rs(11), fontWeight: "800" }}>Clone</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        ))}
        {!loading && filtered.length === 0 && (
          <View style={{ alignItems: "center", marginTop: rp(60) }}>
            <Text style={{ fontSize: rs(64) }}>📅</Text>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: rs(16), marginTop: rp(8) }}>No events found</Text>
            <Text style={{ color: "#6B7280", fontSize: rs(13), marginTop: rp(4) }}>
              Try a different filter
            </Text>
          </View>
        )}
        <View style={{ height: rp(40) }} />
      </ScrollView>
    </View>
  );
}

const chipStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#F3F4F6",
  paddingHorizontal: rp(8),
  paddingVertical: rp(4),
  borderRadius: rp(99),
  gap: rp(4),
};
const chipText = {
  color: "#6B7280",
  fontSize: rs(11),
  fontWeight: "600",
};
