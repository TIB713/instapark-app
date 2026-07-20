import { useEffect, useState, useCallback } from "react";
import { rs, rp } from '../../utils/responsive';
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
import DateTimePicker from "@react-native-community/datetimepicker";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import CityStatePicker from "../../components/CityStatePicker";
import { State } from "country-state-city";

const ACCENT_COLOR = "#1D4ED8";

const cardShadow = {
  shadowColor: ACCENT_COLOR,
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
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
  const [showAddModal, setShowAddModal] = useState(false);
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
  const [gateTimerMinutes, setGateTimerMinutes] = useState("5");
  const [errors, setErrors] = useState({});

  const [zones, setZones] = useState([{ name: "A", slots: "" }]);
  const [gates, setGates] = useState(["Main Gate"]);

  const isHotelOwner = user?.provider_type === "hotel_owner";
  const isValetProvider = !isHotelOwner;

  const fmtTime = (d) => {
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

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

  // Auto-update single zone's slots when totalSlots changes
  useEffect(() => {
    if (zones.length === 1 && totalSlots) {
      setZones([{ ...zones[0], slots: totalSlots }]);
    }
  }, [totalSlots]);

  const resetForm = () => {
    setName("");
    setAddress("");
    setCity("");
    setState("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setTotalSlots("");
    setGateTimerMinutes("5");

    setZones([{ name: "A", slots: "" }]);
    setGates(["Main Gate"]);
    setKeyHookStart("1");
    setKeyHookEnd("50");
    setErrors({});
  };

  const saveHotel = async () => {
    const errs = {};
    if (!name.trim()) errs.name = "Hotel name is required";
    if (!address.trim()) errs.address = "Address is required";
    if (!city) errs.city = "City is required";
    if (!state) errs.state = "State is required";
    if (!contactName.trim()) errs.contactName = "Contact name is required";
    if (!contactPhone.trim()) errs.contactPhone = "Contact phone is required";
    else if (!/^\d{10}$/.test(contactPhone.trim().replace(/\D/g, ""))) errs.contactPhone = "Please enter a valid 10-digit contact phone number";
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) errs.contactEmail = "Please enter a valid contact email address";
    if (!totalSlots) errs.totalSlots = "Total valet slots is required";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const stateFullName = State.getStatesOfCountry("IN").find(s => s.isoCode === state.trim())?.name || state.trim();
      await api.post("/hotels", {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: stateFullName,
        contact_person_name: contactName.trim(),
        contact_person_phone: contactPhone.trim(),
        contact_person_email: contactEmail.trim() || undefined,
        total_valet_slots: parseInt(totalSlots),
        gate_timer_minutes: parseInt(gateTimerMinutes) || 5,

        provider_id: user?.provider_id,
        zones: zones.map(z => ({ name: z.name.trim(), slots: parseInt(z.slots) || 0 })).filter(z => z.name),
        gates: gates.filter(g => g.trim()),
      });
      setShowAddModal(false);
      resetForm();
      fetchHotels();
      Alert.alert("Success", "Hotel added successfully");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to add hotel");
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const hotelsWithStatus = hotels.map(h => ({
    ...h,
    is_active_today: allEvents.some(e => e.hotel_id === h.id && e.date === today && e.status === "active")
  }));

  const filteredHotels = hotelsWithStatus
    .filter(h =>
      h.name?.toLowerCase().includes(search.toLowerCase()) ||
      h.city?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
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
                  borderBottomLeftRadius: rp(44),
                  borderBottomRightRadius: rp(44),
                  paddingHorizontal: rp(20),
                  paddingTop: rp(8),
                  paddingBottom: rp(24),
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
                  borderBottomLeftRadius: rp(44),
                  borderBottomRightRadius: rp(44),
                }}
              />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8) }}
            >
              <Ionicons name="chevron-back" size={rs(22)} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(12), flex: 1 }}>
              Hotels
            </Text>
            <View style={{ backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(99) }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: rs(12) }}>{hotels.length}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ paddingHorizontal: rp(20), paddingVertical: rp(12) }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: rp(16),
            borderWidth: rp(1),
            borderColor: "#E5E7EB",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: rp(14),
            paddingVertical: rp(2),
          }}
        >
          <Ionicons name="search-outline" size={rs(18)} color={ACCENT_COLOR} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or city"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(12), fontSize: rs(14), color: "#111827" }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={rs(18)} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}>
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
                borderRadius: rp(24),
                padding: rp(16),
                marginBottom: rp(12),
                ...cardShadow,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(17) }}>{h.name}</Text>
                  <Text style={{ color: "#6B7280", fontSize: rs(13), marginTop: rp(2) }}>{h.city}, {h.state}</Text>
                </View>
                <View style={{ backgroundColor: h.is_active ? "#D1FAE5" : "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                  <Text style={{ color: h.is_active ? "#059669" : "#6B7280", fontWeight: "800", fontSize: rs(10) }}>
                    {h.is_active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(12), gap: rp(10) }}>
                <View style={{ backgroundColor: todayEvent?.status === "active" ? "#D1FAE5" : "#F3F4F6", paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(99), flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: rp(6), height: rp(6), borderRadius: rp(3), backgroundColor: todayEvent?.status === "active" ? "#059669" : "#9CA3AF", marginRight: rp(6) }} />
                  <Text style={{ color: todayEvent?.status === "active" ? "#059669" : "#6B7280", fontSize: rs(11), fontWeight: "700" }}>
                    {todayEvent ? (todayEvent.status === "active" ? "Active Today" : "Closed Today") : "No Event Today"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {!loading && filteredHotels.length === 0 && (
          <View style={{ alignItems: "center", marginTop: rp(80) }}>
            <Text style={{ fontSize: rs(64) }}>🏢</Text>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: rs(16), marginTop: rp(8) }}>No hotels found</Text>
            <Text style={{ color: "#6B7280", fontSize: rs(13), marginTop: rp(4) }}>
              {search ? "Try a different search" : "Tap + to add your first hotel"}
            </Text>
          </View>
        )}
        <View style={{ height: rp(100) }} />
      </ScrollView>

      {isValetProvider && (
        <TouchableOpacity
          style={{
            position: "absolute",
            bottom: rp(24),
            right: rp(24),
            width: rp(56),
            height: rp(56),
            borderRadius: rp(28),
            backgroundColor: "#7C3AED",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#7C3AED",
            shadowOffset: { width: 0, height: rp(4) },
            shadowOpacity: 0.4,
            shadowRadius: rp(8),
            elevation: 8,
          }}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={rs(28)} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        onRequestClose={() => { setShowAddModal(false); setErrors({}); resetForm(); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View
              style={{
                backgroundColor: ACCENT_COLOR,
                paddingHorizontal: rp(20),
                paddingTop: rp(16),
                paddingBottom: rp(20),
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <TouchableOpacity onPress={() => { setShowAddModal(false); setErrors({}); resetForm(); }} style={{ padding: rp(8), marginLeft: -rp(8) }}>
                <Ionicons name="close" size={rs(24)} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(12) }}>Add Hotel</Text>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: rp(20), paddingTop: rp(16) }}>
              <Text style={modalLabel}>HOTEL NAME *</Text>
              <TextInput
                style={[modalInput, errors.name && modalInputError]}
                placeholder="Enter hotel name"
                value={name}
                onChangeText={(t) => { setName(t); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })); }}
              />
              {errors.name && <Text style={modalErrorText}>* {errors.name}</Text>}

              <Text style={modalLabel}>ADDRESS *</Text>
              <TextInput
                style={[modalInput, errors.address && modalInputError]}
                placeholder="Enter address"
                value={address}
                onChangeText={(t) => { setAddress(t); if (errors.address) setErrors(prev => ({ ...prev, address: undefined })); }}
              />
              {errors.address && <Text style={modalErrorText}>* {errors.address}</Text>}

              <View style={{ marginBottom: rp(12) }}>
                <Text style={modalLabel}>STATE & CITY *</Text>
                <CityStatePicker
                  state={state}
                  city={city}
                  onStateChange={val => { setState(val); setCity(""); if (errors.state) setErrors(prev => ({ ...prev, state: undefined })); }}
                  onCityChange={val => { setCity(val); if (errors.city) setErrors(prev => ({ ...prev, city: undefined })); }}
                />
                {(errors.state || errors.city) && <Text style={modalErrorText}>* {errors.state || errors.city}</Text>}
              </View>

              <Text style={modalLabel}>CONTACT NAME *</Text>
              <TextInput
                style={[modalInput, errors.contactName && modalInputError]}
                placeholder="Contact name"
                value={contactName}
                onChangeText={(t) => { setContactName(t); if (errors.contactName) setErrors(prev => ({ ...prev, contactName: undefined })); }}
              />
              {errors.contactName && <Text style={modalErrorText}>* {errors.contactName}</Text>}

              <Text style={modalLabel}>CONTACT PHONE *</Text>
              <TextInput
                style={[modalInput, errors.contactPhone && modalInputError]}
                placeholder="Contact phone"
                value={contactPhone}
                onChangeText={(t) => { setContactPhone(t); if (errors.contactPhone) setErrors(prev => ({ ...prev, contactPhone: undefined })); }}
                keyboardType="phone-pad"
              />
              {errors.contactPhone && <Text style={modalErrorText}>* {errors.contactPhone}</Text>}

              <Text style={modalLabel}>CONTACT EMAIL</Text>
              <TextInput
                style={[modalInput, errors.contactEmail && modalInputError]}
                placeholder="Contact email (optional)"
                value={contactEmail}
                onChangeText={(t) => { setContactEmail(t); if (errors.contactEmail) setErrors(prev => ({ ...prev, contactEmail: undefined })); }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.contactEmail && <Text style={modalErrorText}>* {errors.contactEmail}</Text>}

              <Text style={modalLabel}>TOTAL VALET SLOTS *</Text>
              <TextInput
                style={[modalInput, errors.totalSlots && modalInputError]}
                placeholder="Total slots"
                value={totalSlots}
                onChangeText={(t) => { setTotalSlots(t); if (errors.totalSlots) setErrors(prev => ({ ...prev, totalSlots: undefined })); }}
                keyboardType="numeric"
              />
              {errors.totalSlots && <Text style={modalErrorText}>* {errors.totalSlots}</Text>}
              <Text style={modalLabel}>GATE WAIT TIMER (MINUTES)</Text>
              <TextInput
                style={modalInput}
                placeholder="5"
                value={gateTimerMinutes}
                onChangeText={setGateTimerMinutes}
                keyboardType="numeric"
              />





              {/* Gates Section */}
              <Text style={modalLabel}>GATES</Text>
              {gates.map((gate, index) => (
                <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: rp(8), marginBottom: rp(8) }}>
                  <TextInput
                    style={[modalInput, { flex: 1 }]}
                    placeholder="Gate name"
                    value={gate}
                    onChangeText={(text) => {
                      const newGates = [...gates];
                      newGates[index] = text;
                      setGates(newGates);
                    }}
                  />
                  {gates.length > 1 && (
                    <TouchableOpacity
                      onPress={() => {
                        const newGates = gates.filter((_, i) => i !== index);
                        setGates(newGates);
                      }}
                    >
                      <Ionicons name="close-circle" size={rs(24)} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setGates([...gates, ""])}
                style={{ flexDirection: "row", alignItems: "center", gap: rp(6), paddingVertical: rp(8) }}
              >
                <Ionicons name="add-circle-outline" size={rs(20)} color="#7C3AED" />
                <Text style={{ color: "#7C3AED", fontSize: rs(14), fontWeight: "700" }}>Add Gate</Text>
              </TouchableOpacity>

              {/* Zones Section */}
              <Text style={modalLabel}>PARKING ZONES</Text>
              {zones.map((zone, index) => (
                <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: rp(8), marginBottom: rp(8) }}>
                  <TextInput
                    style={[modalInput, { flex: 1 }]}
                    placeholder="Zone name"
                    value={zone.name}
                    onChangeText={(text) => {
                      const newZones = [...zones];
                      newZones[index] = { ...zone, name: text };
                      setZones(newZones);
                    }}
                  />
                  <TextInput
                    style={[modalInput, { width: rp(100) }]}
                    placeholder="Slots"
                    value={zone.slots}
                    onChangeText={(text) => {
                      const newZones = [...zones];
                      newZones[index] = { ...zone, slots: text };
                      setZones(newZones);
                    }}
                    keyboardType="numeric"
                  />
                  {zones.length > 1 && (
                    <TouchableOpacity
                      onPress={() => {
                        const newZones = zones.filter((_, i) => i !== index);
                        setZones(newZones);
                      }}
                    >
                      <Ionicons name="close-circle" size={rs(24)} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setZones([...zones, { name: "", slots: "" }])}
                style={{ flexDirection: "row", alignItems: "center", gap: rp(6), paddingVertical: rp(8) }}
              >
                <Ionicons name="add-circle-outline" size={rs(20)} color="#7C3AED" />
                <Text style={{ color: "#7C3AED", fontSize: rs(14), fontWeight: "700" }}>Add Zone</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={saveHotel}
                disabled={saving}
                style={{
                  backgroundColor: ACCENT_COLOR,
                  paddingVertical: rp(16),
                  borderRadius: rp(16),
                  alignItems: "center",
                  marginTop: rp(24),
                  marginBottom: rp(40),
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontSize: rs(16), fontWeight: "900" }}>Add Hotel</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>


      </Modal>
    </View>
  );
}

const modalLabel = {
  fontSize: rs(10),
  fontWeight: "800",
  color: "#9CA3AF",
  letterSpacing: rs(1.5),
  marginBottom: rp(6),
  marginTop: rp(12),
};

const modalInput = {
  backgroundColor: "#F9FAF8",
  borderRadius: rp(12),
  paddingHorizontal: rp(16),
  paddingVertical: rp(12),
  fontSize: rs(15),
  color: "#111827",
  borderWidth: rp(1),
  borderColor: "#E5E7EB",
  flexDirection: "row",
  alignItems: "center",
};
const modalInputError = { borderColor: "#EF4444" };
const modalErrorText = { color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) };
