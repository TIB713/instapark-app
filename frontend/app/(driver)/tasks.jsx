import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal, FlatList, Alert, ActivityIndicator, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { connectWS, disconnectWS } from "../../lib/websocket";
import { enqueueHandover, getQueueCount, processPendingQueue } from "../../lib/offline";

export default function Tasks() {
  const router = useRouter();
  const { driver, currentEventId } = useAppStore();
  const resolvedDriverId = driver?.id;
  const [tab, setTab] = useState("mycars");
  const [cars, setCars] = useState([]);
  const [retrievals, setRetrievals] = useState([]);
  const [showParkModal, setShowParkModal] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [eventZones, setEventZones] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchMyCars = useCallback(async () => {
    try {
      const { data } = await api.get(`/cars/event/${currentEventId}`);
      setCars((data || []).filter((c) => c.check_in_driver_id === resolvedDriverId && ["CHECKED_IN", "PARKED"].includes(c.status)));
    } catch {}
  }, [currentEventId, resolvedDriverId]);

  const fetchRetrievals = useCallback(async () => {
    try {
      const { data } = await api.get(`/retrievals/event/${currentEventId}`);
      setRetrievals(data || []);
    } catch {}
  }, [currentEventId]);

  const refreshPending = async () => setPendingCount(await getQueueCount());

  useEffect(() => {
    if (!currentEventId) return;
    fetchMyCars();
    fetchRetrievals();
    refreshPending();
    connectWS(`/event/${currentEventId}`, (msg) => {
      if (msg.type === "car_update") fetchMyCars();
      if (msg.type === "slot_update") fetchSlots();
    });
    connectWS(`/retrievals/${currentEventId}`, (msg) => {
      if (msg.type === "retrieval_update") fetchRetrievals();
    });
    const unsub = NetInfo.addEventListener(async (state) => {
      if (state.isConnected) {
        await processPendingQueue();
        refreshPending();
      }
    });
    return () => {
      disconnectWS(`/event/${currentEventId}`);
      disconnectWS(`/retrievals/${currentEventId}`);
      unsub();
    };
  }, [currentEventId, fetchMyCars, fetchRetrievals]);

  // Restore pending handover after camera-induced restart
  useEffect(() => {
    (async () => {
      const pending = await AsyncStorage.getItem("pending_handover");
      if (pending) {
        await AsyncStorage.removeItem("pending_handover");
        const { carId } = JSON.parse(pending);
        const car = retrievals.find((r) => r.id === carId);
        if (car) handleHandover(car);
      }
    })();
  }, [retrievals]);

  const fetchSlots = async () => {
    try {
      const { data } = await api.get(`/slots/event/${currentEventId}`);
      setSlots(data || []);
    } catch {}
  };

  const openParkModal = async (car) => {
    setSelectedCar(car);
    setSelectedSlot(null);
    try {
      const { data: ev } = await api.get(`/events/${currentEventId}`);
      setEventZones(ev.zones || []);
      if (ev.zones?.[0]) setSelectedZone(ev.zones[0].name);
    } catch {}
    try { await api.post(`/slots/event/${currentEventId}/initialize`); } catch {}
    await fetchSlots();
    setShowParkModal(true);
  };

  const confirmPark = async () => {
    try {
      await api.patch(`/cars/${selectedCar.id}/park`, { zone: selectedZone, slot: selectedSlot, parked_driver_id: resolvedDriverId });
      setShowParkModal(false);
      fetchMyCars();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed");
    }
  };

  const pickup = async (car) => {
    try {
      await api.patch(`/cars/${car.id}/pickup`, { retrieval_driver_id: resolvedDriverId });
      fetchRetrievals();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed");
    }
  };

  const handleHandover = async (car) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera permission needed"); return; }
    try { await AsyncStorage.setItem("pending_handover", JSON.stringify({ carId: car.id })); } catch {}
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    try { await AsyncStorage.removeItem("pending_handover"); } catch {}
    if (result.canceled) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      const localPath = `${FileSystem.documentDirectory}handover_${car.id}_${Date.now()}.jpg`;
      try {
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: localPath });
        await enqueueHandover(car.id, localPath);
        await refreshPending();
        Alert.alert("Saved Offline", "Photo saved. Will upload when connected.");
      } catch (e) { Alert.alert("Error", "Failed to save offline"); }
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", { uri: result.assets[0].uri, type: "image/jpeg", name: "handover.jpg" });
      fd.append("folder", `handover/${car.id}`);
      const up = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await api.patch(`/cars/${car.id}/deliver`, { delivery_photo_url: up.data.url });
      fetchRetrievals();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Handover failed");
    }
  };

  const retrievalRequested = retrievals.filter((c) => c.status === "RETRIEVAL_REQUESTED").length;

  return (
    <View className="flex-1 bg-[#F9FAFB]" testID="tasks-screen">
      <SafeAreaView edges={["top"]} className="bg-[#0F2044]">
        <View className="bg-[#0F2044] px-5 py-4 rounded-b-[30px]">
          <View className="flex-row items-center mb-3">
            <TouchableOpacity onPress={() => router.back()} className="bg-white/10 rounded-full p-2">
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-black flex-1 text-center">My Tasks</Text>
            <TouchableOpacity onPress={() => router.push("/(driver)/checkin")} testID="add-checkin-btn" className="bg-white rounded-full w-10 h-10 items-center justify-center">
              <Ionicons name="add" size={24} color="#0F2044" />
            </TouchableOpacity>
          </View>
          <View className="flex-row bg-white/10 rounded-2xl p-1">
            <TouchableOpacity onPress={() => setTab("mycars")} className={`flex-1 py-2 rounded-xl ${tab === "mycars" ? "bg-white" : ""}`}>
              <Text className={`text-center font-bold ${tab === "mycars" ? "text-[#0F2044]" : "text-white"}`}>My Cars</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTab("retrievals")} className={`flex-1 py-2 rounded-xl flex-row justify-center items-center ${tab === "retrievals" ? "bg-white" : ""}`}>
              <Text className={`font-bold ${tab === "retrievals" ? "text-[#0F2044]" : "text-white"}`}>Retrievals</Text>
              {retrievalRequested > 0 && (
                <View className="bg-red-500 rounded-full px-2 ml-2">
                  <Text className="text-white text-xs font-bold">{retrievalRequested}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {pendingCount > 0 && (
        <View className="bg-amber-100 px-4 py-2 mx-4 mt-3 rounded-xl border border-amber-300">
          <Text className="text-amber-800 text-xs font-bold">⬆ {pendingCount} photo(s) pending upload — will sync when online</Text>
        </View>
      )}

      <ScrollView className="flex-1 px-4 pt-4">
        {tab === "mycars" && cars.length === 0 && <Text className="text-gray-400 text-center mt-10">No cars yet. Tap + to check in.</Text>}
        {tab === "mycars" && cars.map((car) => (
          <View key={car.id} className="bg-white rounded-2xl p-4 mb-3" style={{ borderLeftWidth: 4, borderLeftColor: car.status === "PARKED" ? "#22C55E" : "#3B82F6" }}>
            <Text className="font-black text-[#0F2044] text-base">{car.plate}</Text>
            <Text className="text-gray-500 text-xs">{car.color} {car.make}</Text>
            {car.status === "PARKED" ? (
              <Text className="text-green-600 font-bold mt-1">✓ Zone {car.zone} · Slot {car.slot}</Text>
            ) : (
              <View className="flex-row gap-2 mt-3">
                <TouchableOpacity onPress={() => router.push({ pathname: "/(driver)/qr-display", params: { token: car.qr_token, plate: car.plate } })}
                  className="flex-1 border border-[#0F2044] rounded-xl py-2 items-center">
                  <Text className="text-[#0F2044] font-bold text-xs">QR CODE</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openParkModal(car)} className="flex-1 bg-[#0F2044] rounded-xl py-2 items-center">
                  <Text className="text-white font-bold text-xs">MARK AS PARKED</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {tab === "retrievals" && retrievals.length === 0 && <Text className="text-gray-400 text-center mt-10">No retrieval requests</Text>}
        {tab === "retrievals" && retrievals.map((car) => {
          const isMine = car.retrieval_driver_id === resolvedDriverId;
          const borderColor = car.status === "RETRIEVAL_REQUESTED" ? "#EAB308" : isMine ? "#F97316" : "#9CA3AF";
          return (
            <View key={car.id} className="bg-white rounded-2xl p-4 mb-3" style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}>
              <Text className="font-black text-[#0F2044] text-base">{car.plate}</Text>
              <Text className="text-gray-500 text-xs">{car.color} {car.make}</Text>
              <Text className="text-gray-400 text-xs mt-1">Zone {car.zone} · Slot {car.slot}</Text>
              {car.status === "RETRIEVAL_REQUESTED" && (
                <TouchableOpacity onPress={() => pickup(car)} className="bg-amber-500 rounded-xl py-2 items-center mt-3">
                  <Text className="text-white font-bold text-xs">PICK UP REQUEST</Text>
                </TouchableOpacity>
              )}
              {car.status === "BEING_FETCHED" && isMine && (
                <TouchableOpacity onPress={() => handleHandover(car)} className="bg-green-600 rounded-xl py-2 items-center mt-3">
                  <Text className="text-white font-bold text-xs">HANDED TO GUEST</Text>
                </TouchableOpacity>
              )}
              {car.status === "BEING_FETCHED" && !isMine && (
                <Text className="text-gray-400 text-xs mt-3">Being fetched by another driver</Text>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showParkModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[30px] p-5" style={{ maxHeight: "85%" }}>
            <View className="items-center mb-3"><View className="bg-gray-300 w-12 h-1 rounded-full" /></View>
            <Text className="text-xl font-black text-[#0F2044]">Park {selectedCar?.plate}</Text>
            {eventZones.length === 0 ? (
              <View className="items-center py-10">
                <Ionicons name="map-outline" size={64} color="#9CA3AF" />
                <Text className="text-gray-700 font-bold mt-3">No Parking Zones Configured</Text>
                <Text className="text-gray-500 text-xs mt-1">Please ask your admin to set up zones</Text>
              </View>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
                  {eventZones.map((z) => {
                    const zoneSlots = slots.filter((s) => s.zone_name === z.name);
                    const free = zoneSlots.filter((s) => !s.is_occupied).length;
                    const isFull = zoneSlots.length > 0 && free === 0;
                    return (
                      <TouchableOpacity key={z.name} onPress={() => { setSelectedZone(z.name); setSelectedSlot(null); }}
                        className={`px-4 py-2 rounded-full ${isFull ? "bg-red-500" : selectedZone === z.name ? "bg-[#0F2044]" : "bg-white border border-gray-300"}`}>
                        <Text className={`text-xs font-bold ${isFull || selectedZone === z.name ? "text-white" : "text-gray-700"}`}>
                          {z.name} — {isFull ? "FULL" : `${free} free`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <FlatList
                  data={slots.filter((s) => s.zone_name === selectedZone)}
                  numColumns={5}
                  keyExtractor={(item, idx) => `${item.zone_name}-${item.slot_number}-${idx}`}
                  columnWrapperStyle={{ gap: 6, marginBottom: 6 }}
                  renderItem={({ item }) => {
                    const isSel = selectedSlot === item.slot_number;
                    const bg = item.is_occupied ? "#FECACA" : isSel ? "#0F2044" : "#BBF7D0";
                    return (
                      <TouchableOpacity
                        disabled={item.is_occupied}
                        onPress={() => setSelectedSlot(item.slot_number)}
                        style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}
                      >
                        {item.is_occupied ? (
                          <Ionicons name="close" size={18} color="#991B1B" />
                        ) : (
                          <Text className={`font-black ${isSel ? "text-white" : "text-green-800"}`}>{item.slot_number}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={<Text className="text-gray-400 text-center py-6">No slots in this zone</Text>}
                  style={{ maxHeight: 280 }}
                />
                <TouchableOpacity onPress={confirmPark} disabled={!selectedSlot}
                  className={`rounded-2xl py-4 items-center mt-3 ${selectedSlot ? "bg-[#0F2044]" : "bg-gray-300"}`}>
                  <Text className="text-white font-black tracking-widest">CONFIRM PARKING</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={() => setShowParkModal(false)} className="py-3 items-center mt-2">
              <Text className="text-gray-500 font-bold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
