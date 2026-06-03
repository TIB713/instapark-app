import { useEffect, useState, useCallback } from "react";
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

const ACCENT_COLOR = "#0F2044";

const cardShadow = {
  shadowColor: ACCENT_COLOR,
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export default function SupervisorManageEmployees() {
  const router = useRouter();
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
        <View style={{ backgroundColor: ACCENT_COLOR, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99, padding: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 12 }}>Employees</Text>
          </View>

          <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Driver Roster</Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>Read-only view of all registered drivers</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 14 }}>
          <Ionicons name="search-outline" size={18} color={ACCENT_COLOR} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search drivers..."
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 10, paddingVertical: 12, fontSize: 14, color: "#111827" }}
          />
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        {loading ? (
          <ActivityIndicator color={ACCENT_COLOR} style={{ marginTop: 20 }} />
        ) : (
          <>
            {filteredDrivers.map(d => (
              <TouchableOpacity
                key={d.id}
                onPress={() => router.push({ pathname: "/(admin)/driver-stats", params: { driverId: d.id, driverName: d.name } })}
                activeOpacity={0.85}
                style={{ 
                  backgroundColor: "#fff", 
                  borderRadius: 24, 
                  padding: 16, 
                  marginBottom: 12, 
                  flexDirection: "row", 
                  alignItems: "center", 
                  ...cardShadow 
                }}
              >
                <View style={{ backgroundColor: ACCENT_COLOR, borderRadius: 99, width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>{d.name?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: 15 }}>{d.name}</Text>
                  <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>ID: {d.employee_id}</Text>
                  {d.phone && <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 1 }}>{d.phone}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
            
            {filteredDrivers.length === 0 && (
              <View style={{ alignItems: "center", marginTop: 60 }}>
                <Text style={{ fontSize: 48 }}>👥</Text>
                <Text style={{ color: "#6B7280", marginTop: 8, fontWeight: "700" }}>No drivers found</Text>
              </View>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}
