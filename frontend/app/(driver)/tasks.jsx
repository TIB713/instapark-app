// version 3
import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { connectWS, disconnectWS } from "../../lib/websocket";
import { enqueueHandover, getQueueCount, processPendingQueue, enqueueParkAction, getQueueSummary, getFailedQueue } from "../../lib/offline";

const cardShadow = {
  shadowColor: "#059669",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

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
  const [failedCount, setFailedCount] = useState(0);
  const [handoverUploading, setHandoverUploading] = useState(false);
  const [queueSummary, setQueueSummary] = useState({ checkin: 0, park: 0, handover: 0, total: 0 });
  const [openingParkModal, setOpeningParkModal] = useState(null); // stores car.id while loading
  const [confirmingPark, setConfirmingPark] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyTag, setKeyTag] = useState("");
  const [parkPhotos, setParkPhotos] = useState([]);
  const [parkingPhotoStep, setParkingPhotoStep] = useState(false);
  const [addingKeyTagCarId, setAddingKeyTagCarId] = useState(null);
  const [keyTagInput, setKeyTagInput] = useState("");
  const [savingKeyTag, setSavingKeyTag] = useState(false);

  const fetchMyCars = useCallback(async () => {
    try {
      const { data } = await api.get(`/cars/event/${currentEventId}`, {
        params: {
          driver_id: resolvedDriverId,
          status: "CHECKED_IN,PARKED",
        },
      });
      // TODO: remove client-side filter once backend supports driver_id + status query params
      setCars(
        (data || []).filter(
          (c) => c.check_in_driver_id === resolvedDriverId && ["CHECKED_IN", "PARKED"].includes(c.status)
        )
      );
    } catch {}
  }, [currentEventId, resolvedDriverId]);

  const fetchRetrievals = useCallback(async () => {
    try {
      const { data } = await api.get(`/retrievals/event/${currentEventId}`);
      setRetrievals(data || []);
    } catch {}
  }, [currentEventId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMyCars(), fetchRetrievals()]);
    setRefreshing(false);
  }, [fetchMyCars, fetchRetrievals]);

  const refreshPending = async () => {
    const summary = await getQueueSummary();
    setQueueSummary(summary);
    setPendingCount(summary.total);
    const failed = await getFailedQueue();
    setFailedCount(failed.length);
  };

  useEffect(() => {
    if (!currentEventId) return;
    api.post(`/slots/event/${currentEventId}/initialize`).catch(() => {});
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
    setOpeningParkModal(car.id);
    setSelectedCar(car);
    setSelectedSlot(null);
    setSlots([]);
    setShowParkModal(true);
    try {
      const evRes = await api.get(`/events/${currentEventId}`);
      setEventZones(evRes.data.zones || []);
      if (evRes.data.zones?.[0]) setSelectedZone(evRes.data.zones[0].name);
    } catch {}
    await fetchSlots();
    setOpeningParkModal(null);
  };

  const confirmPark = async () => {
    if (!selectedSlot) return;

    if (parkPhotos.length === 0) {
      Alert.alert("Photo Required", "Please take at least one parking photo before confirming.", [
        { text: "OK" },
      ]);
      return;
    }

    setConfirmingPark(true);
    try {
      // 1. Copy photos to local storage first for safety
      const photoLocalPaths = [];
      for (let i = 0; i < parkPhotos.length; i++) {
        const localPath = `${FileSystem.documentDirectory}park_${selectedCar.id}_${i}_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: parkPhotos[i], to: localPath });
        photoLocalPaths.push(localPath);
      }

      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await enqueueParkAction(selectedCar.id, {
          zone: selectedZone,
          slot: selectedSlot,
          parkedDriverId: resolvedDriverId,
          photoLocalPaths,
        });
        setShowParkModal(false);
        setParkPhotos([]);
        setParkingPhotoStep(false);
        refreshPending();
        Alert.alert("Saved Offline", "Parking recorded. Will sync when connected.");
        return;
      }

      await api.patch(`/cars/${selectedCar.id}/park`, {
        zone: selectedZone,
        slot: selectedSlot,
        parked_driver_id: resolvedDriverId,
      });

      const carId = selectedCar.id;
      setShowParkModal(false);
      setParkPhotos([]);
      setParkingPhotoStep(false);
      fetchMyCars();

      // Use the locally copied photos for background upload as well
      uploadParkPhotosInBackground(carId, photoLocalPaths);
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to park");
    } finally {
      setConfirmingPark(false);
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

  const uploadHandoverInBackground = async (carId, uri) => {
    try {
      const formData = new FormData();
      formData.append("file", { uri, type: "image/jpeg", name: "handover.jpg" });
      formData.append("folder", `handover/${carId}`);
      const up = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await api.patch(`/cars/${carId}/update-photo`, {
        delivery_photo_url: up.data.url,
      });
    } catch {}
  };

  const takeParkPhoto = async () => {
    if (parkPhotos.length >= 5) {
      Alert.alert("Max 5 photos", "Maximum 5 parking photos allowed");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
      );
      const finalUri = compressed.uri;
      setParkPhotos((prev) => [...prev, finalUri]);
    }
  };

  const uploadParkPhotosInBackground = async (carId, photoUris) => {
    try {
      const urls = [];
      for (const uri of photoUris) {
        const fd = new FormData();
        fd.append("file", { uri, type: "image/jpeg", name: "parked.jpg" });
        fd.append("folder", `parked/${carId}`);
        const up = await api.post("/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        urls.push(up.data.url);
      }
      if (urls.length > 0) {
        await api.post(`/cars/${carId}/photos`, {
          urls,
          type: "parked",
        });
        // Store first photo as parked_photo_url on the car record
        await api.patch(`/cars/${carId}/park-photo`, {
          parked_photo_url: urls[0],
        });
      }
    } catch {}
  };

  const saveKeyTag = async (carId) => {
    if (!keyTagInput.trim()) return;
    setSavingKeyTag(true);
    try {
      await api.patch(`/cars/${carId}/key-tag`, {
        key_tag: keyTagInput.trim(),
      });
      setAddingKeyTagCarId(null);
      setKeyTagInput("");
      fetchMyCars();
    } catch {
      Alert.alert("Error", "Failed to save key tag");
    } finally {
      setSavingKeyTag(false);
    }
  };

  const handleHandover = async (car) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera permission needed"); return; }
    try { await AsyncStorage.setItem("pending_handover", JSON.stringify({ carId: car.id })); } catch {}
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
    try { await AsyncStorage.removeItem("pending_handover"); } catch {}
    if (result.canceled) return;
    const asset = result.assets[0];
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
    );
    const finalUri = compressed.uri;
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      const localPath = `${FileSystem.documentDirectory}handover_${car.id}_${Date.now()}.jpg`;
      try {
        await FileSystem.copyAsync({ from: finalUri, to: localPath });
        await enqueueHandover(car.id, localPath);
        await refreshPending();
        Alert.alert("Saved Offline", "Photo saved. Will upload when connected.");
      } catch (e) { Alert.alert("Error", "Failed to save offline"); }
      return;
    }
    setHandoverUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", { uri: finalUri, type: "image/jpeg", name: "handover.jpg" });
      formData.append("folder", `handover/${car.id}`);
      const up = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const photoUrl = up.data.url;

      await api.patch(`/cars/${car.id}/deliver`, { delivery_photo_url: photoUrl });
      fetchRetrievals();
    } catch (e) {
      Alert.alert("Handover Failed", e.response?.data?.detail || "Could not complete handover. Try again.");
    } finally {
      setHandoverUploading(false);
    }
  };

  const retrievalRequested = retrievals.filter((c) => c.status === "RETRIEVAL_REQUESTED").length;

  return (
    <View style={{ flex: 1, backgroundColor: "#ECFDF5" }} testID="tasks-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#059669" }}>
        <View
          style={{
            backgroundColor: "#059669",
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
              backgroundColor: "rgba(8,145,178,0.5)",
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
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", flex: 1, textAlign: "center", marginRight: 40 }}>
              My Tasks
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(driver)/checkin")}
              testID="add-checkin-btn"
              style={{ backgroundColor: "#fff", borderRadius: 99, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="add" size={24} color="#059669" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Tab pill */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#fff",
          marginHorizontal: 16,
          marginTop: -18,
          borderRadius: 20,
          padding: 4,
          ...cardShadow,
        }}
      >
        <TouchableOpacity
          onPress={() => setTab("mycars")}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 16,
            backgroundColor: tab === "mycars" ? "#059669" : "transparent",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "800", fontSize: 13, color: tab === "mycars" ? "#fff" : "#6B7280", letterSpacing: 1 }}>My Cars</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab("retrievals")}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 16,
            backgroundColor: tab === "retrievals" ? "#059669" : "transparent",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "800", fontSize: 13, color: tab === "retrievals" ? "#fff" : "#6B7280", letterSpacing: 1 }}>Retrievals</Text>
          {retrievalRequested > 0 && (
            <View style={{ backgroundColor: "#F43F5E", borderRadius: 99, paddingHorizontal: 7, marginLeft: 6 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>{retrievalRequested}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {failedCount > 0 && (
        <TouchableOpacity onPress={() => router.push("/(driver)/failed-syncs")}>
          <View
            style={{
              backgroundColor: "#FEE2E2",
              padding: 12,
              marginHorizontal: 16,
              marginTop: 8,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#FCA5A5",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="warning" size={16} color="#B91C1C" />
            <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "700", marginLeft: 8, flex: 1 }}>
              {failedCount} sync failure(s) — these check-ins could not be uploaded. Tell your supervisor.
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {pendingCount > 0 && (
        <View
          style={{
            backgroundColor: "#FEF3C7",
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginHorizontal: 16,
            marginTop: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#F59E0B",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons name="cloud-offline" size={16} color="#92400E" />
          <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "700", marginLeft: 8 }}>
            {[
              queueSummary.checkin ? `${queueSummary.checkin} check-in(s)` : null,
              queueSummary.park ? `${queueSummary.park} parking` : null,
              queueSummary.handover ? `${queueSummary.handover} handover(s)` : null,
            ].filter(Boolean).join(" · ")} pending — will sync when online
          </Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" colors={["#059669"]} />
        }
      >
        {tab === "mycars" && cars.length === 0 && (
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 64 }}>🚗</Text>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 12 }}>No cars yet</Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Tap + to check in a vehicle</Text>
          </View>
        )}
        {tab === "mycars" && cars.map((car) => (
          <View
            key={car.id}
            style={{
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: 18,
              marginBottom: 12,
              borderLeftWidth: 4,
              borderLeftColor: car.status === "PARKED" ? "#059669" : "#0EA5E9",
              ...cardShadow,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{car.plate}</Text>
                <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{car.color} {car.make}</Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 99,
                  backgroundColor: car.status === "PARKED" ? "#D1FAE5" : "#E0F2FE",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 1,
                    color: car.status === "PARKED" ? "#059669" : "#0284C7",
                  }}
                >
                  {car.status === "PARKED" ? "PARKED" : "CHECKED IN"}
                </Text>
              </View>
            </View>

            {car.status === "PARKED" ? (
              <View>
                <View
                  style={{
                    alignSelf: "flex-start",
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#ECFDF5",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 99,
                    marginTop: 10,
                  }}
                >
                  <Ionicons name="location" size={13} color="#059669" />
                  <Text style={{ color: "#059669", fontWeight: "800", fontSize: 12, marginLeft: 4 }}>
                    Zone {car.zone} · Slot {car.slot}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/(driver)/qr-display", params: { token: car.qr_token, plate: car.plate } })}
                  style={{
                    borderWidth: 1.5,
                    borderColor: "#059669",
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: "center",
                    marginTop: 12,
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="qr-code-outline" size={16} color="#059669" />
                  <Text style={{ color: "#059669", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1.5 }}>
                    SHOW QR CODE
                  </Text>
                </TouchableOpacity>

                {car.key_tag ? (
                  <View style={{ backgroundColor: "#FEF3C7",
                    paddingHorizontal: 10, paddingVertical: 4,
                    borderRadius: 99, marginTop: 6,
                    flexDirection: "row", alignItems: "center",
                    alignSelf: "flex-start" }}>
                    <Ionicons name="key" size={12} color="#D97706" />
                    <Text style={{ color: "#D97706", fontSize: 12,
                      fontWeight: "900", marginLeft: 5 }}>
                      Key #{car.key_tag}
                    </Text>
                  </View>
                ) : (
                  car.status === "PARKED" && (
                    addingKeyTagCarId === car.id ? (
                      <View style={{ marginTop: 8 }}>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <View style={{ flex: 1, backgroundColor: "#F9FAFB",
                            borderRadius: 12, borderWidth: 1,
                            borderColor: "#E5E7EB", flexDirection: "row",
                            alignItems: "center", paddingHorizontal: 10 }}>
                            <Ionicons name="key-outline" size={14}
                              color="#7C3AED" />
                            <TextInput
                              value={keyTagInput}
                              onChangeText={setKeyTagInput}
                              placeholder="Hook number"
                              placeholderTextColor="#9CA3AF"
                              keyboardType="number-pad"
                              maxLength={4}
                              autoFocus
                              style={{ flex: 1, paddingVertical: 10,
                                paddingLeft: 6, fontSize: 15,
                                color: "#111827", fontWeight: "900" }}
                            />
                          </View>
                          <TouchableOpacity
                            onPress={() => saveKeyTag(car.id)}
                            disabled={savingKeyTag || !keyTagInput.trim()}
                            style={{ backgroundColor:
                              keyTagInput.trim() ? "#7C3AED" : "#D1D5DB",
                              borderRadius: 12, paddingHorizontal: 14,
                              justifyContent: "center" }}
                          >
                            {savingKeyTag ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="checkmark" size={18}
                                color="#fff" />
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setAddingKeyTagCarId(null);
                              setKeyTagInput("");
                            }}
                            style={{ backgroundColor: "#F3F4F6",
                              borderRadius: 12, paddingHorizontal: 12,
                              justifyContent: "center" }}
                          >
                            <Ionicons name="close" size={16}
                              color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setAddingKeyTagCarId(car.id);
                          setKeyTagInput("");
                        }}
                        style={{ flexDirection: "row", alignItems: "center",
                          backgroundColor: "#FEF3C7", paddingHorizontal: 10,
                          paddingVertical: 5, borderRadius: 99, marginTop: 6,
                          alignSelf: "flex-start", borderWidth: 1,
                          borderColor: "#FDE68A", borderStyle: "dashed" }}
                      >
                        <Ionicons name="key-outline" size={12}
                          color="#D97706" />
                        <Text style={{ color: "#D97706", fontSize: 11,
                          fontWeight: "800", marginLeft: 4 }}>
                          + Add Key Tag
                        </Text>
                      </TouchableOpacity>
                    )
                  )
                )}
                {car.notes ? (
                  <View style={{
                    backgroundColor: "#FEF3C7",
                    borderRadius: 10,
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    marginTop: 6,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 5,
                  }}>
                    <Ionicons name="information-circle-outline"
                      size={13} color="#D97706"
                      style={{ marginTop: 1 }} />
                    <Text style={{ color: "#92400E", fontSize: 11,
                      flex: 1, lineHeight: 16 }}>
                      {car.notes}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/(driver)/qr-display", params: { token: car.qr_token, plate: car.plate } })}
                  style={{
                    flex: 1,
                    borderWidth: 1.5,
                    borderColor: "#059669",
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="qr-code-outline" size={14} color="#059669" />
                  <Text style={{ color: "#059669", fontWeight: "900", fontSize: 11, marginLeft: 4, letterSpacing: 1 }}>QR CODE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openParkModal(car)}
                  disabled={openingParkModal === car.id}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: openingParkModal === car.id ? "#047857" : "#059669",
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    opacity: openingParkModal === car.id ? 0.8 : 1,
                  }}
                >
                  {openingParkModal === car.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="location" size={14} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11, marginLeft: 4, letterSpacing: 1 }}>MARK PARKED</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {tab === "retrievals" && retrievals.length === 0 && (
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 64 }}>🔔</Text>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 12 }}>No retrieval requests</Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>You're all caught up!</Text>
          </View>
        )}
        {tab === "retrievals" && retrievals.map((car) => {
          const isMine = car.retrieval_driver_id === resolvedDriverId;
          let borderColor = "#9CA3AF";
          if (car.status === "RETRIEVAL_REQUESTED") borderColor = "#F59E0B";
          else if (car.status === "BEING_FETCHED" && isMine) borderColor = "#F97316";
          return (
            <View
              key={car.id}
              style={{
                backgroundColor: "#fff",
                borderRadius: 24,
                padding: 18,
                marginBottom: 12,
                borderLeftWidth: 4,
                borderLeftColor: borderColor,
                ...cardShadow,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{car.plate}</Text>
                  <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{car.color} {car.make}</Text>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#F3F4F6",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 99,
                      marginTop: 6,
                    }}
                  >
                    <Ionicons name="location-outline" size={11} color="#6B7280" />
                    <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "700", marginLeft: 4 }}>
                      Zone {car.zone} · Slot {car.slot}
                    </Text>
                  </View>
                  {car.key_tag && (
                    <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, marginTop: 6, flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="key" size={12} color="#D97706" />
                      <Text style={{ color: "#D97706", fontSize: 12, fontWeight: "900", marginLeft: 5 }}>
                        Key #{car.key_tag}
                      </Text>
                    </View>
                  )}
                  {car.notes ? (
                    <View style={{
                      backgroundColor: "#FEF3C7",
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      marginTop: 6,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 5,
                    }}>
                      <Ionicons name="information-circle-outline"
                        size={13} color="#D97706"
                        style={{ marginTop: 1 }} />
                      <Text style={{ color: "#92400E", fontSize: 11,
                        flex: 1, lineHeight: 16 }}>
                        {car.notes}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 99,
                    backgroundColor: borderColor,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>
                    {car.status === "RETRIEVAL_REQUESTED" ? "REQUESTED" : isMine ? "YOURS" : "OTHER"}
                  </Text>
                </View>
              </View>
              {car.status === "RETRIEVAL_REQUESTED" && (
                <TouchableOpacity
                  onPress={() => pickup(car)}
                  style={{ backgroundColor: "#F59E0B", borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 12, flexDirection: "row", justifyContent: "center" }}
                >
                  <Ionicons name="hand-right" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1.5 }}>PICK UP</Text>
                </TouchableOpacity>
              )}
              {car.status === "BEING_FETCHED" && isMine && (
                <TouchableOpacity
                  onPress={() => handleHandover(car)}
                  disabled={handoverUploading}
                  style={{ backgroundColor: "#059669", borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 12, flexDirection: "row", justifyContent: "center", opacity: handoverUploading ? 0.7 : 1 }}
                >
                  {handoverUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={14} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1.5 }}>HANDED TO GUEST</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {car.status === "BEING_FETCHED" && !isMine && (
                <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 10, fontStyle: "italic" }}>
                  Being fetched by another driver
                </Text>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showParkModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20, maxHeight: "85%" }}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#7C3AED", letterSpacing: 3 }}>PARK VEHICLE</Text>
            <Text style={{ fontSize: 24, fontWeight: "900", color: "#111827", marginTop: 2 }}>{selectedCar?.plate}</Text>
            {eventZones.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons name="map-outline" size={64} color="#9CA3AF" />
                <Text style={{ color: "#111827", fontWeight: "800", marginTop: 12 }}>No Parking Zones Configured</Text>
                <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>Please ask your admin to set up zones</Text>
              </View>
            ) : !slots.length ? (
              <View style={{ alignItems: "center", padding: 32 }}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={{ color: "#6B7280", marginTop: 8 }}>Loading parking slots...</Text>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 2, marginTop: 18, marginBottom: 8 }}>SELECT ZONE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {eventZones.map((z) => {
                    const zoneSlots = slots.filter((s) => s.zone_name === z.name);
                    const free = zoneSlots.filter((s) => !s.is_occupied).length;
                    const isFull = zoneSlots.length > 0 && free === 0;
                    return (
                      <TouchableOpacity
                        key={z.name}
                        onPress={() => { setSelectedZone(z.name); setSelectedSlot(null); }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 99,
                          backgroundColor: isFull ? "#F43F5E" : selectedZone === z.name ? "#7C3AED" : "#fff",
                          borderWidth: 1,
                          borderColor: isFull ? "#F43F5E" : selectedZone === z.name ? "#7C3AED" : "#E5E7EB",
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "800", color: isFull || selectedZone === z.name ? "#fff" : "#374151", letterSpacing: 0.5 }}>
                          {z.name} — {isFull ? "FULL" : `${free} free`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 2, marginTop: 14, marginBottom: 8 }}>SELECT SLOT</Text>
                <FlatList
                  data={slots.filter((s) => s.zone_name === selectedZone)}
                  numColumns={5}
                  keyExtractor={(item, idx) => `${item.zone_name}-${item.slot_number}-${idx}`}
                  columnWrapperStyle={{ gap: 6, marginBottom: 6 }}
                  renderItem={({ item }) => {
                    const isSel = selectedSlot === item.slot_number;
                    let bg = "#D1FAE5";
                    if (item.is_occupied) bg = "#FECACA";
                    else if (isSel) bg = "#7C3AED";
                    return (
                      <TouchableOpacity
                        disabled={item.is_occupied}
                        onPress={() => setSelectedSlot(item.slot_number)}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 14,
                          backgroundColor: bg,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {item.is_occupied ? (
                          <Ionicons name="close" size={18} color="#991B1B" />
                        ) : (
                          <Text style={{ fontWeight: "900", color: isSel ? "#fff" : "#065F46" }}>
                            {item.slot_number}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={<Text style={{ color: "#9CA3AF", textAlign: "center", paddingVertical: 24 }}>No slots in this zone</Text>}
                  style={{ maxHeight: 280 }}
                />
                {/* Parking Photos */}
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 2, marginTop: 14, marginBottom: 8 }}>
                  PARKING PHOTOS * (MIN 1, MAX 5)
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 14 }}>
                  {parkPhotos.map((uri, i) => (
                    <View key={i} style={{ position: "relative" }}>
                      <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 14, borderWidth: 1.5, borderColor: "#E5E7EB" }} />
                      <TouchableOpacity
                        onPress={() => setParkPhotos(parkPhotos.filter((_, k) => k !== i))}
                        style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#EF4444", borderRadius: 99, width: 22, height: 22, alignItems: "center", justifyContent: "center" }}
                      >
                        <Ionicons name="close" size={13} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {parkPhotos.length < 5 && (
                    <TouchableOpacity
                      onPress={takeParkPhoto}
                      style={{ width: 80, height: 80, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#7C3AED", backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="camera-outline" size={26} color="#7C3AED" />
                      <Text style={{ color: "#7C3AED", fontSize: 10, fontWeight: "800", marginTop: 4 }}>{parkPhotos.length === 0 ? "ADD" : "MORE"}</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>

                <TouchableOpacity
                  onPress={confirmPark}
                  disabled={!selectedSlot || confirmingPark}
                  activeOpacity={0.7}
                  style={{
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: "center",
                    marginTop: 14,
                    backgroundColor: selectedSlot && !confirmingPark ? "#7C3AED" : "#D1D5DB",
                  }}
                >
                  {confirmingPark ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>CONFIRM PARKING</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              onPress={() => {
                setShowParkModal(false);
                setParkPhotos([]);
                setParkingPhotoStep(false);
                setKeyTag("");
              }}
              style={{ paddingVertical: 12, alignItems: "center", marginTop: 4 }}
            >
              <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}














// import { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   Modal,
//   FlatList,
//   Alert,
//   RefreshControl,
// } from "react-native";
// import { useRouter } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { SafeAreaView } from "react-native-safe-area-context";
// import * as ImagePicker from "expo-image-picker";
// import * as FileSystem from "expo-file-system";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import NetInfo from "@react-native-community/netinfo";
// import api from "../../lib/api";
// import { useAppStore } from "../../lib/store";
// import { connectWS, disconnectWS } from "../../lib/websocket";
// import { enqueueHandover, getQueueCount, processPendingQueue } from "../../lib/offline";

// const cardShadow = {
//   shadowColor: "#059669",
//   shadowOpacity: 0.08,
//   shadowRadius: 16,
//   shadowOffset: { width: 0, height: 4 },
//   elevation: 4,
// };

// export default function Tasks() {
//   const router = useRouter();
//   const { driver, currentEventId } = useAppStore();
//   const resolvedDriverId = driver?.id;
//   const [tab, setTab] = useState("mycars");
//   const [cars, setCars] = useState([]);
//   const [retrievals, setRetrievals] = useState([]);
//   const [showParkModal, setShowParkModal] = useState(false);
//   const [selectedCar, setSelectedCar] = useState(null);
//   const [eventZones, setEventZones] = useState([]);
//   const [slots, setSlots] = useState([]);
//   const [selectedZone, setSelectedZone] = useState("");
//   const [selectedSlot, setSelectedSlot] = useState(null);
//   const [pendingCount, setPendingCount] = useState(0);
//   const [refreshing, setRefreshing] = useState(false);

//   const fetchMyCars = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/cars/event/${currentEventId}`);
//       setCars((data || []).filter((c) => c.check_in_driver_id === resolvedDriverId && ["CHECKED_IN", "PARKED"].includes(c.status)));
//     } catch {}
//   }, [currentEventId, resolvedDriverId]);

//   const fetchRetrievals = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/retrievals/event/${currentEventId}`);
//       setRetrievals(data || []);
//     } catch {}
//   }, [currentEventId]);

//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);
//     await Promise.all([fetchMyCars(), fetchRetrievals()]);
//     setRefreshing(false);
//   }, [fetchMyCars, fetchRetrievals]);

//   const refreshPending = async () => setPendingCount(await getQueueCount());

//   useEffect(() => {
//     if (!currentEventId) return;
//     fetchMyCars();
//     fetchRetrievals();
//     refreshPending();
//     connectWS(`/event/${currentEventId}`, (msg) => {
//       if (msg.type === "car_update") fetchMyCars();
//       if (msg.type === "slot_update") fetchSlots();
//     });
//     connectWS(`/retrievals/${currentEventId}`, (msg) => {
//       if (msg.type === "retrieval_update") fetchRetrievals();
//     });
//     const unsub = NetInfo.addEventListener(async (state) => {
//       if (state.isConnected) {
//         await processPendingQueue();
//         refreshPending();
//       }
//     });
//     return () => {
//       disconnectWS(`/event/${currentEventId}`);
//       disconnectWS(`/retrievals/${currentEventId}`);
//       unsub();
//     };
//   }, [currentEventId, fetchMyCars, fetchRetrievals]);

//   useEffect(() => {
//     (async () => {
//       const pending = await AsyncStorage.getItem("pending_handover");
//       if (pending) {
//         await AsyncStorage.removeItem("pending_handover");
//         const { carId } = JSON.parse(pending);
//         const car = retrievals.find((r) => r.id === carId);
//         if (car) handleHandover(car);
//       }
//     })();
//   }, [retrievals]);

//   const fetchSlots = async () => {
//     try {
//       const { data } = await api.get(`/slots/event/${currentEventId}`);
//       setSlots(data || []);
//     } catch {}
//   };

//   const openParkModal = async (car) => {
//     setSelectedCar(car);
//     setSelectedSlot(null);
//     try {
//       const { data: ev } = await api.get(`/events/${currentEventId}`);
//       setEventZones(ev.zones || []);
//       if (ev.zones?.[0]) setSelectedZone(ev.zones[0].name);
//     } catch {}
//     try { await api.post(`/slots/event/${currentEventId}/initialize`); } catch {}
//     await fetchSlots();
//     setShowParkModal(true);
//   };

//   const confirmPark = async () => {
//     try {
//       await api.patch(`/cars/${selectedCar.id}/park`, { zone: selectedZone, slot: selectedSlot, parked_driver_id: resolvedDriverId });
//       setShowParkModal(false);
//       fetchMyCars();
//     } catch (e) {
//       Alert.alert("Error", e.response?.data?.detail || "Failed");
//     }
//   };

//   const pickup = async (car) => {
//     try {
//       await api.patch(`/cars/${car.id}/pickup`, { retrieval_driver_id: resolvedDriverId });
//       fetchRetrievals();
//     } catch (e) {
//       Alert.alert("Error", e.response?.data?.detail || "Failed");
//     }
//   };

//   const uploadHandoverInBackground = async (carId, uri) => {
//     try {
//       const formData = new FormData();
//       formData.append("file", { uri, type: "image/jpeg", name: "handover.jpg" });
//       formData.append("folder", `handover/${carId}`);
//       const up = await api.post("/upload", formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });
//       await api.patch(`/cars/${carId}/update-photo`, {
//         delivery_photo_url: up.data.url,
//       });
//     } catch {}
//   };

//   const handleHandover = async (car) => {
//     const perm = await ImagePicker.requestCameraPermissionsAsync();
//     if (!perm.granted) { Alert.alert("Camera permission needed"); return; }
//     try { await AsyncStorage.setItem("pending_handover", JSON.stringify({ carId: car.id })); } catch {}
//     const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
//     try { await AsyncStorage.removeItem("pending_handover"); } catch {}
//     if (result.canceled) return;
//     const net = await NetInfo.fetch();
//     if (!net.isConnected) {
//       const localPath = `${FileSystem.documentDirectory}handover_${car.id}_${Date.now()}.jpg`;
//       try {
//         await FileSystem.copyAsync({ from: result.assets[0].uri, to: localPath });
//         await enqueueHandover(car.id, localPath);
//         await refreshPending();
//         Alert.alert("Saved Offline", "Photo saved. Will upload when connected.");
//       } catch (e) { Alert.alert("Error", "Failed to save offline"); }
//       return;
//     }
//     try {
//       await api.patch(`/cars/${car.id}/deliver`, { delivery_photo_url: "" });
//       fetchRetrievals();
//       uploadHandoverInBackground(car.id, result.assets[0].uri);
//     } catch (e) {
//       Alert.alert("Error", e.response?.data?.detail || "Handover failed");
//     }
//   };

//   const retrievalRequested = retrievals.filter((c) => c.status === "RETRIEVAL_REQUESTED").length;

//   return (
//     <View style={{ flex: 1, backgroundColor: "#ECFDF5" }} testID="tasks-screen">
//       <SafeAreaView edges={["top"]} style={{ backgroundColor: "#059669" }}>
//         <View
//           style={{
//             backgroundColor: "#059669",
//             borderBottomLeftRadius: 44,
//             borderBottomRightRadius: 44,
//             paddingHorizontal: 20,
//             paddingTop: 8,
//             paddingBottom: 18,
//           }}
//         >
//           <View
//             style={{
//               position: "absolute",
//               top: 0,
//               left: 0,
//               right: 0,
//               bottom: 0,
//               backgroundColor: "rgba(8,145,178,0.5)",
//               borderBottomLeftRadius: 44,
//               borderBottomRightRadius: 44,
//             }}
//           />
//           <View style={{ flexDirection: "row", alignItems: "center" }}>
//             <TouchableOpacity
//               onPress={() => router.back()}
//               style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99, padding: 8 }}
//             >
//               <Ionicons name="chevron-back" size={22} color="#fff" />
//             </TouchableOpacity>
//             <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", flex: 1, textAlign: "center", marginRight: 40 }}>
//               My Tasks
//             </Text>
//             <TouchableOpacity
//               onPress={() => router.push("/(driver)/checkin")}
//               testID="add-checkin-btn"
//               style={{ backgroundColor: "#fff", borderRadius: 99, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
//             >
//               <Ionicons name="add" size={24} color="#059669" />
//             </TouchableOpacity>
//           </View>
//         </View>
//       </SafeAreaView>

//       {/* Tab pill */}
//       <View
//         style={{
//           flexDirection: "row",
//           backgroundColor: "#fff",
//           marginHorizontal: 16,
//           marginTop: -18,
//           borderRadius: 20,
//           padding: 4,
//           ...cardShadow,
//         }}
//       >
//         <TouchableOpacity
//           onPress={() => setTab("mycars")}
//           style={{
//             flex: 1,
//             paddingVertical: 10,
//             borderRadius: 16,
//             backgroundColor: tab === "mycars" ? "#059669" : "transparent",
//             alignItems: "center",
//           }}
//         >
//           <Text style={{ fontWeight: "800", fontSize: 13, color: tab === "mycars" ? "#fff" : "#6B7280", letterSpacing: 1 }}>My Cars</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           onPress={() => setTab("retrievals")}
//           style={{
//             flex: 1,
//             paddingVertical: 10,
//             borderRadius: 16,
//             backgroundColor: tab === "retrievals" ? "#059669" : "transparent",
//             flexDirection: "row",
//             justifyContent: "center",
//             alignItems: "center",
//           }}
//         >
//           <Text style={{ fontWeight: "800", fontSize: 13, color: tab === "retrievals" ? "#fff" : "#6B7280", letterSpacing: 1 }}>Retrievals</Text>
//           {retrievalRequested > 0 && (
//             <View style={{ backgroundColor: "#F43F5E", borderRadius: 99, paddingHorizontal: 7, marginLeft: 6 }}>
//               <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>{retrievalRequested}</Text>
//             </View>
//           )}
//         </TouchableOpacity>
//       </View>

//       {pendingCount > 0 && (
//         <View
//           style={{
//             backgroundColor: "#FEF3C7",
//             paddingHorizontal: 14,
//             paddingVertical: 10,
//             marginHorizontal: 16,
//             marginTop: 12,
//             borderRadius: 14,
//             borderWidth: 1,
//             borderColor: "#F59E0B",
//             flexDirection: "row",
//             alignItems: "center",
//           }}
//         >
//           <Ionicons name="cloud-offline" size={16} color="#92400E" />
//           <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "700", marginLeft: 8 }}>
//             {pendingCount} photo(s) pending upload — will sync when online
//           </Text>
//         </View>
//       )}

//       <ScrollView
//         style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}
//         contentContainerStyle={{ paddingBottom: 100 }}
//         refreshControl={
//           <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" colors={["#059669"]} />
//         }
//       >
//         {tab === "mycars" && cars.length === 0 && (
//           <View style={{ alignItems: "center", marginTop: 60 }}>
//             <Text style={{ fontSize: 64 }}>🚗</Text>
//             <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 12 }}>No cars yet</Text>
//             <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Tap + to check in a vehicle</Text>
//           </View>
//         )}
//         {tab === "mycars" && cars.map((car) => (
//           <View
//             key={car.id}
//             style={{
//               backgroundColor: "#fff",
//               borderRadius: 24,
//               padding: 18,
//               marginBottom: 12,
//               borderLeftWidth: 4,
//               borderLeftColor: car.status === "PARKED" ? "#059669" : "#0EA5E9",
//               ...cardShadow,
//             }}
//           >
//             <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
//               <View style={{ flex: 1 }}>
//                 <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{car.plate}</Text>
//                 <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{car.color} {car.make}</Text>
//               </View>
//               <View
//                 style={{
//                   paddingHorizontal: 10,
//                   paddingVertical: 3,
//                   borderRadius: 99,
//                   backgroundColor: car.status === "PARKED" ? "#D1FAE5" : "#E0F2FE",
//                 }}
//               >
//                 <Text
//                   style={{
//                     fontSize: 10,
//                     fontWeight: "800",
//                     letterSpacing: 1,
//                     color: car.status === "PARKED" ? "#059669" : "#0284C7",
//                   }}
//                 >
//                   {car.status === "PARKED" ? "PARKED" : "CHECKED IN"}
//                 </Text>
//               </View>
//             </View>

//             {car.status === "PARKED" ? (
//               <View>
//                 <View
//                   style={{
//                     alignSelf: "flex-start",
//                     flexDirection: "row",
//                     alignItems: "center",
//                     backgroundColor: "#ECFDF5",
//                     paddingHorizontal: 10,
//                     paddingVertical: 6,
//                     borderRadius: 99,
//                     marginTop: 10,
//                   }}
//                 >
//                   <Ionicons name="location" size={13} color="#059669" />
//                   <Text style={{ color: "#059669", fontWeight: "800", fontSize: 12, marginLeft: 4 }}>
//                     Zone {car.zone} · Slot {car.slot}
//                   </Text>
//                 </View>
//                 <TouchableOpacity
//                   onPress={() => router.push({ pathname: "/(driver)/qr-display", params: { token: car.qr_token, plate: car.plate } })}
//                   style={{
//                     borderWidth: 1.5,
//                     borderColor: "#059669",
//                     borderRadius: 14,
//                     paddingVertical: 12,
//                     alignItems: "center",
//                     marginTop: 12,
//                     flexDirection: "row",
//                     justifyContent: "center",
//                   }}
//                 >
//                   <Ionicons name="qr-code-outline" size={16} color="#059669" />
//                   <Text style={{ color: "#059669", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1.5 }}>
//                     SHOW QR CODE
//                   </Text>
//                 </TouchableOpacity>
//               </View>
//             ) : (
//               <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
//                 <TouchableOpacity
//                   onPress={() => router.push({ pathname: "/(driver)/qr-display", params: { token: car.qr_token, plate: car.plate } })}
//                   style={{
//                     flex: 1,
//                     borderWidth: 1.5,
//                     borderColor: "#059669",
//                     borderRadius: 14,
//                     paddingVertical: 12,
//                     alignItems: "center",
//                     flexDirection: "row",
//                     justifyContent: "center",
//                   }}
//                 >
//                   <Ionicons name="qr-code-outline" size={14} color="#059669" />
//                   <Text style={{ color: "#059669", fontWeight: "900", fontSize: 11, marginLeft: 4, letterSpacing: 1 }}>QR CODE</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   onPress={() => openParkModal(car)}
//                   style={{
//                     flex: 1,
//                     backgroundColor: "#059669",
//                     borderRadius: 14,
//                     paddingVertical: 12,
//                     alignItems: "center",
//                     flexDirection: "row",
//                     justifyContent: "center",
//                   }}
//                 >
//                   <Ionicons name="location" size={14} color="#fff" />
//                   <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11, marginLeft: 4, letterSpacing: 1 }}>MARK PARKED</Text>
//                 </TouchableOpacity>
//               </View>
//             )}
//           </View>
//         ))}

//         {tab === "retrievals" && retrievals.length === 0 && (
//           <View style={{ alignItems: "center", marginTop: 60 }}>
//             <Text style={{ fontSize: 64 }}>🔔</Text>
//             <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 12 }}>No retrieval requests</Text>
//             <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>You're all caught up!</Text>
//           </View>
//         )}
//         {tab === "retrievals" && retrievals.map((car) => {
//           const isMine = car.retrieval_driver_id === resolvedDriverId;
//           let borderColor = "#9CA3AF";
//           if (car.status === "RETRIEVAL_REQUESTED") borderColor = "#F59E0B";
//           else if (car.status === "BEING_FETCHED" && isMine) borderColor = "#F97316";
//           return (
//             <View
//               key={car.id}
//               style={{
//                 backgroundColor: "#fff",
//                 borderRadius: 24,
//                 padding: 18,
//                 marginBottom: 12,
//                 borderLeftWidth: 4,
//                 borderLeftColor: borderColor,
//                 ...cardShadow,
//               }}
//             >
//               <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
//                 <View style={{ flex: 1 }}>
//                   <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{car.plate}</Text>
//                   <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{car.color} {car.make}</Text>
//                   <View
//                     style={{
//                       alignSelf: "flex-start",
//                       flexDirection: "row",
//                       alignItems: "center",
//                       backgroundColor: "#F3F4F6",
//                       paddingHorizontal: 8,
//                       paddingVertical: 3,
//                       borderRadius: 99,
//                       marginTop: 6,
//                     }}
//                   >
//                     <Ionicons name="location-outline" size={11} color="#6B7280" />
//                     <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "700", marginLeft: 4 }}>
//                       Zone {car.zone} · Slot {car.slot}
//                     </Text>
//                   </View>
//                 </View>
//                 <View
//                   style={{
//                     paddingHorizontal: 10,
//                     paddingVertical: 3,
//                     borderRadius: 99,
//                     backgroundColor: borderColor,
//                   }}
//                 >
//                   <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>
//                     {car.status === "RETRIEVAL_REQUESTED" ? "REQUESTED" : isMine ? "YOURS" : "OTHER"}
//                   </Text>
//                 </View>
//               </View>
//               {car.status === "RETRIEVAL_REQUESTED" && (
//                 <TouchableOpacity
//                   onPress={() => pickup(car)}
//                   style={{ backgroundColor: "#F59E0B", borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 12, flexDirection: "row", justifyContent: "center" }}
//                 >
//                   <Ionicons name="hand-right" size={14} color="#fff" />
//                   <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1.5 }}>PICK UP</Text>
//                 </TouchableOpacity>
//               )}
//               {car.status === "BEING_FETCHED" && isMine && (
//                 <TouchableOpacity
//                   onPress={() => handleHandover(car)}
//                   style={{ backgroundColor: "#059669", borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 12, flexDirection: "row", justifyContent: "center" }}
//                 >
//                   <Ionicons name="camera" size={14} color="#fff" />
//                   <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1.5 }}>HANDED TO GUEST</Text>
//                 </TouchableOpacity>
//               )}
//               {car.status === "BEING_FETCHED" && !isMine && (
//                 <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 10, fontStyle: "italic" }}>
//                   Being fetched by another driver
//                 </Text>
//               )}
//             </View>
//           );
//         })}
//         <View style={{ height: 40 }} />
//       </ScrollView>

//       <Modal visible={showParkModal} transparent animationType="slide">
//         <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
//           <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20, maxHeight: "85%" }}>
//             <View style={{ alignItems: "center", marginBottom: 12 }}>
//               <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
//             </View>
//             <Text style={{ fontSize: 11, fontWeight: "800", color: "#7C3AED", letterSpacing: 3 }}>PARK VEHICLE</Text>
//             <Text style={{ fontSize: 24, fontWeight: "900", color: "#111827", marginTop: 2 }}>{selectedCar?.plate}</Text>
//             {eventZones.length === 0 ? (
//               <View style={{ alignItems: "center", paddingVertical: 40 }}>
//                 <Ionicons name="map-outline" size={64} color="#9CA3AF" />
//                 <Text style={{ color: "#111827", fontWeight: "800", marginTop: 12 }}>No Parking Zones Configured</Text>
//                 <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>Please ask your admin to set up zones</Text>
//               </View>
//             ) : (
//               <>
//                 <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 2, marginTop: 18, marginBottom: 8 }}>SELECT ZONE</Text>
//                 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
//                   {eventZones.map((z) => {
//                     const zoneSlots = slots.filter((s) => s.zone_name === z.name);
//                     const free = zoneSlots.filter((s) => !s.is_occupied).length;
//                     const isFull = zoneSlots.length > 0 && free === 0;
//                     return (
//                       <TouchableOpacity
//                         key={z.name}
//                         onPress={() => { setSelectedZone(z.name); setSelectedSlot(null); }}
//                         style={{
//                           paddingHorizontal: 14,
//                           paddingVertical: 10,
//                           borderRadius: 99,
//                           backgroundColor: isFull ? "#F43F5E" : selectedZone === z.name ? "#7C3AED" : "#fff",
//                           borderWidth: 1,
//                           borderColor: isFull ? "#F43F5E" : selectedZone === z.name ? "#7C3AED" : "#E5E7EB",
//                         }}
//                       >
//                         <Text style={{ fontSize: 12, fontWeight: "800", color: isFull || selectedZone === z.name ? "#fff" : "#374151", letterSpacing: 0.5 }}>
//                           {z.name} — {isFull ? "FULL" : `${free} free`}
//                         </Text>
//                       </TouchableOpacity>
//                     );
//                   })}
//                 </ScrollView>
//                 <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 2, marginTop: 14, marginBottom: 8 }}>SELECT SLOT</Text>
//                 <FlatList
//                   data={slots.filter((s) => s.zone_name === selectedZone)}
//                   numColumns={5}
//                   keyExtractor={(item, idx) => `${item.zone_name}-${item.slot_number}-${idx}`}
//                   columnWrapperStyle={{ gap: 6, marginBottom: 6 }}
//                   renderItem={({ item }) => {
//                     const isSel = selectedSlot === item.slot_number;
//                     let bg = "#D1FAE5";
//                     if (item.is_occupied) bg = "#FECACA";
//                     else if (isSel) bg = "#7C3AED";
//                     return (
//                       <TouchableOpacity
//                         disabled={item.is_occupied}
//                         onPress={() => setSelectedSlot(item.slot_number)}
//                         style={{
//                           width: 56,
//                           height: 56,
//                           borderRadius: 14,
//                           backgroundColor: bg,
//                           alignItems: "center",
//                           justifyContent: "center",
//                         }}
//                       >
//                         {item.is_occupied ? (
//                           <Ionicons name="close" size={18} color="#991B1B" />
//                         ) : (
//                           <Text style={{ fontWeight: "900", color: isSel ? "#fff" : "#065F46" }}>
//                             {item.slot_number}
//                           </Text>
//                         )}
//                       </TouchableOpacity>
//                     );
//                   }}
//                   ListEmptyComponent={<Text style={{ color: "#9CA3AF", textAlign: "center", paddingVertical: 24 }}>No slots in this zone</Text>}
//                   style={{ maxHeight: 280 }}
//                 />
//                 <TouchableOpacity
//                   onPress={confirmPark}
//                   disabled={!selectedSlot}
//                   style={{
//                     borderRadius: 16,
//                     paddingVertical: 16,
//                     alignItems: "center",
//                     marginTop: 14,
//                     backgroundColor: selectedSlot ? "#7C3AED" : "#D1D5DB",
//                   }}
//                 >
//                   <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>CONFIRM PARKING</Text>
//                 </TouchableOpacity>
//               </>
//             )}
//             <TouchableOpacity onPress={() => setShowParkModal(false)} style={{ paddingVertical: 12, alignItems: "center", marginTop: 4 }}>
//               <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }


// // version 2
// import { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   Modal,
//   FlatList,
//   Alert,
//   RefreshControl,
//   ActivityIndicator,
//   Platform,
// } from "react-native";
// import { useRouter } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { SafeAreaView } from "react-native-safe-area-context";
// import * as ImagePicker from "expo-image-picker";
// import * as FileSystem from "expo-file-system";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import NetInfo from "@react-native-community/netinfo";
// import api from "../../lib/api";
// import { useAppStore } from "../../lib/store";
// import { connectWS, disconnectWS } from "../../lib/websocket";
// import { enqueueHandover, getQueueCount, processPendingQueue } from "../../lib/offline";

// const cardShadow = {
//   shadowColor: "#059669",
//   shadowOpacity: 0.08,
//   shadowRadius: 16,
//   shadowOffset: { width: 0, height: 4 },
//   elevation: 4,
// };

// export default function Tasks() {
//   const router = useRouter();
//   const { driver, currentEventId } = useAppStore();
//   const resolvedDriverId = driver?.id;
//   const [tab, setTab] = useState("mycars");
//   const [cars, setCars] = useState([]);
//   const [retrievals, setRetrievals] = useState([]);
//   const [showParkModal, setShowParkModal] = useState(false);
//   const [selectedCar, setSelectedCar] = useState(null);
//   const [eventZones, setEventZones] = useState([]);
//   const [slots, setSlots] = useState([]);
//   const [selectedZone, setSelectedZone] = useState("");
//   const [selectedSlot, setSelectedSlot] = useState(null);
//   const [pendingCount, setPendingCount] = useState(0);
//   const [openingParkModal, setOpeningParkModal] = useState(null); // stores car.id while loading
//   const [confirmingPark, setConfirmingPark] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);

//   const fetchMyCars = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/cars/event/${currentEventId}`);
//       setCars((data || []).filter((c) => c.check_in_driver_id === resolvedDriverId && ["CHECKED_IN", "PARKED"].includes(c.status)));
//     } catch {}
//   }, [currentEventId, resolvedDriverId]);

//   const fetchRetrievals = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/retrievals/event/${currentEventId}`);
//       setRetrievals(data || []);
//     } catch {}
//   }, [currentEventId]);

//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);
//     await Promise.all([fetchMyCars(), fetchRetrievals()]);
//     setRefreshing(false);
//   }, [fetchMyCars, fetchRetrievals]);

//   const refreshPending = async () => setPendingCount(await getQueueCount());

//   useEffect(() => {
//     if (!currentEventId) return;
//     fetchMyCars();
//     fetchRetrievals();
//     refreshPending();
//     connectWS(`/event/${currentEventId}`, (msg) => {
//       if (msg.type === "car_update") fetchMyCars();
//       if (msg.type === "slot_update") fetchSlots();
//     });
//     connectWS(`/retrievals/${currentEventId}`, (msg) => {
//       if (msg.type === "retrieval_update") fetchRetrievals();
//     });
//     const unsub = NetInfo.addEventListener(async (state) => {
//       if (state.isConnected) {
//         await processPendingQueue();
//         refreshPending();
//       }
//     });
//     return () => {
//       disconnectWS(`/event/${currentEventId}`);
//       disconnectWS(`/retrievals/${currentEventId}`);
//       unsub();
//     };
//   }, [currentEventId, fetchMyCars, fetchRetrievals]);

//   useEffect(() => {
//     (async () => {
//       const pending = await AsyncStorage.getItem("pending_handover");
//       if (pending) {
//         await AsyncStorage.removeItem("pending_handover");
//         const { carId } = JSON.parse(pending);
//         const car = retrievals.find((r) => r.id === carId);
//         if (car) handleHandover(car);
//       }
//     })();
//   }, [retrievals]);

//   const fetchSlots = async () => {
//     try {
//       const { data } = await api.get(`/slots/event/${currentEventId}`);
//       setSlots(data || []);
//     } catch {}
//   };

//   const openParkModal = async (car) => {
//     setOpeningParkModal(car.id);
//     setSelectedCar(car);
//     setSelectedSlot(null);
//     try {
//       const { data: ev } = await api.get(`/events/${currentEventId}`);
//       setEventZones(ev.zones || []);
//       if (ev.zones?.[0]) setSelectedZone(ev.zones[0].name);
//     } catch {}
//     try { await api.post(`/slots/event/${currentEventId}/initialize`); } catch {}
//     await fetchSlots();
//     setOpeningParkModal(null);
//     setShowParkModal(true);
//   };

//   const confirmPark = async () => {
//     setConfirmingPark(true);
//     try {
//       await api.patch(`/cars/${selectedCar.id}/park`, { zone: selectedZone, slot: selectedSlot, parked_driver_id: resolvedDriverId });
//       setShowParkModal(false);
//       fetchMyCars();
//     } catch (e) {
//       Alert.alert("Error", e.response?.data?.detail || "Failed");
//     } finally {
//       setConfirmingPark(false);
//     }
//   };

//   const pickup = async (car) => {
//     try {
//       await api.patch(`/cars/${car.id}/pickup`, { retrieval_driver_id: resolvedDriverId });
//       fetchRetrievals();
//     } catch (e) {
//       Alert.alert("Error", e.response?.data?.detail || "Failed");
//     }
//   };

//   const uploadHandoverInBackground = async (carId, uri) => {
//     try {
//       const formData = new FormData();
//       formData.append("file", { uri, type: "image/jpeg", name: "handover.jpg" });
//       formData.append("folder", `handover/${carId}`);
//       const up = await api.post("/upload", formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });
//       await api.patch(`/cars/${carId}/update-photo`, {
//         delivery_photo_url: up.data.url,
//       });
//     } catch {}
//   };

//   const handleHandover = async (car) => {
//     const perm = await ImagePicker.requestCameraPermissionsAsync();
//     if (!perm.granted) { Alert.alert("Camera permission needed"); return; }
//     try { await AsyncStorage.setItem("pending_handover", JSON.stringify({ carId: car.id })); } catch {}
//     const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
//     try { await AsyncStorage.removeItem("pending_handover"); } catch {}
//     if (result.canceled) return;
//     const net = await NetInfo.fetch();
//     if (!net.isConnected) {
//       const localPath = `${FileSystem.documentDirectory}handover_${car.id}_${Date.now()}.jpg`;
//       try {
//         await FileSystem.copyAsync({ from: result.assets[0].uri, to: localPath });
//         await enqueueHandover(car.id, localPath);
//         await refreshPending();
//         Alert.alert("Saved Offline", "Photo saved. Will upload when connected.");
//       } catch (e) { Alert.alert("Error", "Failed to save offline"); }
//       return;
//     }
//     try {
//       await api.patch(`/cars/${car.id}/deliver`, { delivery_photo_url: "" });
//       fetchRetrievals();
//       uploadHandoverInBackground(car.id, result.assets[0].uri);
//     } catch (e) {
//       Alert.alert("Error", e.response?.data?.detail || "Handover failed");
//     }
//   };

//   const retrievalRequested = retrievals.filter((c) => c.status === "RETRIEVAL_REQUESTED").length;

//   return (
//     <View style={{ flex: 1, backgroundColor: "#ECFDF5" }} testID="tasks-screen">
//       <SafeAreaView edges={["top"]} style={{ backgroundColor: "#059669" }}>
//         <View
//           style={{
//             backgroundColor: "#059669",
//             borderBottomLeftRadius: 44,
//             borderBottomRightRadius: 44,
//             paddingHorizontal: 20,
//             paddingTop: 8,
//             paddingBottom: 18,
//           }}
//         >
//           <View
//             style={{
//               position: "absolute",
//               top: 0,
//               left: 0,
//               right: 0,
//               bottom: 0,
//               backgroundColor: "rgba(8,145,178,0.5)",
//               borderBottomLeftRadius: 44,
//               borderBottomRightRadius: 44,
//             }}
//           />
//           <View style={{ flexDirection: "row", alignItems: "center" }}>
//             <TouchableOpacity
//               onPress={() => router.back()}
//               style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99, padding: 8 }}
//             >
//               <Ionicons name="chevron-back" size={22} color="#fff" />
//             </TouchableOpacity>
//             <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", flex: 1, textAlign: "center", marginRight: 40 }}>
//               My Tasks
//             </Text>
//             <TouchableOpacity
//               onPress={() => router.push("/(driver)/checkin")}
//               testID="add-checkin-btn"
//               style={{ backgroundColor: "#fff", borderRadius: 99, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
//             >
//               <Ionicons name="add" size={24} color="#059669" />
//             </TouchableOpacity>
//           </View>
//         </View>
//       </SafeAreaView>

//       {/* Tab pill */}
//       <View
//         style={{
//           flexDirection: "row",
//           backgroundColor: "#fff",
//           marginHorizontal: 16,
//           marginTop: -18,
//           borderRadius: 20,
//           padding: 4,
//           ...cardShadow,
//         }}
//       >
//         <TouchableOpacity
//           onPress={() => setTab("mycars")}
//           style={{
//             flex: 1,
//             paddingVertical: 10,
//             borderRadius: 16,
//             backgroundColor: tab === "mycars" ? "#059669" : "transparent",
//             alignItems: "center",
//           }}
//         >
//           <Text style={{ fontWeight: "800", fontSize: 13, color: tab === "mycars" ? "#fff" : "#6B7280", letterSpacing: 1 }}>My Cars</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           onPress={() => setTab("retrievals")}
//           style={{
//             flex: 1,
//             paddingVertical: 10,
//             borderRadius: 16,
//             backgroundColor: tab === "retrievals" ? "#059669" : "transparent",
//             flexDirection: "row",
//             justifyContent: "center",
//             alignItems: "center",
//           }}
//         >
//           <Text style={{ fontWeight: "800", fontSize: 13, color: tab === "retrievals" ? "#fff" : "#6B7280", letterSpacing: 1 }}>Retrievals</Text>
//           {retrievalRequested > 0 && (
//             <View style={{ backgroundColor: "#F43F5E", borderRadius: 99, paddingHorizontal: 7, marginLeft: 6 }}>
//               <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>{retrievalRequested}</Text>
//             </View>
//           )}
//         </TouchableOpacity>
//       </View>

//       {pendingCount > 0 && (
//         <View
//           style={{
//             backgroundColor: "#FEF3C7",
//             paddingHorizontal: 14,
//             paddingVertical: 10,
//             marginHorizontal: 16,
//             marginTop: 12,
//             borderRadius: 14,
//             borderWidth: 1,
//             borderColor: "#F59E0B",
//             flexDirection: "row",
//             alignItems: "center",
//           }}
//         >
//           <Ionicons name="cloud-offline" size={16} color="#92400E" />
//           <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "700", marginLeft: 8 }}>
//             {pendingCount} photo(s) pending upload — will sync when online
//           </Text>
//         </View>
//       )}

//       <ScrollView
//         style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}
//         contentContainerStyle={{ paddingBottom: 100 }}
//         refreshControl={
//           <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" colors={["#059669"]} />
//         }
//       >
//         {tab === "mycars" && cars.length === 0 && (
//           <View style={{ alignItems: "center", marginTop: 60 }}>
//             <Text style={{ fontSize: 64 }}>🚗</Text>
//             <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 12 }}>No cars yet</Text>
//             <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Tap + to check in a vehicle</Text>
//           </View>
//         )}
//         {tab === "mycars" && cars.map((car) => (
//           <View
//             key={car.id}
//             style={{
//               backgroundColor: "#fff",
//               borderRadius: 24,
//               padding: 18,
//               marginBottom: 12,
//               borderLeftWidth: 4,
//               borderLeftColor: car.status === "PARKED" ? "#059669" : "#0EA5E9",
//               ...cardShadow,
//             }}
//           >
//             <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
//               <View style={{ flex: 1 }}>
//                 <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{car.plate}</Text>
//                 <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{car.color} {car.make}</Text>
//               </View>
//               <View
//                 style={{
//                   paddingHorizontal: 10,
//                   paddingVertical: 3,
//                   borderRadius: 99,
//                   backgroundColor: car.status === "PARKED" ? "#D1FAE5" : "#E0F2FE",
//                 }}
//               >
//                 <Text
//                   style={{
//                     fontSize: 10,
//                     fontWeight: "800",
//                     letterSpacing: 1,
//                     color: car.status === "PARKED" ? "#059669" : "#0284C7",
//                   }}
//                 >
//                   {car.status === "PARKED" ? "PARKED" : "CHECKED IN"}
//                 </Text>
//               </View>
//             </View>

//             {car.status === "PARKED" ? (
//               <View>
//                 <View
//                   style={{
//                     alignSelf: "flex-start",
//                     flexDirection: "row",
//                     alignItems: "center",
//                     backgroundColor: "#ECFDF5",
//                     paddingHorizontal: 10,
//                     paddingVertical: 6,
//                     borderRadius: 99,
//                     marginTop: 10,
//                   }}
//                 >
//                   <Ionicons name="location" size={13} color="#059669" />
//                   <Text style={{ color: "#059669", fontWeight: "800", fontSize: 12, marginLeft: 4 }}>
//                     Zone {car.zone} · Slot {car.slot}
//                   </Text>
//                 </View>
//                 <TouchableOpacity
//                   onPress={() => router.push({ pathname: "/(driver)/qr-display", params: { token: car.qr_token, plate: car.plate } })}
//                   style={{
//                     borderWidth: 1.5,
//                     borderColor: "#059669",
//                     borderRadius: 14,
//                     paddingVertical: 12,
//                     alignItems: "center",
//                     marginTop: 12,
//                     flexDirection: "row",
//                     justifyContent: "center",
//                   }}
//                 >
//                   <Ionicons name="qr-code-outline" size={16} color="#059669" />
//                   <Text style={{ color: "#059669", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1.5 }}>
//                     SHOW QR CODE
//                   </Text>
//                 </TouchableOpacity>
//               </View>
//             ) : (
//               <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
//                 <TouchableOpacity
//                   onPress={() => router.push({ pathname: "/(driver)/qr-display", params: { token: car.qr_token, plate: car.plate } })}
//                   style={{
//                     flex: 1,
//                     borderWidth: 1.5,
//                     borderColor: "#059669",
//                     borderRadius: 14,
//                     paddingVertical: 12,
//                     alignItems: "center",
//                     flexDirection: "row",
//                     justifyContent: "center",
//                   }}
//                 >
//                   <Ionicons name="qr-code-outline" size={14} color="#059669" />
//                   <Text style={{ color: "#059669", fontWeight: "900", fontSize: 11, marginLeft: 4, letterSpacing: 1 }}>QR CODE</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   onPress={() => openParkModal(car)}
//                   disabled={openingParkModal === car.id}
//                   activeOpacity={0.7}
//                   style={{
//                     flex: 1,
//                     backgroundColor: openingParkModal === car.id ? "#047857" : "#059669",
//                     borderRadius: 14,
//                     paddingVertical: 12,
//                     alignItems: "center",
//                     flexDirection: "row",
//                     justifyContent: "center",
//                     opacity: openingParkModal === car.id ? 0.8 : 1,
//                   }}
//                 >
//                   {openingParkModal === car.id ? (
//                     <ActivityIndicator size="small" color="#fff" />
//                   ) : (
//                     <>
//                       <Ionicons name="location" size={14} color="#fff" />
//                       <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11, marginLeft: 4, letterSpacing: 1 }}>MARK PARKED</Text>
//                     </>
//                   )}
//                 </TouchableOpacity>
//               </View>
//             )}
//           </View>
//         ))}

//         {tab === "retrievals" && retrievals.length === 0 && (
//           <View style={{ alignItems: "center", marginTop: 60 }}>
//             <Text style={{ fontSize: 64 }}>🔔</Text>
//             <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 12 }}>No retrieval requests</Text>
//             <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>You're all caught up!</Text>
//           </View>
//         )}
//         {tab === "retrievals" && retrievals.map((car) => {
//           const isMine = car.retrieval_driver_id === resolvedDriverId;
//           let borderColor = "#9CA3AF";
//           if (car.status === "RETRIEVAL_REQUESTED") borderColor = "#F59E0B";
//           else if (car.status === "BEING_FETCHED" && isMine) borderColor = "#F97316";
//           return (
//             <View
//               key={car.id}
//               style={{
//                 backgroundColor: "#fff",
//                 borderRadius: 24,
//                 padding: 18,
//                 marginBottom: 12,
//                 borderLeftWidth: 4,
//                 borderLeftColor: borderColor,
//                 ...cardShadow,
//               }}
//             >
//               <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
//                 <View style={{ flex: 1 }}>
//                   <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{car.plate}</Text>
//                   <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{car.color} {car.make}</Text>
//                   <View
//                     style={{
//                       alignSelf: "flex-start",
//                       flexDirection: "row",
//                       alignItems: "center",
//                       backgroundColor: "#F3F4F6",
//                       paddingHorizontal: 8,
//                       paddingVertical: 3,
//                       borderRadius: 99,
//                       marginTop: 6,
//                     }}
//                   >
//                     <Ionicons name="location-outline" size={11} color="#6B7280" />
//                     <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "700", marginLeft: 4 }}>
//                       Zone {car.zone} · Slot {car.slot}
//                     </Text>
//                   </View>
//                 </View>
//                 <View
//                   style={{
//                     paddingHorizontal: 10,
//                     paddingVertical: 3,
//                     borderRadius: 99,
//                     backgroundColor: borderColor,
//                   }}
//                 >
//                   <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>
//                     {car.status === "RETRIEVAL_REQUESTED" ? "REQUESTED" : isMine ? "YOURS" : "OTHER"}
//                   </Text>
//                 </View>
//               </View>
//               {car.status === "RETRIEVAL_REQUESTED" && (
//                 <TouchableOpacity
//                   onPress={() => pickup(car)}
//                   style={{ backgroundColor: "#F59E0B", borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 12, flexDirection: "row", justifyContent: "center" }}
//                 >
//                   <Ionicons name="hand-right" size={14} color="#fff" />
//                   <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1.5 }}>PICK UP</Text>
//                 </TouchableOpacity>
//               )}
//               {car.status === "BEING_FETCHED" && isMine && (
//                 <TouchableOpacity
//                   onPress={() => handleHandover(car)}
//                   style={{ backgroundColor: "#059669", borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 12, flexDirection: "row", justifyContent: "center" }}
//                 >
//                   <Ionicons name="camera" size={14} color="#fff" />
//                   <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1.5 }}>HANDED TO GUEST</Text>
//                 </TouchableOpacity>
//               )}
//               {car.status === "BEING_FETCHED" && !isMine && (
//                 <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 10, fontStyle: "italic" }}>
//                   Being fetched by another driver
//                 </Text>
//               )}
//             </View>
//           );
//         })}
//         <View style={{ height: 40 }} />
//       </ScrollView>

//       <Modal visible={showParkModal} transparent animationType="slide">
//         <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
//           <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20, maxHeight: "85%" }}>
//             <View style={{ alignItems: "center", marginBottom: 12 }}>
//               <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
//             </View>
//             <Text style={{ fontSize: 11, fontWeight: "800", color: "#7C3AED", letterSpacing: 3 }}>PARK VEHICLE</Text>
//             <Text style={{ fontSize: 24, fontWeight: "900", color: "#111827", marginTop: 2 }}>{selectedCar?.plate}</Text>
//             {eventZones.length === 0 ? (
//               <View style={{ alignItems: "center", paddingVertical: 40 }}>
//                 <Ionicons name="map-outline" size={64} color="#9CA3AF" />
//                 <Text style={{ color: "#111827", fontWeight: "800", marginTop: 12 }}>No Parking Zones Configured</Text>
//                 <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>Please ask your admin to set up zones</Text>
//               </View>
//             ) : (
//               <>
//                 <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 2, marginTop: 18, marginBottom: 8 }}>SELECT ZONE</Text>
//                 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
//                   {eventZones.map((z) => {
//                     const zoneSlots = slots.filter((s) => s.zone_name === z.name);
//                     const free = zoneSlots.filter((s) => !s.is_occupied).length;
//                     const isFull = zoneSlots.length > 0 && free === 0;
//                     return (
//                       <TouchableOpacity
//                         key={z.name}
//                         onPress={() => { setSelectedZone(z.name); setSelectedSlot(null); }}
//                         style={{
//                           paddingHorizontal: 14,
//                           paddingVertical: 10,
//                           borderRadius: 99,
//                           backgroundColor: isFull ? "#F43F5E" : selectedZone === z.name ? "#7C3AED" : "#fff",
//                           borderWidth: 1,
//                           borderColor: isFull ? "#F43F5E" : selectedZone === z.name ? "#7C3AED" : "#E5E7EB",
//                         }}
//                       >
//                         <Text style={{ fontSize: 12, fontWeight: "800", color: isFull || selectedZone === z.name ? "#fff" : "#374151", letterSpacing: 0.5 }}>
//                           {z.name} — {isFull ? "FULL" : `${free} free`}
//                         </Text>
//                       </TouchableOpacity>
//                     );
//                   })}
//                 </ScrollView>
//                 <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 2, marginTop: 14, marginBottom: 8 }}>SELECT SLOT</Text>
//                 <FlatList
//                   data={slots.filter((s) => s.zone_name === selectedZone)}
//                   numColumns={5}
//                   keyExtractor={(item, idx) => `${item.zone_name}-${item.slot_number}-${idx}`}
//                   columnWrapperStyle={{ gap: 6, marginBottom: 6 }}
//                   renderItem={({ item }) => {
//                     const isSel = selectedSlot === item.slot_number;
//                     let bg = "#D1FAE5";
//                     if (item.is_occupied) bg = "#FECACA";
//                     else if (isSel) bg = "#7C3AED";
//                     return (
//                       <TouchableOpacity
//                         disabled={item.is_occupied}
//                         onPress={() => setSelectedSlot(item.slot_number)}
//                         style={{
//                           width: 56,
//                           height: 56,
//                           borderRadius: 14,
//                           backgroundColor: bg,
//                           alignItems: "center",
//                           justifyContent: "center",
//                         }}
//                       >
//                         {item.is_occupied ? (
//                           <Ionicons name="close" size={18} color="#991B1B" />
//                         ) : (
//                           <Text style={{ fontWeight: "900", color: isSel ? "#fff" : "#065F46" }}>
//                             {item.slot_number}
//                           </Text>
//                         )}
//                       </TouchableOpacity>
//                     );
//                   }}
//                   ListEmptyComponent={<Text style={{ color: "#9CA3AF", textAlign: "center", paddingVertical: 24 }}>No slots in this zone</Text>}
//                   style={{ maxHeight: 280 }}
//                 />
//                 <TouchableOpacity
//                   onPress={confirmPark}
//                   disabled={!selectedSlot || confirmingPark}
//                   activeOpacity={0.7}
//                   style={{
//                     borderRadius: 16,
//                     paddingVertical: 16,
//                     alignItems: "center",
//                     marginTop: 14,
//                     backgroundColor: selectedSlot && !confirmingPark ? "#7C3AED" : "#D1D5DB",
//                   }}
//                 >
//                   {confirmingPark ? (
//                     <ActivityIndicator color="#fff" />
//                   ) : (
//                     <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>CONFIRM PARKING</Text>
//                   )}
//                 </TouchableOpacity>
//               </>
//             )}
//             <TouchableOpacity onPress={() => setShowParkModal(false)} style={{ paddingVertical: 12, alignItems: "center", marginTop: 4 }}>
//               <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }