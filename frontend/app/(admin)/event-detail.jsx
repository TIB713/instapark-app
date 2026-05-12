import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { connectWS, disconnectWS } from "../../lib/websocket";

const STATUS_CONFIG = {
  CHECKED_IN: { color: "#3B82F6", label: "Checked In", border: "#3B82F6" },
  PARKED: { color: "#22C55E", label: "Parked", border: "#22C55E" },
  RETRIEVAL_REQUESTED: { color: "#EAB308", label: "Requested", border: "#EAB308" },
  BEING_FETCHED: { color: "#F97316", label: "Fetching", border: "#F97316" },
  DELIVERED: { color: "#9CA3AF", label: "Delivered", border: "#9CA3AF" },
};

const FILTERS = ["ALL", "CHECKED_IN", "PARKED", "RETRIEVAL_REQUESTED", "BEING_FETCHED", "DELIVERED"];

export default function EventDetail() {
  const router = useRouter();
  const { currentEventId } = useAppStore();
  const [event, setEvent] = useState(null);
  const [tab, setTab] = useState("cars");
  const [cars, setCars] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedCar, setSelectedCar] = useState(null);
  const [showCarModal, setShowCarModal] = useState(false);
  const [carPhotos, setCarPhotos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}`);
      setEvent(data);
    } catch {}
  }, [currentEventId]);

  const fetchCars = useCallback(async () => {
    try {
      const { data } = await api.get(`/cars/event/${currentEventId}`);
      setCars(data || []);
    } catch {}
  }, [currentEventId]);

  const fetchDrivers = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/drivers`);
      setDrivers(data || []);
    } catch {}
  }, [currentEventId]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/stats`);
      setStats(data);
    } catch {}
  }, [currentEventId]);

  useEffect(() => {
    if (!currentEventId) return;
    fetchEvent();
    fetchCars();
    fetchDrivers();
    fetchStats();
    connectWS(`/event/${currentEventId}`, (msg) => {
      if (msg.type === "car_update") fetchCars();
    });
    return () => disconnectWS(`/event/${currentEventId}`);
  }, [currentEventId]);

  const filteredCars = useMemo(() => {
    return cars.filter((c) => {
      if (search && !c.plate?.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      return true;
    });
  }, [cars, search, statusFilter]);

  const openCar = async (car) => {
    setSelectedCar(car);
    setShowCarModal(true);
    try {
      const { data } = await api.get(`/cars/${car.id}/photos`);
      setCarPhotos(data || []);
    } catch {
      setCarPhotos([]);
    }
  };

  const closeEvent = () => {
    Alert.alert("Close Event", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post(`/events/${currentEventId}/close`);
            router.back();
          } catch (e) {
            Alert.alert("Error", "Failed to close event");
          }
        },
      },
    ]);
  };

  const removeCar = (car) => {
    Alert.alert("Remove Vehicle", `Remove ${car.plate}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/cars/${car.id}`);
            setShowCarModal(false);
            fetchCars();
          } catch (e) {
            Alert.alert("Error", "Failed to remove");
          }
        },
      },
    ]);
  };

  const toggleAssign = async (d) => {
    try {
      if (d.assigned) {
        await api.delete(`/events/${currentEventId}/drivers/${d.id}`);
      } else {
        await api.post(`/events/${currentEventId}/drivers/${d.id}`);
      }
      fetchDrivers();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed");
    }
  };

  return (
    <View className="flex-1 bg-[#F9FAFB]" testID="event-detail-screen">
      <SafeAreaView edges={["top"]} className="bg-[#0F2044]">
        <View className="bg-[#0F2044] px-5 py-4 rounded-b-[30px]">
          <View className="flex-row items-center mb-3">
            <TouchableOpacity onPress={() => router.back()} className="bg-white/10 rounded-full p-2 mr-3">
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-black flex-1" numberOfLines={1}>
              {event?.name || "Event"}
            </Text>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(admin)/edit-event", params: { eventId: currentEventId } })}
              className="bg-white/10 rounded-full p-2 mr-2"
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
            {event?.status === "active" && (
              <TouchableOpacity onPress={closeEvent} className="bg-red-500/80 rounded-full p-2">
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          <View className="flex-row bg-white/10 rounded-2xl p-1">
            {[["cars", "Cars"], ["drivers", "Drivers"], ["stats", "Stats"]].map(([k, l]) => (
              <TouchableOpacity
                key={k}
                onPress={() => setTab(k)}
                testID={`tab-${k}`}
                className={`flex-1 py-2 rounded-xl ${tab === k ? "bg-white" : ""}`}
              >
                <Text className={`text-center font-bold ${tab === k ? "text-[#0F2044]" : "text-white"}`}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {tab === "cars" && (
        <ScrollView className="flex-1 px-4 pt-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchCars(); setRefreshing(false); }} />}
        >
          <View className="bg-white rounded-2xl px-4 flex-row items-center mb-3 border border-gray-200">
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search plate..." className="flex-1 py-3 ml-2" testID="car-search" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            {FILTERS.map((f) => (
              <TouchableOpacity key={f} onPress={() => setStatusFilter(f)} className={`px-4 py-2 rounded-full ${statusFilter === f ? "bg-[#0F2044]" : "bg-white border border-gray-200"}`}>
                <Text className={`text-xs font-bold ${statusFilter === f ? "text-white" : "text-gray-600"}`}>{f === "ALL" ? "All" : STATUS_CONFIG[f]?.label || f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text className="text-gray-500 text-xs my-2">{filteredCars.length} cars found</Text>
          {filteredCars.map((car) => {
            const cfg = STATUS_CONFIG[car.status] || STATUS_CONFIG.CHECKED_IN;
            return (
              <TouchableOpacity key={car.id} onPress={() => openCar(car)} activeOpacity={0.7} className="bg-white rounded-2xl p-4 mb-3 flex-row items-center" style={{ borderLeftWidth: 4, borderLeftColor: cfg.border }}>
                <View className="flex-1">
                  <Text className="font-black text-[#0F2044] text-base">{car.plate}</Text>
                  <Text className="text-gray-500 text-xs mt-0.5">{car.color} {car.make}</Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    {car.zone && car.slot ? `Zone ${car.zone} · Slot ${car.slot}` : "Not parked yet"}
                  </Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    {car.check_in_time ? formatDistanceToNow(new Date(car.check_in_time), { addSuffix: true }) : "Just now"}
                  </Text>
                </View>
                <View>
                  <View className="px-3 py-1 rounded-full" style={{ backgroundColor: cfg.color }}>
                    <Text className="text-white font-bold text-[10px]">{cfg.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ alignSelf: "flex-end", marginTop: 8 }} />
                </View>
              </TouchableOpacity>
            );
          })}
          {filteredCars.length === 0 && <Text className="text-gray-400 text-center mt-6">No cars yet</Text>}
        </ScrollView>
      )}

      {tab === "drivers" && (
        <ScrollView className="flex-1 px-4 pt-4">
          {drivers.length === 0 && <Text className="text-gray-400 text-center mt-6">No drivers</Text>}
          {drivers.map((d) => (
            <View key={d.id} className="bg-white rounded-2xl p-4 mb-3">
              <View className="flex-row items-center">
                <View className="bg-[#0F2044] rounded-full w-12 h-12 items-center justify-center">
                  <Text className="text-white font-black text-lg">{d.name?.[0]?.toUpperCase()}</Text>
                </View>
                <TouchableOpacity className="flex-1 ml-3" onPress={() => router.push({ pathname: "/(admin)/driver-stats", params: { driverId: d.id, driverName: d.name } })}>
                  <Text className="font-black text-[#0F2044]">{d.name}</Text>
                  <Text className="text-gray-500 text-xs">{d.employee_id}</Text>
                  <View className="flex-row items-center mt-1">
                    <View className={`w-2 h-2 rounded-full mr-1 ${d.available ? "bg-green-500" : "bg-red-500"}`} />
                    <Text className={`text-xs ${d.available ? "text-green-700" : "text-red-700"}`}>
                      {d.available ? "Available" : `In ${d.conflict_event_name || "another event"}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View className="flex-row mt-2 gap-3">
                <Text className="text-green-600 text-xs">Checked in: {d.cars_checked_in || 0}</Text>
                <Text className="text-blue-600 text-xs">Retrieved: {d.cars_retrieved || 0}</Text>
              </View>
              {d.available || d.assigned ? (
                <TouchableOpacity
                  onPress={() => toggleAssign(d)}
                  className={`mt-3 rounded-xl py-2 items-center ${d.assigned ? "border border-red-500" : "bg-[#0F2044]"}`}
                >
                  <Text className={`font-bold ${d.assigned ? "text-red-600" : "text-white"}`}>{d.assigned ? "UNASSIGN" : "ASSIGN"}</Text>
                </TouchableOpacity>
              ) : (
                <View className="mt-3 bg-gray-100 rounded-xl py-2 items-center">
                  <Text className="text-gray-400 text-xs">In {d.conflict_event_name}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {tab === "stats" && (
        <ScrollView className="flex-1 px-4 pt-4">
          <TouchableOpacity onPress={fetchStats} className="bg-white rounded-2xl py-2 items-center mb-4 border border-gray-200">
            <Text className="text-[#0F2044] font-bold">↻ Refresh Stats</Text>
          </TouchableOpacity>
          <View className="bg-white rounded-2xl p-5 mb-3">
            <Text className="text-xs font-bold text-gray-500 tracking-widest">⭐ AVG RATING</Text>
            <Text className="text-3xl font-black text-[#0F2044] mt-1">{stats?.avg_rating || "Not enough data"}</Text>
          </View>
          <View className="bg-white rounded-2xl p-5 mb-3">
            <Text className="text-xs font-bold text-gray-500 tracking-widest">🏆 TOP DRIVER</Text>
            <Text className="text-xl font-black text-[#0F2044] mt-1">{stats?.top_driver || "Not enough data"}</Text>
          </View>
          <View className="bg-white rounded-2xl p-5 mb-3">
            <Text className="text-xs font-bold text-gray-500 tracking-widest">⏱️ AVG RETRIEVAL</Text>
            <Text className="text-3xl font-black text-[#0F2044] mt-1">{stats?.avg_retrieval_minutes ? `${stats.avg_retrieval_minutes} min` : "Not enough data"}</Text>
          </View>
          <View className="bg-white rounded-2xl p-5 mb-3">
            <Text className="text-xs font-bold text-gray-500 tracking-widest">🚗 TOTAL CARS</Text>
            <Text className="text-3xl font-black text-[#0F2044] mt-1">{stats?.total_cars || 0}</Text>
          </View>
        </ScrollView>
      )}

      <Modal visible={showCarModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[30px] p-5" style={{ maxHeight: "85%" }}>
            <View className="items-center mb-3">
              <View className="bg-gray-300 w-12 h-1 rounded-full" />
            </View>
            <ScrollView>
              {selectedCar && (
                <>
                  <View className="flex-row items-start justify-between">
                    <View>
                      <Text className="text-3xl font-black text-[#0F2044]">{selectedCar.plate}</Text>
                      <Text className="text-gray-500 mt-1">{selectedCar.color} {selectedCar.make}</Text>
                      <Text className="text-gray-400 text-sm mt-1">
                        {selectedCar.zone ? `Zone ${selectedCar.zone} · Slot ${selectedCar.slot}` : "Not parked"}
                      </Text>
                    </View>
                    <View className="px-3 py-1 rounded-full" style={{ backgroundColor: STATUS_CONFIG[selectedCar.status]?.color }}>
                      <Text className="text-white font-bold text-xs">{STATUS_CONFIG[selectedCar.status]?.label}</Text>
                    </View>
                  </View>
                  {selectedCar.notes && <Text className="text-gray-600 mt-3 italic">"{selectedCar.notes}"</Text>}

                  <Text className="text-xs font-bold text-gray-500 tracking-widest mt-4 mb-2">CHECK-IN PHOTOS</Text>
                  {carPhotos.filter((p) => p.type === "checkin").length === 0 ? (
                    <Text className="text-gray-400 text-sm">No photos available</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {carPhotos.filter((p) => p.type === "checkin").map((p, i) => (
                        <Image key={i} source={{ uri: p.url }} style={{ width: 120, height: 120, borderRadius: 12 }} />
                      ))}
                    </ScrollView>
                  )}

                  {carPhotos.find((p) => p.type === "handover") && (
                    <>
                      <Text className="text-xs font-bold text-gray-500 tracking-widest mt-4 mb-2">HANDOVER PHOTO</Text>
                      <Image source={{ uri: carPhotos.find((p) => p.type === "handover").url }} style={{ width: "100%", height: 200, borderRadius: 12 }} />
                    </>
                  )}

                  <TouchableOpacity
                    onPress={() => {
                      setShowCarModal(false);
                      router.push({ pathname: "/(admin)/qr-display", params: { token: selectedCar.qr_token, plate: selectedCar.plate } });
                    }}
                    className="bg-[#0F2044] rounded-2xl py-3 items-center mt-5"
                  >
                    <Text className="text-white font-black tracking-widest">VIEW QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeCar(selectedCar)} className="border border-red-500 rounded-2xl py-3 items-center mt-2 mb-5">
                    <Text className="text-red-600 font-black tracking-widest">REMOVE VEHICLE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowCarModal(false)} className="py-3 items-center mb-3">
                    <Text className="text-gray-500 font-bold">Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
