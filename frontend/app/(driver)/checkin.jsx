import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

const validatePlate = (plate) => {
  const cleaned = plate.replace(/[-\s]/g, "").toUpperCase();
  const standard = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(cleaned);
  const bharat = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(cleaned);
  return standard || bharat;
};

function Lbl({ children }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 3, marginBottom: 8, marginTop: 4 }}>
      {children}
    </Text>
  );
}

export default function CheckIn() {
  const router = useRouter();
  const { driver, currentEventId } = useAppStore();
  const resolvedDriverId = driver?.id;
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [make, setMake] = useState("");
  const [notes, setNotes] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [eventGates, setEventGates] = useState([]);
  const [selectedGate, setSelectedGate] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/events/${currentEventId}`);
        setEventGates(data.gates || []);
        if (data.gates?.[0]) setSelectedGate(data.gates[0]);
      } catch {}
      try {
        const draft = await AsyncStorage.getItem("checkin_draft");
        const savedPhotos = await AsyncStorage.getItem("checkin_photos");
        if (draft) {
          const d = JSON.parse(draft);
          setPlate(d.plate || "");
          setColor(d.color || "");
          setMake(d.make || "");
          setNotes(d.notes || "");
          setGuestPhone(d.guestPhone || "");
          setSelectedGate(d.selectedGate || "");
        }
        if (savedPhotos) setPhotos(JSON.parse(savedPhotos));
      } catch {}
    })();
  }, [currentEventId]);

  const takePhoto = async () => {
    if (photos.length >= 5) { Alert.alert("Max 5 photos"); return; }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera permission needed"); return; }
    try {
      await AsyncStorage.setItem("checkin_draft", JSON.stringify({ plate, color, make, notes, guestPhone, selectedGate }));
      await AsyncStorage.setItem("checkin_photos", JSON.stringify(photos));
    } catch {}
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled) {
      const np = [...photos, result.assets[0].uri];
      setPhotos(np);
      try { await AsyncStorage.setItem("checkin_photos", JSON.stringify(np)); } catch {}
    }
    try { await AsyncStorage.removeItem("checkin_draft"); } catch {}
  };

  const uploadPhotosInBackground = async (carId, photoUris) => {
    try {
      const urls = [];
      for (const uri of photoUris) {
        try {
          const fd = new FormData();
          fd.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
          fd.append("folder", `checkin/${carId}`);
          const up = await api.post("/upload", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          urls.push(up.data.url);
        } catch {}
      }
      if (urls.length > 0) {
        await api.post(`/cars/${carId}/photos`, { urls, type: "checkin" });
      }
    } catch {}
  };

  const submit = async () => {
    if (!plate.trim()) { Alert.alert("Required", "License plate is required"); return; }
    if (!validatePlate(plate.trim())) {
      Alert.alert("Invalid Plate", "Please enter a valid Indian vehicle number plate.\n\nExamples:\nGJ01AB1234\nMH12CD5678\n22BH1234AA");
      return;
    }
    if (!color.trim()) { Alert.alert("Required", "Vehicle color is required"); return; }
    if (!make.trim()) { Alert.alert("Required", "Vehicle make/model is required"); return; }
    if (guestPhone.trim() && !/^\d{10}$/.test(guestPhone.trim())) {
      Alert.alert("Invalid Phone", "Guest mobile number must be exactly 10 digits.");
      return;
    }
    if (photos.length === 0) { Alert.alert("Required", "Take at least one photo"); return; }
    setSubmitting(true);
    try {
      const { data: car } = await api.post("/cars", {
        plate: plate.trim().toUpperCase(),
        color: color.trim(),
        make: make.trim(),
        notes: notes.trim(),
        gate: selectedGate || "",
        event_id: currentEventId,
        check_in_driver_id: resolvedDriverId,
        ...(guestPhone.trim() ? { guest_phone: guestPhone.trim() } : {}),
      });
      if (car.warning) {
        await new Promise((resolve) => {
          Alert.alert(
            "⚠️ Almost Full",
            "This event is almost at capacity. The car has been checked in.",
            [{ text: "OK", onPress: resolve }]
          );
        });
      }
      try {
        await api.post(`/slots/event/${currentEventId}/initialize`);
      } catch {}
      try { await AsyncStorage.removeItem("checkin_photos"); } catch {}
      router.replace({
        pathname: "/(driver)/qr-display",
        params: {
          token: car.qr_token,
          plate: car.plate,
          carId: car.id,
          ...(guestPhone.trim() ? { guestPhone: guestPhone.trim() } : {}),
        },
      });
      uploadPhotosInBackground(car.id, photos);
    } catch (err) {
      const msg = err.response?.data?.detail || "Check-in failed";
      if (typeof msg === "string" && msg.includes("full")) Alert.alert("Event Full", "No more cars can be checked in.");
      else if (typeof msg === "string" && msg.includes("Duplicate")) Alert.alert("Duplicate", "Plate already checked in.");
      else Alert.alert("Error", typeof msg === "string" ? msg : "Failed");
    } finally { setSubmitting(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#ECFDF5" }} testID="checkin-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#059669" }}>
        <View
          style={{
            backgroundColor: "#059669",
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
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 12, flex: 1 }}>
              Check In Vehicle
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 20, paddingTop: 18 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <Lbl>LICENSE PLATE *</Lbl>
          <View style={inputRow}>
            <Ionicons name="car-outline" size={20} color="#059669" />
            <TextInput
              testID="plate-input"
              value={plate}
              onChangeText={(v) => setPlate(v.replace(/[^A-Za-z0-9-]/g, "").toUpperCase())}
              placeholder="GJ01AB1234"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              maxLength={13}
              style={textInput}
            />
          </View>
          <Lbl>COLOR</Lbl>
          <View style={inputRow}>
            <Ionicons name="color-palette-outline" size={20} color="#059669" />
            <TextInput value={color} onChangeText={setColor} placeholder="Black" placeholderTextColor="#9CA3AF" style={textInput} />
          </View>
          <Lbl>MAKE / MODEL</Lbl>
          <View style={inputRow}>
            <Ionicons name="construct-outline" size={20} color="#059669" />
            <TextInput value={make} onChangeText={setMake} placeholder="Honda Civic" placeholderTextColor="#9CA3AF" style={textInput} />
          </View>
          <Lbl>NOTES</Lbl>
          <View style={[inputRow, { alignItems: "flex-start", paddingTop: 12 }]}>
            <Ionicons name="document-text-outline" size={20} color="#059669" />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Existing damage, special notes..."
              placeholderTextColor="#9CA3AF"
              style={[textInput, { minHeight: 60, textAlignVertical: "top" }]}
            />
          </View>
          <Lbl>GUEST MOBILE (OPTIONAL)</Lbl>
          <View style={inputRow}>
            <Ionicons name="phone-portrait-outline" size={20} color="#059669" />
            <TextInput
              value={guestPhone}
              onChangeText={setGuestPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              style={textInput}
            />
          </View>

          {eventGates.length > 0 && (
            <>
              <Lbl>ENTRY GATE</Lbl>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ marginBottom: 12 }}>
                {eventGates.map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setSelectedGate(g)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 99,
                      backgroundColor: selectedGate === g ? "#059669" : "#fff",
                      borderWidth: 1,
                      borderColor: "#059669",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: selectedGate === g ? "#fff" : "#059669", letterSpacing: 0.5 }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Lbl>VEHICLE PHOTOS * (MIN 1, MAX 5)</Lbl>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            {photos.map((u, i) => (
              <View key={i} style={{ width: 80, height: 80 }}>
                <Image source={{ uri: u }} style={{ width: 80, height: 80, borderRadius: 16 }} />
                <TouchableOpacity
                  onPress={() => setPhotos(photos.filter((_, k) => k !== i))}
                  style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#F43F5E", borderRadius: 99, padding: 4 }}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity
                onPress={takePhoto}
                testID="add-photo-btn"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: "#059669",
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fff",
                }}
              >
                <Ionicons name="camera-outline" size={24} color="#059669" />
                <Text style={{ fontSize: 10, color: "#059669", marginTop: 2, fontWeight: "800" }}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={submit}
            disabled={submitting}
            testID="submit-checkin"
            style={{
              backgroundColor: "#059669",
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: "center",
              marginBottom: 16,
              shadowColor: "#059669",
              shadowOpacity: 0.3,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 2 }}>CHECK IN VEHICLE</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const inputRow = {
  backgroundColor: "#fff",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 14,
  marginBottom: 16,
};
const textInput = {
  flex: 1,
  paddingVertical: 14,
  marginLeft: 10,
  fontSize: 15,
  color: "#111827",
};
