import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export default function DriverStats() {
  const router = useRouter();
  const { driverId, driverName } = useLocalSearchParams();
  const { setCurrentEventId } = useAppStore();
  const [tab, setTab] = useState("performance");
  const [stats, setStats] = useState({ cars_checked_in: 0, cars_retrieved: 0 });
  const [filter, setFilter] = useState("all");
  const [filteredStats, setFilteredStats] = useState({ cars_checked_in: 0, cars_retrieved: 0 });
  const [driver, setDriver] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [events, setEvents] = useState([]);
  const [evtFilter, setEvtFilter] = useState("all");
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/drivers/${driverId}/stats`);
        setStats(data);
      } catch {}
      try {
        const { data } = await api.get(`/drivers/${driverId}`);
        setDriver(data);
        setName(data.name || "");
        setPhone(data.phone || "");
      } catch {}
    })();
  }, [driverId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/drivers/${driverId}/stats/filtered?filter=${filter}`);
        setFilteredStats(data);
      } catch {}
    })();
  }, [filter, driverId]);

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const { data: evs } = await api.get("/events");
      const results = [];
      const limited = (evs || []).slice(0, 20);
      for (const e of limited) {
        try {
          const { data: drs } = await api.get(`/events/${e.id}/drivers`);
          const found = drs.find((d) => d.id === driverId && d.assigned);
          if (found) results.push({ ...e, cars_checked_in: found.cars_checked_in, cars_retrieved: found.cars_retrieved });
        } catch {}
      }
      setEvents(results);
    } catch {}
    setLoadingEvents(false);
  };

  useEffect(() => { if (tab === "history") loadEvents(); }, [tab]);

  const saveDriver = async () => {
    try {
      const body = { name, phone };
      if (pin && pin.length === 4) body.pin = pin;
      await api.patch(`/drivers/${driverId}`, body);
      Alert.alert("Updated", "Driver updated");
      setPin("");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed");
    }
  };

  const openEvent = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(admin)/event-detail");
  };

  const filteredEvts = events.filter((e) => evtFilter === "all" || e.status === evtFilter);

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
        <View
          style={{
            backgroundColor: "#7C3AED",
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 18,
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
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, letterSpacing: 1.5 }}>DRIVER</Text>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{driverName}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Tabs */}
      <View style={{ flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 16, marginTop: -22, borderRadius: 20, padding: 4, ...cardShadow }}>
        {[["performance", "Lifetime"], ["history", "Events"]].map(([k, l]) => (
          <TouchableOpacity
            key={k}
            onPress={() => setTab(k)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: tab === k ? "#7C3AED" : "transparent",
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 13, color: tab === k ? "#fff" : "#6B7280", letterSpacing: 1 }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "performance" ? (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
          {/* Lifetime stats */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: "#7C3AED", borderRadius: 24, padding: 18, shadowColor: "#7C3AED", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 }}>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 8 }}>{stats.cars_checked_in}</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginTop: 2 }}>CHECKED IN</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "#059669", borderRadius: 24, padding: 18, shadowColor: "#059669", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 }}>
              <Ionicons name="flag" size={22} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 8 }}>{stats.cars_retrieved}</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginTop: 2 }}>RETRIEVED</Text>
            </View>
          </View>

          <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 3, marginBottom: 10 }}>TIME RANGE</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingBottom: 4 }} showsHorizontalScrollIndicator={false}>
            {[["week", "This Week"], ["month", "This Month"], ["quarter", "Last 3 Months"], ["all", "All Time"]].map(([f, l]) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 99,
                  backgroundColor: filter === f ? "#7C3AED" : "#fff",
                  borderWidth: 1,
                  borderColor: filter === f ? "#7C3AED" : "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: filter === f ? "#fff" : "#6B7280", letterSpacing: 1 }}>{l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <View style={[{ flex: 1, backgroundColor: "#fff", borderRadius: 24, padding: 16 }, cardShadow]}>
              <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>CHECKED IN</Text>
              <Text style={{ color: "#7C3AED", fontSize: 24, fontWeight: "900", marginTop: 6 }}>{filteredStats.cars_checked_in}</Text>
            </View>
            <View style={[{ flex: 1, backgroundColor: "#fff", borderRadius: 24, padding: 16 }, cardShadow]}>
              <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>RETRIEVED</Text>
              <Text style={{ color: "#059669", fontSize: 24, fontWeight: "900", marginTop: 6 }}>{filteredStats.cars_retrieved}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 3, marginTop: 24, marginBottom: 10 }}>EDIT DRIVER</Text>
          <View style={[{ backgroundColor: "#fff", borderRadius: 24, padding: 18 }, cardShadow]}>
            <Text style={miniLabel}>NAME</Text>
            <View style={miniInput}>
              <Ionicons name="person-outline" size={16} color="#7C3AED" />
              <TextInput value={name} onChangeText={setName} style={miniInputText} />
            </View>
            <Text style={miniLabel}>PHONE</Text>
            <View style={miniInput}>
              <Ionicons name="call-outline" size={16} color="#7C3AED" />
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={miniInputText} />
            </View>
            <Text style={miniLabel}>NEW PIN (LEAVE BLANK TO KEEP)</Text>
            <View style={miniInput}>
              <Ionicons name="keypad-outline" size={16} color="#7C3AED" />
              <TextInput value={pin} onChangeText={setPin} keyboardType="numeric" maxLength={4} secureTextEntry style={miniInputText} />
            </View>
            <TouchableOpacity
              onPress={saveDriver}
              style={{ backgroundColor: "#7C3AED", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 4 }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>SAVE</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
            {["all", "active", "closed"].map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setEvtFilter(f)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 99,
                  backgroundColor: evtFilter === f ? "#7C3AED" : "#fff",
                  borderWidth: 1,
                  borderColor: evtFilter === f ? "#7C3AED" : "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: evtFilter === f ? "#fff" : "#6B7280", letterSpacing: 1.5 }}>{f.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {loadingEvents && <ActivityIndicator color="#7C3AED" style={{ marginTop: 20 }} />}
          {!loadingEvents && filteredEvts.length === 0 && (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>📅</Text>
              <Text style={{ color: "#6B7280", marginTop: 8 }}>No events for this driver</Text>
            </View>
          )}
          {filteredEvts.map((e) => (
            <TouchableOpacity
              key={e.id}
              onPress={() => openEvent(e)}
              activeOpacity={0.85}
              style={{
                backgroundColor: "#fff",
                borderRadius: 24,
                padding: 16,
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                borderLeftWidth: 4,
                borderLeftColor: e.status === "active" ? "#059669" : "#9CA3AF",
                ...cardShadow,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", color: "#111827", fontSize: 15 }}>{e.name}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <View style={pillGray}><Ionicons name="calendar-outline" size={10} color="#6B7280" /><Text style={pillGrayText}>{e.date}</Text></View>
                  <View style={pillGray}><Ionicons name="location-outline" size={10} color="#6B7280" /><Text style={pillGrayText}>{e.venue}</Text></View>
                </View>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                    <Text style={{ color: "#059669", fontSize: 10, fontWeight: "800" }}>Check-ins {e.cars_checked_in || 0}</Text>
                  </View>
                  <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                    <Text style={{ color: "#0EA5E9", fontSize: 10, fontWeight: "800" }}>Retrieved {e.cars_retrieved || 0}</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const miniLabel = { fontSize: 10, fontWeight: "800", color: "#6B7280", letterSpacing: 2, marginBottom: 6 };
const miniInput = { backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginBottom: 12 };
const miniInputText = { flex: 1, paddingVertical: 10, marginLeft: 8, fontSize: 14, color: "#111827" };
const pillGray = { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, gap: 4 };
const pillGrayText = { color: "#6B7280", fontSize: 10, fontWeight: "700" };
