import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

function Lbl({ children }) {
  return <Text className="text-xs font-bold text-gray-500 tracking-widest mb-2">{children}</Text>;
}

const validatePlate = (plate) => {
  const cleaned = plate.replace(/[-\s]/g, "").toUpperCase();
  const standard = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(cleaned);
  const bharat = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(cleaned);
  return standard || bharat;
};

export default function CheckIn() {
  const router = useRouter();
  const { driver, currentEventId } = useAppStore();
  const resolvedDriverId = driver?.id;
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [make, setMake] = useState("");
  const [notes, setNotes] = useState("");
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
          setPlate(d.plate || ""); setColor(d.color || ""); setMake(d.make || "");
          setNotes(d.notes || ""); setSelectedGate(d.selectedGate || "");
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
      await AsyncStorage.setItem("checkin_draft", JSON.stringify({ plate, color, make, notes, selectedGate }));
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

  const submit = async () => {
    if (!plate.trim()) { Alert.alert("Required", "License plate is required"); return; }
    if (!validatePlate(plate.trim())) {
      Alert.alert("Invalid Plate", "Please enter a valid Indian vehicle number plate.\n\nExamples:\nGJ01AB1234\nMH12CD5678\n22BH1234AA");
      return;
    }
    if (!color.trim()) { Alert.alert("Required", "Vehicle color is required"); return; }
    if (!make.trim()) { Alert.alert("Required", "Vehicle make/model is required"); return; }
    if (photos.length === 0) { Alert.alert("Required", "Take at least one photo"); return; }
    setSubmitting(true);
    try {
      const { data: car } = await api.post("/cars", {
        plate: plate.trim().toUpperCase(),
        color: color.trim(), make: make.trim(), notes: notes.trim(),
        gate: selectedGate || "", event_id: currentEventId,
        check_in_driver_id: resolvedDriverId,
      });
      const urls = [];
      for (const uri of photos) {
        const fd = new FormData();
        fd.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
        fd.append("folder", `checkin/${car.id}`);
        const up = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        urls.push(up.data.url);
      }
      await api.post(`/cars/${car.id}/photos`, { urls, type: "checkin" });
      try { await api.post(`/slots/event/${currentEventId}/initialize`); } catch {}
      try { await AsyncStorage.removeItem("checkin_photos"); } catch {}
      router.replace({ pathname: "/(driver)/qr-display", params: { token: car.qr_token, plate: car.plate } });
    } catch (err) {
      const msg = err.response?.data?.detail || "Check-in failed";
      if (typeof msg === "string" && msg.includes("full")) Alert.alert("Event Full", "No more cars can be checked in.");
      else if (typeof msg === "string" && msg.includes("Duplicate")) Alert.alert("Duplicate", "Plate already checked in.");
      else Alert.alert("Error", typeof msg === "string" ? msg : "Failed");
    } finally { setSubmitting(false); }
  };

  return (
    <View className="flex-1 bg-[#F9FAFB]" testID="checkin-screen">
      <SafeAreaView edges={["top"]} className="bg-[#059669]">
        <View className="bg-[#059669] px-5 py-4 rounded-b-[30px] flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="bg-white/10 rounded-full p-2 mr-3">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black flex-1">Check In Vehicle</Text>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
          <Lbl>LICENSE PLATE *</Lbl>
          <View className="bg-white rounded-2xl px-4 border border-gray-200 mb-3">
            <TextInput testID="plate-input" value={plate} onChangeText={(v) => setPlate(v.replace(/[^A-Za-z0-9-]/g, "").toUpperCase())} placeholder="GJ01AB1234" autoCapitalize="characters" maxLength={13} className="py-3 text-base" />
          </View>
          <Lbl>COLOR</Lbl>
          <View className="bg-white rounded-2xl px-4 border border-gray-200 mb-3">
            <TextInput value={color} onChangeText={setColor} placeholder="Black" className="py-3 text-base" />
          </View>
          <Lbl>MAKE / MODEL</Lbl>
          <View className="bg-white rounded-2xl px-4 border border-gray-200 mb-3">
            <TextInput value={make} onChangeText={setMake} placeholder="Honda Civic" className="py-3 text-base" />
          </View>
          <Lbl>NOTES</Lbl>
          <View className="bg-white rounded-2xl px-4 border border-gray-200 mb-3">
            <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Existing damage, special notes..." className="py-3 text-base" style={{ minHeight: 60 }} />
          </View>

          {eventGates.length > 0 && (
            <>
              <Lbl>ENTRY GATE</Lbl>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-3">
                {eventGates.map((g) => (
                  <TouchableOpacity key={g} onPress={() => setSelectedGate(g)} className={`px-4 py-2 rounded-full ${selectedGate === g ? "bg-[#059669]" : "bg-white border border-[#059669]"}`}>
                    <Text className={`text-xs font-bold ${selectedGate === g ? "text-white" : "text-[#059669]"}`}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Lbl>VEHICLE PHOTOS * (min 1, max 5)</Lbl>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {photos.map((u, i) => (
              <View key={i} style={{ width: 80, height: 80 }}>
                <Image source={{ uri: u }} style={{ width: 80, height: 80, borderRadius: 12 }} />
                <TouchableOpacity onPress={() => setPhotos(photos.filter((_, k) => k !== i))} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1">
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity onPress={takePhoto} testID="add-photo-btn" className="bg-white items-center justify-center" style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: "#D1D5DB", borderStyle: "dashed" }}>
                <Ionicons name="camera-outline" size={24} color="#059669" />
                <Text className="text-xs text-[#059669] mt-1">Add</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={submit} disabled={submitting} testID="submit-checkin" className="bg-[#059669] rounded-2xl py-4 items-center mb-10">
            {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black tracking-widest">CHECK IN VEHICLE</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
