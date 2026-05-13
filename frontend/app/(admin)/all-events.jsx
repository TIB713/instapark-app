import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export default function AllEvents() {
  const router = useRouter();
  const { setCurrentEventId } = useAppStore();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

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
    .filter((e) => filter === "all" || e.status === filter)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const open = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(admin)/event-detail");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="all-events-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
        <View
          style={{
            backgroundColor: "#7C3AED",
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 24,
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99, padding: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 12, flex: 1 }}>
              All Events
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 16 }}>
        {["all", "active", "closed"].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 99,
              backgroundColor: filter === f ? "#7C3AED" : "#fff",
              borderWidth: 1,
              borderColor: filter === f ? "#7C3AED" : "#E5E7EB",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: filter === f ? "#fff" : "#6B7280",
                letterSpacing: 1.5,
              }}
            >
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        {loading && <ActivityIndicator color="#7C3AED" />}
        {filtered.map((e) => (
          <TouchableOpacity
            key={e.id}
            onPress={() => open(e)}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: 16,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              borderLeftWidth: 4,
              borderLeftColor: e.status === "active" ? "#059669" : "#9CA3AF",
              ...cardShadow,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>{e.name}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
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
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 99,
                    backgroundColor: e.status === "active" ? "#D1FAE5" : "#F3F4F6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: e.status === "active" ? "#059669" : "#6B7280",
                      letterSpacing: 1,
                    }}
                  >
                    {e.status?.toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: "#9CA3AF", fontSize: 11, marginLeft: 8 }}>Max {e.max_cars}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
        {!loading && filtered.length === 0 && (
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 64 }}>📅</Text>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 8 }}>No events found</Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>
              Try a different filter
            </Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const chipStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#F3F4F6",
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 99,
  gap: 4,
};
const chipText = {
  color: "#6B7280",
  fontSize: 11,
  fontWeight: "600",
};
