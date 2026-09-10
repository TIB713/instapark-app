import { confirmDialog } from "../../../lib/confirmDialog";
import { useEffect, useState, useCallback, useRef } from "react";
import { rs, rp } from "../../../utils/responsive";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import { todayIST } from "../../../utils/time";
import CityStatePicker from "../../../components/CityStatePicker";
import { State } from "country-state-city";

import { scrollToFirstError } from "../../../lib/scrollToFirstError";

import { theme } from "../../../utils/theme";
import { Screen, TopBar, Card, Btn, StatusPill } from "../../../components/valet/ui";
import { Hero } from "../../../components/admin/Hero";

export default function Hotels() {
  const router = useRouter();
  const { action } = useLocalSearchParams();
  const { user, setCurrentEventId } = useAppStore();
  const scrollViewRef = useRef(null);
  const fieldRefs = useRef({});

  const [hotels, setHotels] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (action === "add_special") {
      confirmDialog.info("Add special event", "Please select a hotel from the list to create a special event for it.");
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

  const fetchHotels = useCallback(async () => {
    try {
      const [{ data: hotelsData }, { data: eventsData }] = await Promise.all([
        api.get("/hotels"),
        api.get("/events")
      ]);
      setHotels(Array.isArray(hotelsData) ? hotelsData : []);
      setAllEvents(Array.isArray(eventsData) ? eventsData : []);
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHotels();
    }, [fetchHotels])
  );

  // Auto-update single zone's slots when totalSlots changes
  useEffect(() => {
    if (zones.length === 1 && totalSlots) {
      setZones([{ ...zones[0], slots: totalSlots }]);
    }
  }, [totalSlots, zones]);

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
    if (Object.keys(errs).length > 0) {
      scrollToFirstError(["name", "address", "city", "state", "contactName", "contactPhone", "contactEmail", "totalSlots"], errs, fieldRefs, scrollViewRef);
      return;
    }

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
      confirmDialog.info("Success", "Hotel added successfully");
    } catch (e) {
      confirmDialog.info("Couldn't add hotel", e.response?.data?.detail || "Something went wrong adding the hotel. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const today = todayIST();

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
    router.push({ pathname: "/(admin)/(tabs)/hotel-detail", params: { hid: hotel.id } });
  };

  return (
    <Screen scroll={false}>
      <Hero
        eyebrow="Contracts"
        title="Hotels"
        rightAction={isValetProvider ? { icon: "add", onPress: () => setShowAddModal(true), tone: "accent" } : null}
        // badges={[{ label: `${hotels.length} TOTAL`, tone: "primary" }]}
        stats={[
          { value: hotels.length, label: "HOTELS" },
          { value: hotels.reduce((acc, h) => acc + (h.total_valet_slots || 0), 0), label: "SLOTS" },
          { value: hotelsWithStatus.filter(h => h.is_active_today).length, label: "ACTIVE TODAY" },
        ]}
      />

      <View style={{ paddingHorizontal: rp(theme.spacing.lg), paddingVertical: rp(theme.spacing.md) }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(theme.radius.md), paddingHorizontal: rp(theme.spacing.sm) }}>
          <Ionicons name="search-outline" size={rs(20)} color={theme.colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or city"
            placeholderTextColor={theme.colors.textMuted}
            style={{ fontFamily: theme.fontFamily.regular, flex: 1, paddingVertical: rp(14), paddingHorizontal: rp(8), fontSize: rs(theme.fontSize.body), color: theme.colors.textPrimary }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} style={{ padding: rp(4) }}>
              <Ionicons name="close-circle" size={rs(18)} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView ref={scrollViewRef} style={{ flex: 1, paddingHorizontal: rp(theme.spacing.lg), paddingTop: rp(theme.spacing.sm) }}>
        {loading && <ActivityIndicator color={theme.colors.primary} />}
        {filteredHotels.map((h) => {
          const todayEvent = allEvents.find(e => e.hotel_id === h.id && e.date === today);

          return (
            <Card
              key={h.id}
              onPress={() => openHotel(h)}
              style={{ marginBottom: rp(theme.spacing.md) }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View style={{ width: rp(48), height: rp(48), borderRadius: rp(12), backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: rp(theme.spacing.md) }}>
                  <Ionicons name="business" size={rs(24)} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, fontSize: rs(theme.fontSize.bodyLarge), flex: 1, marginRight: rp(8) }} numberOfLines={1}>{typeof h.name === 'string' ? h.name : String(h.name || "")}</Text>
                    {todayEvent?.status === "active" && (
                      <View style={{ backgroundColor: theme.colors.successLight, paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(theme.radius.pill) }}>
                        <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.success, fontSize: rs(10), fontWeight: theme.fontWeight.bold }}>ACTIVE TODAY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.body), marginTop: rp(4) }} numberOfLines={1}>{typeof h.address === 'string' ? h.address : String(h.address || "")}, {typeof h.city === 'string' ? h.city : String(h.city || "")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={rs(20)} color={theme.colors.textMuted} style={{ alignSelf: "center", marginLeft: rp(theme.spacing.sm) }} />
              </View>

              <View style={{ height: rp(1), backgroundColor: theme.colors.border, marginVertical: rp(theme.spacing.md) }} />

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(16), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary }}>{h.total_valet_slots || 0}</Text>
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textMuted, fontSize: rs(9), fontWeight: theme.fontWeight.bold, textTransform: "uppercase" }}>Slots</Text>
                </View>
                <View style={{ width: rp(1), backgroundColor: theme.colors.border }} />
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(16), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary }}>{(h.gates || []).length}</Text>
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textMuted, fontSize: rs(9), fontWeight: theme.fontWeight.bold, textTransform: "uppercase" }}>Gates</Text>
                </View>
                <View style={{ width: rp(1), backgroundColor: theme.colors.border }} />
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(16), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary }}>{(allEvents.filter(e => e.hotel_id === h.id) || []).length}</Text>
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textMuted, fontSize: rs(9), fontWeight: theme.fontWeight.bold, textTransform: "uppercase" }}>Events</Text>
                </View>
              </View>
            </Card>
          );
        })}

        {!loading && filteredHotels.length === 0 && (
          <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.xxxl), alignItems: "center", borderStyle: "dashed", borderWidth: rp(2), borderColor: theme.colors.border, marginTop: rp(theme.spacing.md) }}>
            <View style={{ width: rp(64), height: rp(64), borderRadius: rp(32), backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center", marginBottom: rp(theme.spacing.md), shadowColor: theme.colors.border, shadowOpacity: 0.1, shadowRadius: rp(8) }}>
              <Ionicons name="business" size={rs(32)} color={theme.colors.textMuted} />
            </View>
            <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textPrimary, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.subtitle), textAlign: "center" }}>No hotels found</Text>
            <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.body), marginTop: rp(8), textAlign: "center", paddingHorizontal: rp(theme.spacing.xl) }}>
              {search ? "Try adjusting your search filters." : "You haven't added any hotels yet."}
            </Text>
          </View>
        )}

        {!loading && isValetProvider && (
          <View style={{ marginTop: rp(theme.spacing.lg), marginBottom: rp(theme.spacing.xl) }}>
            <Btn variant="primary" onPress={() => setShowAddModal(true)}>
              ADD HOTEL
            </Btn>
          </View>
        )}

        <View style={{ height: rp(100) }} />
      </ScrollView>

      {showAddModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: rp(theme.spacing.lg),
                  paddingTop: rp(theme.spacing.md),
                  paddingBottom: rp(theme.spacing.lg),
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <TouchableOpacity onPress={() => { setShowAddModal(false); setErrors({}); resetForm(); }} style={{ padding: rp(8), marginLeft: -rp(8) }}>
                  <Ionicons name="close" size={rs(24)} color={theme.colors.surface} />
                </TouchableOpacity>
                <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontSize: rs(20), fontWeight: theme.fontWeight.bold, marginLeft: rp(12) }}>Add Hotel</Text>
              </View>

              <ScrollView ref={scrollViewRef} style={{ flex: 1, paddingHorizontal: rp(theme.spacing.lg), paddingTop: rp(theme.spacing.md) }}>
                <Text style={modalLabel}>HOTEL NAME *</Text>
                <TextInput
                  ref={el => { if (fieldRefs.current) fieldRefs.current.name = el; }}
                  style={[modalInput, errors.name && modalInputError]}
                  placeholder="Enter hotel name"
                  placeholderTextColor={theme.colors.textMuted}
                  value={name}
                  onChangeText={(t) => { setName(t); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })); }}
                />
                {errors.name && <Text style={modalErrorText}>* {errors.name}</Text>}

                <Text style={modalLabel}>ADDRESS *</Text>
                <TextInput
                  ref={el => { if (fieldRefs.current) fieldRefs.current.address = el; }}
                  style={[modalInput, errors.address && modalInputError]}
                  placeholder="Enter address"
                  placeholderTextColor={theme.colors.textMuted}
                  value={address}
                  onChangeText={(t) => { setAddress(t); if (errors.address) setErrors(prev => ({ ...prev, address: undefined })); }}
                />
                {errors.address && <Text style={modalErrorText}>* {errors.address}</Text>}

                <View ref={el => { if (fieldRefs.current) { fieldRefs.current.state = el; fieldRefs.current.city = el; } }} style={{ marginBottom: rp(theme.spacing.md) }}>
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
                  ref={el => { if (fieldRefs.current) fieldRefs.current.contactName = el; }}
                  style={[modalInput, errors.contactName && modalInputError]}
                  placeholder="Contact name"
                  placeholderTextColor={theme.colors.textMuted}
                  value={contactName}
                  onChangeText={(t) => { setContactName(t); if (errors.contactName) setErrors(prev => ({ ...prev, contactName: undefined })); }}
                />
                {errors.contactName && <Text style={modalErrorText}>* {errors.contactName}</Text>}

                <Text style={modalLabel}>CONTACT PHONE *</Text>
                <TextInput
                  ref={el => { if (fieldRefs.current) fieldRefs.current.contactPhone = el; }}
                  style={[modalInput, errors.contactPhone && modalInputError]}
                  placeholder="Contact phone"
                  placeholderTextColor={theme.colors.textMuted}
                  value={contactPhone}
                  onChangeText={(t) => { setContactPhone(t); if (errors.contactPhone) setErrors(prev => ({ ...prev, contactPhone: undefined })); }}
                  keyboardType="phone-pad"
                />
                {errors.contactPhone && <Text style={modalErrorText}>* {errors.contactPhone}</Text>}

                <Text style={modalLabel}>CONTACT EMAIL</Text>
                <TextInput
                  ref={el => { if (fieldRefs.current) fieldRefs.current.contactEmail = el; }}
                  style={[modalInput, errors.contactEmail && modalInputError]}
                  placeholder="Contact email (optional)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={contactEmail}
                  onChangeText={(t) => { setContactEmail(t); if (errors.contactEmail) setErrors(prev => ({ ...prev, contactEmail: undefined })); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errors.contactEmail && <Text style={modalErrorText}>* {errors.contactEmail}</Text>}

                <Text style={modalLabel}>TOTAL VALET SLOTS *</Text>
                <TextInput
                  ref={el => { if (fieldRefs.current) fieldRefs.current.totalSlots = el; }}
                  style={[modalInput, errors.totalSlots && modalInputError]}
                  placeholder="Total slots"
                  placeholderTextColor={theme.colors.textMuted}
                  value={totalSlots}
                  onChangeText={(t) => { setTotalSlots(t); if (errors.totalSlots) setErrors(prev => ({ ...prev, totalSlots: undefined })); }}
                  keyboardType="numeric"
                />
                {errors.totalSlots && <Text style={modalErrorText}>* {errors.totalSlots}</Text>}
                <Text style={modalLabel}>GATE WAIT TIMER (MINUTES)</Text>
                <TextInput
                  style={modalInput}
                  placeholder="5"
                  placeholderTextColor={theme.colors.textMuted}
                  value={gateTimerMinutes}
                  onChangeText={setGateTimerMinutes}
                  keyboardType="numeric"
                />

                {/* Gates Section */}
                <Text style={modalLabel}>GATES</Text>
                {gates.map((gate, index) => (
                  <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: rp(8), marginBottom: rp(8) }}>
                    <TextInput
                      style={[modalInput, { fontFamily: theme.fontFamily.regular, flex: 1, marginBottom: 0 }]}
                      placeholder="Gate name"
                      placeholderTextColor={theme.colors.textMuted}
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
                        <Ionicons name="close-circle" size={rs(24)} color={theme.colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setGates([...gates, ""])}
                  style={{ flexDirection: "row", alignItems: "center", gap: rp(6), paddingVertical: rp(8) }}
                >
                  <Ionicons name="add-circle-outline" size={rs(20)} color={theme.colors.primary} />
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.primary, fontSize: rs(14), fontWeight: theme.fontWeight.bold }}>Add Gate</Text>
                </TouchableOpacity>

                {/* Zones Section */}
                <Text style={modalLabel}>PARKING ZONES</Text>
                {zones.map((zone, index) => (
                  <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: rp(8), marginBottom: rp(8) }}>
                    <TextInput
                      style={[modalInput, { fontFamily: theme.fontFamily.regular, flex: 1, marginBottom: 0 }]}
                      placeholder="Zone name"
                      placeholderTextColor={theme.colors.textMuted}
                      value={zone.name}
                      onChangeText={(text) => {
                        const newZones = [...zones];
                        newZones[index] = { ...zone, name: text };
                        setZones(newZones);
                      }}
                    />
                    <TextInput
                      style={[modalInput, { fontFamily: theme.fontFamily.regular, width: rp(100), marginBottom: 0 }]}
                      placeholder="Slots"
                      placeholderTextColor={theme.colors.textMuted}
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
                        <Ionicons name="close-circle" size={rs(24)} color={theme.colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setZones([...zones, { name: "", slots: "" }])}
                  style={{ flexDirection: "row", alignItems: "center", gap: rp(6), paddingVertical: rp(8) }}
                >
                  <Ionicons name="add-circle-outline" size={rs(20)} color={theme.colors.primary} />
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.primary, fontSize: rs(14), fontWeight: theme.fontWeight.bold }}>Add Zone</Text>
                </TouchableOpacity>

                <View style={{ marginTop: rp(theme.spacing.xl), marginBottom: rp(theme.spacing.xxxl) }}>
                  <Btn
                    variant="primary"
                    onPress={saveHotel}
                    disabled={saving}
                  >
                    {saving ? "ADDING..." : "ADD HOTEL"}
                  </Btn>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      )}
    </Screen>
  );
}

const modalLabel = {
  fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.caption),
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.textSecondary,
  letterSpacing: rs(1),
  marginBottom: rp(theme.spacing.xs),
  marginTop: rp(theme.spacing.md),
  textTransform: "uppercase",
};

const modalInput = {
  fontFamily: theme.fontFamily.regular, backgroundColor: theme.colors.surfaceAlt,
  borderRadius: rp(theme.radius.md),
  paddingHorizontal: rp(theme.spacing.md),
  paddingVertical: rp(theme.spacing.md),
  fontSize: rs(theme.fontSize.body),
  color: theme.colors.textPrimary,
  borderWidth: rp(1),
  borderColor: theme.colors.border,
  flexDirection: "row",
  alignItems: "center",
  marginBottom: rp(theme.spacing.md),
};

const modalInputError = { borderColor: theme.colors.danger };
const modalErrorText = { fontFamily: theme.fontFamily.bold, color: theme.colors.danger, fontSize: rs(theme.fontSize.caption), fontWeight: theme.fontWeight.bold, marginTop: rp(-8), marginBottom: rp(theme.spacing.md) };
