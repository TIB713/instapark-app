import { useEffect, useState, useCallback } from "react";
import { rs, rp } from '../../utils/responsive';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

const ACCENT_COLOR = "#0F2044";

const cardShadow = {
  shadowColor: ACCENT_COLOR,
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function SupervisorManageEmployees() {
  const router = useRouter();
  const { user } = useAppStore();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/drivers");
      setDrivers(data || []);
    } catch (e) {
      console.error("Error fetching drivers:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const filteredDrivers = drivers.filter(d => 
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: ACCENT_COLOR }}>
        <View style={{ backgroundColor: ACCENT_COLOR, paddingHorizontal: rp(20), paddingBottom: rp(20), paddingTop: rp(8) }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(16) }}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8) }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(12) }}>Employees</Text>
          </View>

          <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: rp(16), padding: rp(12) }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(16) }}>{user?.name || "Supervisor"}</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: rs(13), marginTop: rp(2) }}>Your Team</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ paddingHorizontal: rp(20), paddingVertical: rp(12) }}>
        <View style={{ backgroundColor: "#fff", borderRadius: rp(16), borderWidth: rp(1), borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: rp(14) }}>
          <Ionicons name="search-outline" size={18} color={ACCENT_COLOR} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search drivers..."
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(12), fontSize: rs(14), color: "#111827" }}
          />
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: rp(16) }}>
        {loading ? (
          <ActivityIndicator color={ACCENT_COLOR} style={{ marginTop: rp(20) }} />
        ) : (
          <>
            {filteredDrivers.map(d => (
              <TouchableOpacity
                key={d.id}
                onPress={() => router.push({ pathname: "/(admin)/driver-stats", params: { driverId: d.id, driverName: d.name } })}
                activeOpacity={0.85}
                style={{ 
                  backgroundColor: "#fff", 
                  borderRadius: rp(24), 
                  padding: rp(16), 
                  marginBottom: rp(12), 
                  flexDirection: "row", 
                  alignItems: "center", 
                  ...cardShadow 
                }}
              >
                <View style={{ backgroundColor: ACCENT_COLOR, borderRadius: rp(99), width: rp(48), height: rp(48), alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(18) }}>{d.name?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: rp(14) }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(15) }}>{d.name}</Text>
                  <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>ID: {d.employee_id}</Text>
                  {d.phone && <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginTop: rp(1) }}>{d.phone}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
            
            {filteredDrivers.length === 0 && (
              <View style={{ alignItems: "center", marginTop: rp(60) }}>
                <Text style={{ fontSize: rs(48) }}>👥</Text>
                <Text style={{ color: "#6B7280", marginTop: rp(8), fontWeight: "700" }}>No drivers found</Text>
              </View>
            )}

            <View style={{ marginTop: rp(24), paddingBottom: rp(20), alignItems: "center" }}>
              <Text style={{ color: "#9CA3AF", fontSize: rs(12), textAlign: "center", fontStyle: "italic" }}>
                Drivers are managed by your admin. You can view but cannot add or remove drivers.
              </Text>
            </View>
          </>
        )}
        <View style={{ height: rp(100) }} />
      </ScrollView>
    </View>
  );
}
