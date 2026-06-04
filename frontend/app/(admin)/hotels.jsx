import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

const ACCENT_COLOR = "#1D4ED8";

const cardShadow = {
  shadowColor: ACCENT_COLOR,
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export default function Hotels() {
  const router = useRouter();
  const { action } = useLocalSearchParams();
  const { user, setCurrentEventId } = useAppStore();
  const [hotels, setHotels] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (action === "add_special") {
      Alert.alert("Add Special Event", "Please select a hotel from the list to create a special event for it.");
    }
  }, [action]);

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [totalSlots, setTotalSlots] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const isHotelOwner = user?.provider_type === "hotel_owner";
  const isValetProvider = !isHotelOwner;

  const fetchHotels = useCallback(async () => {
    try {
      const [{ data: hotelsData }, { data: eventsData }] = await Promise.all([
        api.get("/hotels"),
        api.get("/events")
      ]);
      setHotels(hotelsData || []);
      setAllEvents(eventsData || []);
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHotels();
  }, [fetchHotels]);

  const resetForm = () => {
    setName("");
    setAddress("");
    setCity("");
    setState("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setTotalSlots("");
    setStartTime("09:00");
    setEndTime("18:00");
  };

  const saveHotel = async () => {
    if (!name || !address || !city || !state || !contactName || !contactPhone || !totalSlots) {
      Alert.alert("Required Fields", "Please fill all required fields");
      return;
    }

    setSaving(true);
    try {
      await api.post("/hotels", {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        contact_person_name: contactName.trim(),
        contact_person_phone: contactPhone.trim(),
        contact_person_email: contactEmail.trim() || undefined,
        total_valet_slots: parseInt(totalSlots),
        operating_hours_start: startTime,
        operating_hours_end: endTime,
      });
      setShowModal(false);
      resetForm();
      fetchHotels();
      Alert.alert("Success", "Hotel added successfully");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to add hotel");
    } finally {
      setSaving(false);
    }
  };

  const filteredHotels = hotels
    .filter(
      (h) =>
        h.name?.toLowerCase().includes(search.toLowerCase()) ||
        h.city?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      // Show "Active Today" at top
      if (a.is_active_today && !b.is_active_today) return -1;
      if (!a.is_active_today && b.is_active_today) return 1;
      return a.name.localeCompare(b.name);
    });

  const openHotel = (hotel) => {
    if (hotel.today_event_id) {
      setCurrentEventId(hotel.today_event_id);
    }
    router.push({ pathname: "/(admin)/hotel-detail", params: { hid: hotel.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: ACCENT_COLOR }}>
        <View
          style={{
            backgroundColor: ACCENT_COLOR,
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
              backgroundColor: "rgba(255,255,255,0.1)",
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
              Hotels
            </Text>
            <View style={{ backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{hotels.length}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 2,
          }}
        >
          <Ionicons name="search-outline" size={18} color={ACCENT_COLOR} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or city"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 10, paddingVertical: 12, fontSize: 14, color: "#111827" }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        {loading && <ActivityIndicator color={ACCENT_COLOR} />}
        {filteredHotels.map((h) => {
          const today = new Date().toISOString().split("T")[0];
          const todayEvent = allEvents.find(e => e.hotel_id === h.id && e.date === today);

          return (
            <TouchableOpacity
              key={h.id}
              onPress={() => openHotel(h)}
              activeOpacity={0.85}
              style={{
                backgroundColor: "#fff",
                borderRadius: 24,
                padding: 16,
                marginBottom: 12,
                ...cardShadow,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: 17 }}>{h.name}</Text>
                  <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>{h.city}, {h.state}</Text>
                </View>
                <View style={{ backgroundColor: h.is_active ? "#D1FAE5" : "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                  <Text style={{ color: h.is_active ? "#059669" : "#6B7280", fontWeight: "800", fontSize: 10 }}>
                    {h.is_active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, gap: 10 }}>
                <View style={{ backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="time-outline" size={12} color={ACCENT_COLOR} />
                  <Text style={{ color: ACCENT_COLOR, fontSize: 11, fontWeight: "700", marginLeft: 4 }}>
                    {h.operating_hours_start} — {h.operating_hours_end}
                  </Text>
                </View>
                <View style={{ backgroundColor: todayEvent?.status === "active" ? "#D1FAE5" : "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: todayEvent?.status === "active" ? "#059669" : "#9CA3AF", marginRight: 6 }} />
                  <Text style={{ color: todayEvent?.status === "active" ? "#059669" : "#6B7280", fontSize: 11, fontWeight: "700" }}>
                    {todayEvent ? (todayEvent.status === "active" ? "Active Today" : "Closed Today") : "No Event Today"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {!loading && filteredHotels.length === 0 && (
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 64 }}>🏢</Text>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 8 }}>No hotels found</Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>
              {search ? "Try a different search" : "Tap + to add your first hotel"}
            </Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      {isValetProvider && (
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          activeOpacity={0.85}
          style={{
            position: "absolute",
            bottom: 28,
            right: 24,
            width: 60,
            height: 60,
            borderRadius: 99,
            backgroundColor: ACCENT_COLOR,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: ACCENT_COLOR,
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add Hotel Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, maxHeight: "90%" }}>
              <View style={{ alignItems: "center", marginBottom: 16 }}>
                <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
              </View>
              
              <Text style={{ fontSize: 22, fontWeight: "900", color: ACCENT_COLOR, marginBottom: 20 }}>Add New Hotel</Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={modalLabel}>HOTEL NAME</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Hotel Grand" style={modalInput} />

                <Text style={modalLabel}>ADDRESS</Text>
                <TextInput value={address} onChangeText={setAddress} placeholder="123 Main St" style={modalInput} />

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={modalLabel}>CITY</Text>
                    <TextInput value={city} onChangeText={setCity} placeholder="Mumbai" style={modalInput} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={modalLabel}>STATE</Text>
                    <TextInput value={state} onChangeText={setState} placeholder="MH" style={modalInput} />
                  </View>
                </View>

                <Text style={modalLabel}>CONTACT PERSON NAME</Text>
                <TextInput value={contactName} onChangeText={setContactName} placeholder="John Doe" style={modalInput} />

                <Text style={modalLabel}>CONTACT PHONE</Text>
                <TextInput value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" placeholder="+91..." style={modalInput} />

                <Text style={modalLabel}>CONTACT EMAIL (OPTIONAL)</Text>
                <TextInput value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" placeholder="john@hotel.com" style={modalInput} />

                <Text style={modalLabel}>TOTAL VALET SLOTS</Text>
                <TextInput value={totalSlots} onChangeText={setTotalSlots} keyboardType="numeric" placeholder="50" style={modalInput} />

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={modalLabel}>OPERATING START</Text>
                    <TextInput value={startTime} onChangeText={setStartTime} placeholder="09:00" style={modalInput} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={modalLabel}>OPERATING END</Text>
                    <TextInput value={endTime} onChangeText={setEndTime} placeholder="18:00" style={modalInput} />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={saveHotel}
                  disabled={saving}
                  style={{ backgroundColor: ACCENT_COLOR, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 12, marginBottom: 8 }}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>SAVE HOTEL</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowModal(false)} style={{ paddingVertical: 12, alignItems: "center" }}>
                  <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const modalLabel = {
  fontSize: 10,
  fontWeight: "800",
  color: "#9CA3AF",
  letterSpacing: 1.5,
  marginBottom: 6,
  marginTop: 12,
};

const modalInput = {
  backgroundColor: "#F9FAF8",
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 15,
  color: "#111827",
  borderWidth: 1,
  borderColor: "#E5E7EB",
};
