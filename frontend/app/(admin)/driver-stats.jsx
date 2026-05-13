import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
    <View className="flex-1 bg-[#F9FAFB]">
      <SafeAreaView edges={["top"]} className="bg-[#7C3AED]">
        <View className="bg-[#7C3AED] px-5 py-4 rounded-b-[30px]">
          <View className="flex-row items-center mb-3">
            <TouchableOpacity onPress={() => router.back()} className="bg-white/10 rounded-full p-2 mr-3">
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-black flex-1">{driverName}</Text>
          </View>
          <View className="flex-row bg-white/10 rounded-2xl p-1">
            {[["performance", "Performance"], ["history", "History"]].map(([k, l]) => (
              <TouchableOpacity key={k} onPress={() => setTab(k)} className={`flex-1 py-2 rounded-xl ${tab === k ? "bg-white" : ""}`}>
                <Text className={`text-center font-bold ${tab === k ? "text-[#7C3AED]" : "text-white"}`}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {tab === "performance" ? (
        <ScrollView className="flex-1 px-4 pt-4">
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-white rounded-2xl p-4">
              <Text className="text-xs font-bold text-gray-500 tracking-widest">CHECKED IN</Text>
              <Text className="text-3xl font-black text-[#7C3AED] mt-1">{stats.cars_checked_in}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4">
              <Text className="text-xs font-bold text-gray-500 tracking-widest">RETRIEVED</Text>
              <Text className="text-3xl font-black text-[#7C3AED] mt-1">{stats.cars_retrieved}</Text>
            </View>
          </View>

          <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
            {[["week", "This Week"], ["month", "This Month"], ["quarter", "Last 3 Months"], ["all", "All Time"]].map(([f, l]) => (
              <TouchableOpacity key={f} onPress={() => setFilter(f)} className={`px-4 py-2 rounded-full ${filter === f ? "bg-[#7C3AED]" : "bg-white border border-gray-200"}`}>
                <Text className={`text-xs font-bold ${filter === f ? "text-white" : "text-gray-600"}`}>{l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View className="bg-white rounded-2xl p-4 mt-4">
            <Text className="text-gray-600 mb-2">In selected period:</Text>
            <Text className="text-green-600">Checked in: {filteredStats.cars_checked_in}</Text>
            <Text className="text-blue-600">Retrieved: {filteredStats.cars_retrieved}</Text>
          </View>

          <Text className="text-lg font-black text-[#7C3AED] mt-6 mb-2">Edit Driver</Text>
          <View className="bg-white rounded-2xl p-4">
            <Text className="text-xs font-bold text-gray-500 tracking-widest mb-1">NAME</Text>
            <TextInput value={name} onChangeText={setName} className="bg-gray-50 rounded-xl px-3 py-2 mb-3 border border-gray-200" />
            <Text className="text-xs font-bold text-gray-500 tracking-widest mb-1">PHONE</Text>
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" className="bg-gray-50 rounded-xl px-3 py-2 mb-3 border border-gray-200" />
            <Text className="text-xs font-bold text-gray-500 tracking-widest mb-1">NEW PIN (LEAVE BLANK TO KEEP)</Text>
            <TextInput value={pin} onChangeText={setPin} keyboardType="numeric" maxLength={4} secureTextEntry className="bg-gray-50 rounded-xl px-3 py-2 mb-4 border border-gray-200" />
            <TouchableOpacity onPress={saveDriver} className="bg-[#7C3AED] rounded-2xl py-3 items-center">
              <Text className="text-white font-black tracking-widest">SAVE</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView className="flex-1 px-4 pt-4">
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
            {["all", "active", "closed"].map((f) => (
              <TouchableOpacity key={f} onPress={() => setEvtFilter(f)} className={`px-4 py-2 rounded-full ${evtFilter === f ? "bg-[#7C3AED]" : "bg-white border border-gray-200"}`}>
                <Text className={`text-xs font-bold ${evtFilter === f ? "text-white" : "text-gray-600"}`}>{f.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {loadingEvents && <ActivityIndicator color="#7C3AED" style={{ marginTop: 20 }} />}
          {!loadingEvents && filteredEvts.length === 0 && <Text className="text-gray-400 text-center mt-10">No events for this driver</Text>}
          {filteredEvts.map((e) => (
            <TouchableOpacity key={e.id} onPress={() => openEvent(e)} activeOpacity={0.7}
              className="bg-white rounded-2xl p-4 mt-3 flex-row items-center"
              style={{ borderLeftWidth: 4, borderLeftColor: e.status === "active" ? "#22C55E" : "#9CA3AF" }}>
              <View className="flex-1">
                <Text className="font-black text-[#7C3AED]">{e.name}</Text>
                <Text className="text-gray-500 text-xs">{e.date} · {e.venue}</Text>
                <View className="flex-row gap-3 mt-1">
                  <Text className="text-green-600 text-xs">Checked in: {e.cars_checked_in || 0}</Text>
                  <Text className="text-blue-600 text-xs">Retrieved: {e.cars_retrieved || 0}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
