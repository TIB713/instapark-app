import { confirmDialog } from "../../lib/confirmDialog";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState, useCallback } from "react";
import { rs, rp } from '../../utils/responsive';
import { fmtDateTime, todayIST, toISTDateString } from '../../utils/time';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Share,
  BackHandler,
  Image,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import CityStatePicker from "../../components/CityStatePicker";
import { State } from "country-state-city";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

const ACCENT_COLOR = "#1D4ED8";
const generateTempPassword = () => Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "1!";
const cardShadow = {
  shadowColor: ACCENT_COLOR,
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

const cardBase = {
  backgroundColor: "#fff",
  borderRadius: rp(24),
};

function InfoRow({ label, value, editing, onChange, keyboardType = "default" }) {
  if (editing) {
    return (
      <View style={{ marginBottom: rp(16) }}>
        <Text style={{ fontSize: rs(10), fontWeight: "800", color: ACCENT_COLOR, letterSpacing: rs(1.5) }}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          style={{ marginTop: rp(4), backgroundColor: "#F9FAF8", borderRadius: rp(12), paddingHorizontal: rp(12), paddingVertical: rp(8), fontSize: rs(15), color: "#111827", borderWidth: rp(1), borderColor: ACCENT_COLOR }}
        />
      </View>
    );
  }
  return (
    <View style={{ marginBottom: rp(16) }}>
      <Text style={{ fontSize: rs(10), fontWeight: "800", color: "#9CA3AF", letterSpacing: rs(1.5) }}>{label}</Text>
      <Text style={{ fontSize: rs(15), fontWeight: "900", color: "#111827", marginTop: rp(4) }}>{value || "—"}</Text>
    </View>
  );
}

export default function HotelDetail() {
  const insets = useSafeAreaInsets();

  const router = useRouter();

  useEffect(() => {
    const backAction = () => {
      if (showAddEventModal) { setShowAddEventModal(false); return true; }
      if (showEventQRModal) { setShowEventQRModal(false); return true; }
      router.back(); return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [showAddEventModal, showEventQRModal]);

  const { hid } = useLocalSearchParams();
  const { setCurrentEventId } = useAppStore();

  const [hotel, setHotel] = useState(null);
  const [tab, setTab] = useState("today");
  const [teamTab, setTeamTab] = useState("drivers");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Guests state
  const [guests, setGuests] = useState([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [uploadingGuests, setUploadingGuests] = useState(false);
  const [guestUploadTarget, setGuestUploadTarget] = useState("daily");

  // Events state
  const [allEvents, setAllEvents] = useState([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  // Event QR state
  const [showEventQRModal, setShowEventQRModal] = useState(false);
  const [selectedEventForQR, setSelectedEventForQR] = useState(null);
  const [eventQRToken, setEventQRToken] = useState(null);
  const [loadingEventQR, setLoadingEventQR] = useState(false);

  // New event state
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState(todayIST());
  const [newEventStartTime, setNewEventStartTime] = useState("18:00");
  const [newEventEndTime, setNewEventEndTime] = useState("23:00");
  const [newEventMaxCars, setNewEventMaxCars] = useState("100");
  const [newEventAllowInstantPark, setNewEventAllowInstantPark] = useState(false);

  const [newEventGates, setNewEventGates] = useState(["Main Gate"]);
  const [newEventZones, setNewEventZones] = useState([{ name: "Zone A", slots: "50" }]);
  const [showEventDatePicker, setShowEventDatePicker] = useState(false);
  const [showEventStartTimePicker, setShowEventStartTimePicker] = useState(false);
  const [showEventEndTimePicker, setShowEventEndTimePicker] = useState(false);
  const [newEventHostName, setNewEventHostName] = useState("");
  const [newEventHostEmail, setNewEventHostEmail] = useState("");

  // Team tab state
  const [allDrivers, setAllDrivers] = useState([]);
  const [allSupervisors, setAllSupervisors] = useState([]);
  const [teamSearch, setTeamSearch] = useState("");

  // Info tab state (editable)
  const [editHotel, setEditHotel] = useState(null);
  const [editZones, setEditZones] = useState([]);
  const [editGates, setEditGates] = useState([]);
  const [editingInfo, setEditingInfo] = useState(false);


  const today = todayIST();
  const todayEvents = allEvents
    .filter(e => e.date === today)
    .sort((a, b) => (a.status === "active" ? -1 : 1));
  const pastEvents = allEvents
    .filter(e => e.status === "closed" && e.date < today)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const assignedDriverIds = new Set(hotel?.assigned_driver_ids || (hotel?.assigned_drivers || []).map(d => d.id));
  const assignedSupervisorIds = new Set(hotel?.assigned_supervisor_ids || (hotel?.assigned_supervisors || []).map(s => s.id));

  const sortedDrivers = [
    ...allDrivers.filter(d => assignedDriverIds.has(d.id)),
    ...allDrivers.filter(d => !assignedDriverIds.has(d.id))
  ].filter(d =>
    d.name?.toLowerCase().includes(teamSearch.toLowerCase()) ||
    d.employee_id?.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const sortedSupervisors = [
    ...allSupervisors.filter(s => assignedSupervisorIds.has(s.id)),
    ...allSupervisors.filter(s => !assignedSupervisorIds.has(s.id))
  ].filter(s =>
    s.name?.toLowerCase().includes(teamSearch.toLowerCase()) ||
    s.employee_id?.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const fetchHotel = useCallback(async () => {
    try {
      const { data } = await api.get(`/hotels/${hid}`);
      setHotel(data);
      setEditHotel(data);
      // Initialize edit state from hotel data
      setEditZones(data.zones || [{ name: "A", slots: data.total_valet_slots || 50 }]);
      setEditGates(data.gates || ["Main Gate"]);
    } catch (e) {
      console.error("Error fetching hotel:", e);
    }
  }, [hid]);

  const fetchEvents = useCallback(async () => {
    try {
      const { data } = await api.get("/events");
      const hotelEvents = (data || []).filter(e => e.hotel_id === hid);
      setAllEvents(hotelEvents);
    } catch (e) {
      console.error("Error fetching events:", e);
    }
  }, [hid]);

  const fetchGuests = useCallback(async () => {
    try {
      setLoadingGuests(true);
      const { data } = await api.get(`/hotels/${hid}/guest-list`);
      setGuests(data.guests || []);
    } catch (e) {
      console.error("Error fetching guests:", e);
    } finally {
      setLoadingGuests(false);
    }
  }, [hid]);

  const fetchAllMembers = useCallback(async () => {
    try {
      const [drvRes, supRes] = await Promise.all([
        api.get("/drivers"),
        api.get("/supervisors")
      ]);
      setAllDrivers(drvRes.data || []);
      setAllSupervisors(supRes.data || []);
    } catch (e) {
      console.error("Failed to fetch members", e);
    }
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchHotel(), fetchEvents(), fetchAllMembers(), fetchGuests()]);
    setLoading(false);
  }, [fetchHotel, fetchEvents, fetchAllMembers, fetchGuests]);

  useFocusEffect(
    useCallback(() => {
      init();
    }, [init])
  );

  useEffect(() => {
    setTeamSearch("");
  }, [teamTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchHotel(), fetchEvents(), fetchAllMembers(), fetchGuests()]);
    setRefreshing(false);
  };

  const updateHotel = async (updates) => {
    try {
      const { data } = await api.patch(`/hotels/${hid}`, updates);
      setHotel(data);
      setEditHotel(data);
    } catch (e) {
      confirmDialog.info("Couldn't update hotel", "Something went wrong updating the hotel. Check your connection and try again.");
    }
  };


  const addMember = async (memberId) => {
    try {
      const type = teamTab === "drivers" ? "drivers" : "supervisors";
      await api.post(`/hotels/${hid}/${type}/${memberId}`);
      fetchHotel();
    } catch (e) {
      confirmDialog.info("Couldn't add member", "Something went wrong adding the member. Check your connection and try again.");
    }
  };

  const removeMember = (memberId) => {
    confirmDialog.destructiveConfirm("Remove member", "Are you sure you want to remove this member from the hotel?", async () => {
          try {
            const type = teamTab === "drivers" ? "drivers" : "supervisors";
            await api.delete(`/hotels/${hid}/${type}/${memberId}`);
            fetchHotel();
          } catch (e) {
            confirmDialog.info("Couldn't remove", "Something went wrong removing the item. Check your connection and try again.");
          }
        }, "Remove");
  };

  const uploadGuests = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const file = res.assets[0];

      setUploadingGuests(true);
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      if (guestUploadTarget !== "daily") {
        formData.append("event_id", guestUploadTarget);
      }

      const { data } = await api.post(`/hotels/${hid}/guest-list/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      confirmDialog.info("Success", `Uploaded! SMS sent to ${data.sms_sent_count} guests.`);
      fetchGuests();
    } catch (e) {
      confirmDialog.info("Couldn't upload guests", e.response?.data?.detail || "Something went wrong processing the guests. Check your connection and try again.");
    } finally {
      setUploadingGuests(false);
    }
  };



  const openEvent = (event) => {
    setCurrentEventId(event.id);
    router.push("/(admin)/event-detail");
  };

  const saveSpecialEvent = async () => {
    if (!newEventName.trim()) {
      confirmDialog.info("Required", "Please enter the event name");
      return;
    }
    if (!newEventDate) {
      confirmDialog.info("Required", "Please select a date");
      return;
    }
    if (!newEventStartTime) {
      confirmDialog.info("Required", "Please select a start time");
      return;
    }
    if (!newEventEndTime) {
      confirmDialog.info("Required", "Please select an end time");
      return;
    }
    const maxCarsNum = parseInt(newEventMaxCars);
    if (isNaN(maxCarsNum) || maxCarsNum < 1) {
      confirmDialog.info("Required", "Please enter a valid number for max cars");
      return;
    }
    setSavingEvent(true);
    try {
      const { data } = await api.post(`/hotels/${hid}/events`, {
        name: newEventName.trim(),
        date: newEventDate,
        end_date: newEventDate,
        start_time: newEventStartTime,
        end_time: newEventEndTime,
        max_cars: maxCarsNum,
        allow_instant_park: newEventAllowInstantPark,
        zones: newEventZones.map((z) => ({
          name: z.name,
          slots: parseInt(z.slots) || 50,
        })),
        gates: newEventGates.filter((g) => g.trim()),
        event_type: "hotel_special",
        venue: hotel?.name,
      });
      if (newEventHostName.trim() && newEventHostEmail.trim()) {
        try {
          await api.patch(`/events/${data.id}/host`, {
            host_name: newEventHostName.trim(),
            host_email: newEventHostEmail.trim()
          });
        } catch (err) {
          confirmDialog.info("Host invite failed", "Event created, but host invite failed to send.");
        }
      }
      setShowAddEventModal(false);
      setNewEventName("");
      setNewEventHostName("");
      setNewEventHostEmail("");
      setNewEventGates(["Main Gate"]);
      setNewEventZones([{ name: "Zone A", slots: "50" }]);
      fetchEvents();
      confirmDialog.info("Success", "Special event created");
    } catch (e) {
      const detail = e.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join(", ")
        : typeof detail === "string"
          ? detail
          : "Failed to create special event";
      if (message && message.toLowerCase().includes("event limit reached")) {
        confirmDialog.info("Event limit reached", "You've used up your available events for this account. Contact your admin to increase your limit, or archive an old event to free up space.");
      } else {
        confirmDialog.info("Couldn't create event", message);
      }
    } finally {
      setSavingEvent(false);
    }
  };

  const addSpecialEvent = () => {
    setShowAddEventModal(true);
  };

  const handleShowEventQR = async (event) => {
    setSelectedEventForQR(event);
    setShowEventQRModal(true);
    setLoadingEventQR(true);
    setEventQRToken(null);
    try {
      const { data } = await api.get(`/hotels/${hid}/events/${event.id}/qr-token`);
      setEventQRToken(data.event_qr_token);
    } catch (e) {
      console.error("Error fetching event QR:", e);
      confirmDialog.info("Couldn't load event QR", "Something went wrong loading the QR code. Check your connection and try again.");
    } finally {
      setLoadingEventQR(false);
    }
  };

  if (loading) {
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
              alignItems: "center"
            }}
          >
            <ActivityIndicator size="small" color="#fff" />
            <Text style={{ color: "#fff", marginTop: rp(8), fontWeight: "700", opacity: 0.8 }}>
              Loading Hotel...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: ACCENT_COLOR }}>
        <View
          style={{
            backgroundColor: ACCENT_COLOR,
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
            paddingBottom: rp(24),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8) }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: rp(12) }}>
              <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900" }} numberOfLines={1}>
                {hotel?.name}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: rs(12) }}>{hotel?.city}, {hotel?.state}</Text>
            </View>
            <TouchableOpacity
              onPress={addSpecialEvent}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: rp(12), paddingVertical: rp(8), borderRadius: rp(12), flexDirection: "row", alignItems: "center", gap: rp(6) }}
            >
              <Ionicons name="star" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(11) }}>SPECIAL EVENT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Tab bar */}
      <View
        style={{
          backgroundColor: "#fff",
          flexDirection: "row",
          marginHorizontal: rp(16),
          marginTop: -rp(20),
          borderRadius: rp(20),
          padding: rp(4),
          ...cardShadow,
        }}
      >
        {[
          ["today", "Today"],
          ["events", "Events"],
          ["team", "Team"],
          // ["guests", "Guests"],
          ["info", "Info"],
          // ["qr", "QR"],
        ].map(([k, l]) => {
          return (
            <TouchableOpacity
              key={k}
              onPress={() => setTab(k)}
              style={{
                flex: 1,
                paddingVertical: rp(10),
                borderRadius: rp(16),
                backgroundColor: tab === k ? ACCENT_COLOR : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: rs(12),
                  color: tab === k ? "#fff" : "#6B7280",
                  letterSpacing: rs(0.5),
                }}
              >
                {l}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
        contentContainerStyle={{ paddingBottom: rp(100) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT_COLOR} />}
      >
        {tab === "today" && (
          <View>
            <Text style={sectionTitle}>TODAY'S OPERATIONS</Text>
            {todayEvents.length > 0 ? (
              todayEvents.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => openEvent(e)}
                  style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(20), ...cardShadow, marginBottom: rp(12) }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: rp(8) }}>
                        <Text style={{ fontSize: rs(18), fontWeight: "900", color: "#111827" }}>{e.name}</Text>
                        <View style={{ backgroundColor: e.event_type === "hotel_daily" ? "#E0F2FE" : "#EBF5FF", paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(99) }}>
                          <Text style={{ color: e.event_type === "hotel_daily" ? "#0369A1" : ACCENT_COLOR, fontWeight: "800", fontSize: rs(9) }}>
                            {e.event_type === "hotel_daily" ? "AUTO DAILY" : "SPECIAL"}
                          </Text>
                        </View>
                        {/* {e.event_type === "hotel_special" && (
                          <TouchableOpacity
                            onPress={() => handleShowEventQR(e)}
                            style={{ backgroundColor: "#F5F3FF", padding: rp(6), borderRadius: rp(8) }}
                          >
                            <Ionicons name="qr-code" size={16} color={ACCENT_COLOR} />
                          </TouchableOpacity>
                        )} */}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(8), gap: rp(12) }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Ionicons name="time-outline" size={14} color={ACCENT_COLOR} />
                          <Text style={{ color: "#6B7280", fontSize: rs(13), marginLeft: rp(4) }}>{e.start_time}—{e.end_time}</Text>
                        </View>
                        <View style={{ backgroundColor: e.status === "active" ? "#D1FAE5" : "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(99) }}>
                          <Text style={{ color: e.status === "active" ? "#059669" : "#6B7280", fontWeight: "800", fontSize: rs(10) }}>{e.status.toUpperCase()}</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
                  </View>

                  <View style={{ height: rp(1), backgroundColor: "#F3F4F6", marginVertical: rp(16) }} />

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Text style={{ color: "#9CA3AF", fontSize: rs(11), fontWeight: "700" }}>TOTAL CARS</Text>
                      <Text style={{ fontSize: rs(24), fontWeight: "900", color: "#111827", marginTop: rp(4) }}>{e.total_cars || 0}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openEvent(e)}
                      style={{ backgroundColor: ACCENT_COLOR, paddingHorizontal: rp(20), paddingVertical: rp(10), borderRadius: rp(14), justifyContent: "center" }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(13) }}>OPEN EVENT</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ backgroundColor: "#F3F4F6", borderRadius: rp(24), padding: rp(32), alignItems: "center", borderStyle: "dashed", borderWidth: rp(2), borderColor: "#D1D5DB" }}>
                <Text style={{ fontSize: rs(40) }}>🗓️</Text>
                <Text style={{ color: "#6B7280", fontWeight: "700", marginTop: rp(12), fontSize: rs(15) }}>No events today</Text>
                <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginTop: rp(4), textAlign: "center" }}>Daily event is created automatically at midnight</Text>
              </View>
            )}
          </View>
        )}

        {tab === "events" && (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(12) }}>
              <Text style={sectionTitle}>PAST EVENTS</Text>
              <TouchableOpacity onPress={addSpecialEvent} style={{ flexDirection: "row", alignItems: "center", gap: rp(4) }}>
                <Ionicons name="add-circle" size={18} color={ACCENT_COLOR} />
                <Text style={{ color: ACCENT_COLOR, fontWeight: "800", fontSize: rs(13) }}>Add Special</Text>
              </TouchableOpacity>
            </View>
            {pastEvents.length > 0 ? (
              pastEvents.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => openEvent(e)}
                  style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(16), marginBottom: rp(12), flexDirection: "row", alignItems: "center", ...cardShadow }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(16) }}>{e.name}</Text>
                    <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>{e.date}</Text>
                    <View style={{ flexDirection: "row", marginTop: rp(8), gap: rp(8), alignItems: "center" }}>
                      <View style={{ backgroundColor: e.event_type === "hotel_daily" ? "#E0F2FE" : "#EBF5FF", paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(99) }}>
                        <Text style={{ color: e.event_type === "hotel_daily" ? "#0369A1" : ACCENT_COLOR, fontWeight: "800", fontSize: rs(9) }}>
                          {e.event_type === "hotel_daily" ? "AUTO DAILY" : "SPECIAL"}
                        </Text>
                      </View>
                      {/* {e.event_type === "hotel_special" && (
                        <TouchableOpacity
                          onPress={() => handleShowEventQR(e)}
                          style={{ backgroundColor: "#F5F3FF", padding: rp(4), borderRadius: rp(6) }}
                        >
                          <Ionicons name="qr-code" size={14} color={ACCENT_COLOR} />
                        </TouchableOpacity>
                      )} */}
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                        <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginLeft: rp(4) }} numberOfLines={1}>{e.venue}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(18) }}>{e.total_cars || 0}</Text>
                    <Text style={{ color: "#9CA3AF", fontSize: rs(9), fontWeight: "700" }}>CARS</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginLeft: rp(12) }} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ backgroundColor: "#F3F4F6", borderRadius: rp(24), padding: rp(32), alignItems: "center", borderStyle: "dashed", borderWidth: rp(2), borderColor: "#D1D5DB" }}>
                <Text style={{ fontSize: rs(40) }}>📁</Text>
                <Text style={{ color: "#6B7280", fontWeight: "700", marginTop: rp(12), fontSize: rs(15) }}>No past events yet</Text>
              </View>
            )}
          </View>
        )}

        {tab === "team" && (
          <View>
            <View style={{ backgroundColor: "#fff", flexDirection: "row", borderRadius: rp(20), padding: rp(4), marginBottom: rp(16), ...cardShadow }}>
              {["Drivers", "Supervisors"].map((l) => {
                const k = l.toLowerCase();
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setTeamTab(k)}
                    style={{
                      flex: 1,
                      paddingVertical: rp(10),
                      borderRadius: rp(16),
                      backgroundColor: teamTab === k ? ACCENT_COLOR : "transparent",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "800", fontSize: rs(13), color: teamTab === k ? "#fff" : "#6B7280" }}>{l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ marginBottom: rp(12) }}>
              <Text style={sectionTitle}>{teamTab.toUpperCase()}</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: rp(12), paddingHorizontal: rp(12), marginBottom: rp(16) }}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              <TextInput
                value={teamSearch}
                onChangeText={setTeamSearch}
                placeholder={teamTab === "drivers" ? "Search drivers..." : "Search supervisors..."}
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, paddingVertical: rp(10), paddingHorizontal: rp(8), fontSize: rs(14) }}
              />
            </View>

            {(teamTab === "drivers" ? sortedDrivers : sortedSupervisors).map((m) => {
              const isAssigned = (teamTab === "drivers" ? assignedDriverIds : assignedSupervisorIds).has(m.id);
              return (
                <View key={m.id} style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(16), marginBottom: rp(12), flexDirection: "row", alignItems: "center", ...cardShadow }}>
                  <View style={{ width: rp(44), height: rp(44), borderRadius: rp(22), backgroundColor: ACCENT_COLOR, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(16) }}>{m.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: rp(12) }}>
                    <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(15) }}>{m.name}</Text>
                    <Text style={{ color: "#6B7280", fontSize: rs(11) }}>ID: {m.employee_id || "N/A"}</Text>
                    {isAssigned && (
                      <View style={{ marginTop: rp(4), flexDirection: "row", alignItems: "center" }}>
                        <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(8) }}>
                          <Text style={{ color: "#059669", fontSize: rs(10), fontWeight: "700" }}>ASSIGNED</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  {isAssigned ? (
                    <TouchableOpacity onPress={() => removeMember(m.id)} style={{ padding: rp(8) }}>
                      <Ionicons name="remove-circle-outline" size={24} color="#F43F5E" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => addMember(m.id)} style={{ padding: rp(8) }}>
                      <Ionicons name="add-circle-outline" size={24} color="#059669" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* {tab === "guests" && (
          <View>
            <View style={{ marginBottom: rp(16) }}>
              <Text style={{ fontSize: rs(12), fontWeight: "800", color: "#6B7280", marginBottom: rp(8) }}>Upload for:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(8) }}>
                <TouchableOpacity
                  onPress={() => setGuestUploadTarget("daily")}
                  style={{
                    backgroundColor: guestUploadTarget === "daily" ? ACCENT_COLOR : "#F3F4F6",
                    paddingHorizontal: rp(16),
                    paddingVertical: rp(8),
                    borderRadius: rp(99),
                  }}
                >
                  <Text style={{ color: guestUploadTarget === "daily" ? "#fff" : "#6B7280", fontWeight: "800", fontSize: rs(12) }}>Daily Valet</Text>
                </TouchableOpacity>
                {allEvents.filter(e => e.status === "active" && e.event_type === "hotel_special").map(e => (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => setGuestUploadTarget(e.id)}
                    style={{
                      backgroundColor: guestUploadTarget === e.id ? ACCENT_COLOR : "#F3F4F6",
                      paddingHorizontal: rp(16),
                      paddingVertical: rp(8),
                      borderRadius: rp(99),
                    }}
                  >
                    <Text style={{ color: guestUploadTarget === e.id ? "#fff" : "#6B7280", fontWeight: "800", fontSize: rs(12) }}>{e.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(12) }}>
              <Text style={sectionTitle}>GUEST LIST</Text>
              <TouchableOpacity
                onPress={uploadGuests}
                disabled={uploadingGuests}
                style={{ backgroundColor: ACCENT_COLOR, paddingHorizontal: rp(12), paddingVertical: rp(6), borderRadius: rp(10), flexDirection: "row", alignItems: "center", gap: rp(4), opacity: uploadingGuests ? 0.7 : 1 }}
              >
                {uploadingGuests ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="cloud-upload" size={16} color="#fff" />}
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(11) }}>{uploadingGuests ? "UPLOADING..." : "UPLOAD EXCEL"}</Text>
              </TouchableOpacity>
            </View>

            {loadingGuests ? (
              <ActivityIndicator size="large" color={ACCENT_COLOR} style={{ marginTop: rp(40) }} />
            ) : guests.length > 0 ? (
              guests.map((g) => (
                <View key={g.id} style={{ backgroundColor: "#fff", borderRadius: rp(16), padding: rp(16), marginBottom: rp(12), ...cardShadow }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(15) }}>{g.name}</Text>
                      <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>{g.contact}</Text>
                      {g.expected_arrival && (
                        <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginTop: rp(4) }}>Arrival: {fmtDateTime(g.expected_arrival)}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: rp(6) }}>
                      {g.sms_sent && (
                        <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(6) }}>
                          <Text style={{ color: "#059669", fontSize: rs(9), fontWeight: "800" }}>SMS SENT</Text>
                        </View>
                      )}
                      {g.pre_registered ? (
                        <View style={{ backgroundColor: "#E0E7FF", paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(6) }}>
                          <Text style={{ color: "#4338CA", fontSize: rs(9), fontWeight: "800" }}>PRE-REGISTERED</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(6) }}>
                          <Text style={{ color: "#9CA3AF", fontSize: rs(9), fontWeight: "800" }}>PENDING</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={{ backgroundColor: "#F3F4F6", borderRadius: rp(24), padding: rp(32), alignItems: "center", borderStyle: "dashed", borderWidth: rp(2), borderColor: "#D1D5DB" }}>
                <Text style={{ fontSize: rs(40) }}>👥</Text>
                <Text style={{ color: "#6B7280", fontWeight: "700", marginTop: rp(12), fontSize: rs(15) }}>No guests added</Text>
                <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginTop: rp(4), textAlign: "center" }}>Upload an Excel file to invite guests.</Text>
              </View>
            )}
          </View>
        )} */}

        {tab === "info" && (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(12) }}>
              <Text style={sectionTitle}>HOTEL INFORMATION</Text>
              {editingInfo ? (
                <View style={{ flexDirection: "row", gap: rp(8) }}>
                  <TouchableOpacity
                    onPress={() => { setEditHotel(hotel); setEditGates(hotel.gates || [""]); setEditZones(hotel.zones?.length ? hotel.zones : [{ name: "", slots: "" }]); setEditingInfo(false); }}
                    style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(10), backgroundColor: "#F3F4F6" }}
                  >
                    <Text style={{ color: "#6B7280", fontWeight: "800", fontSize: rs(12) }}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      await updateHotel({
                        name: editHotel.name,
                        address: editHotel.address,
                        city: editHotel.city,
                        state: editHotel.state,
                        contact_person_name: editHotel.contact_person_name,
                        contact_person_phone: editHotel.contact_person_phone,
                        contact_person_email: editHotel.contact_person_email,
                        total_valet_slots: parseInt(editHotel.total_valet_slots) || 0,
                        gate_timer_minutes: parseInt(editHotel.gate_timer_minutes) || 5,
                        allow_instant_park: editHotel.allow_instant_park,
                        is_active: editHotel.is_active,
                        gates: editGates.filter(g => g.trim()),
                        zones: editZones.map(z => ({ name: z.name.trim(), slots: parseInt(z.slots) || 0 })).filter(z => z.name),
                      });
                      setEditingInfo(false);
                    }}
                    style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(10), backgroundColor: ACCENT_COLOR }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: rs(12) }}>SAVE</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setEditingInfo(true)}
                  style={{ flexDirection: "row", alignItems: "center", gap: rp(4), paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(10), backgroundColor: "#F3F4F6" }}
                >
                  <Ionicons name="pencil" size={14} color={ACCENT_COLOR} />
                  <Text style={{ color: ACCENT_COLOR, fontWeight: "800", fontSize: rs(12) }}>EDIT</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(20), ...cardShadow }}>
              <InfoRow label="HOTEL NAME" value={editHotel?.name} editing={editingInfo} onChange={(v) => setEditHotel(prev => ({ ...prev, name: v }))} />
              <InfoRow label="ADDRESS" value={editHotel?.address} editing={editingInfo} onChange={(v) => setEditHotel(prev => ({ ...prev, address: v }))} />
              <View style={{ marginBottom: rp(16) }}>
                <Text style={{ fontSize: rs(10), fontWeight: "800", color: "#9CA3AF", letterSpacing: rs(1.5), marginBottom: rp(8) }}>STATE & CITY</Text>
                {editingInfo ? (
                  <CityStatePicker
                    state={State.getStatesOfCountry("IN").find(s => s.name === editHotel?.state)?.isoCode || editHotel?.state}
                    city={editHotel?.city}
                    onStateChange={val => setEditHotel(prev => ({ ...prev, state: State.getStatesOfCountry("IN").find(s => s.isoCode === val)?.name || val, city: "" }))}
                    onCityChange={val => setEditHotel(prev => ({ ...prev, city: val }))}
                  />
                ) : (
                  <Text style={{ fontSize: rs(15), fontWeight: "900", color: "#111827", marginTop: rp(4) }}>
                    {editHotel?.city}, {editHotel?.state}
                  </Text>
                )}
              </View>
              <InfoRow label="CONTACT PERSON" value={editHotel?.contact_person_name} editing={editingInfo} onChange={(v) => setEditHotel(prev => ({ ...prev, contact_person_name: v }))} />
              <InfoRow label="PHONE" value={editHotel?.contact_person_phone} editing={editingInfo} onChange={(v) => setEditHotel(prev => ({ ...prev, contact_person_phone: v }))} />
              <InfoRow label="EMAIL" value={editHotel?.contact_person_email} editing={editingInfo} onChange={(v) => setEditHotel(prev => ({ ...prev, contact_person_email: v }))} />
              <InfoRow label="TOTAL SLOTS" value={editHotel?.total_valet_slots?.toString()} editing={editingInfo} keyboardType="numeric" onChange={(v) => setEditHotel(prev => ({ ...prev, total_valet_slots: v }))} />
              <InfoRow label="GATE WAIT TIMER (MIN)" value={editHotel?.gate_timer_minutes?.toString()} editing={editingInfo} keyboardType="numeric" onChange={(v) => setEditHotel(prev => ({ ...prev, gate_timer_minutes: v }))} />
              
              {editingInfo ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: rp(16), marginBottom: rp(16) }}>
                  <Text style={{ fontSize: rs(13), fontWeight: "700", color: "#374151", flex: 1 }}>Allow Instant Park for this hotel's events</Text>
                  <Switch
                    value={editHotel?.allow_instant_park}
                    onValueChange={(v) => setEditHotel(prev => ({ ...prev, allow_instant_park: v }))}
                    trackColor={{ false: "#D1D5DB", true: "#059669" }}
                    thumbColor="#ffffff"
                  />
                </View>
              ) : (
                <View style={{ marginBottom: rp(16) }}>
                  <Text style={{ fontSize: rs(10), fontWeight: "800", color: "#9CA3AF", letterSpacing: rs(1.5) }}>ALLOW INSTANT PARK</Text>
                  <Text style={{ fontSize: rs(15), fontWeight: "900", color: "#111827", marginTop: rp(4) }}>{editHotel?.allow_instant_park ? "Yes" : "No"}</Text>
                </View>
              )}

              {/* Gates */}
              <View style={{ marginTop: rp(12) }}>
                <Text style={modalLabel}>GATES</Text>
                {editingInfo ? (
                  <>
                    {editGates.map((gate, index) => (
                      <View
                        key={index}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: rp(8),
                          marginBottom: rp(8),
                        }}
                      >
                        <TextInput
                          style={[modalTextInput, { flex: 1 }]}
                          placeholder="Gate name"
                          value={gate}
                          onChangeText={(text) => {
                            const newGates = [...editGates];
                            newGates[index] = text;
                            setEditGates(newGates);
                          }}
                        />
                        {editGates.length > 1 && (
                          <TouchableOpacity
                            onPress={() => {
                              const newGates = editGates.filter(
                                (_, i) => i !== index
                              );
                              setEditGates(newGates);
                            }}
                          >
                            <Ionicons
                              name="close-circle"
                              size={rs(24)}
                              color="#F43F5E"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    <TouchableOpacity
                      onPress={() => setEditGates([...editGates, ""])}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: rp(6),
                        paddingVertical: rp(8),
                      }}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={rs(20)}
                        color="#7C3AED"
                      />
                      <Text
                        style={{
                          color: "#7C3AED",
                          fontSize: rs(14),
                          fontWeight: "700",
                        }}
                      >
                        Add Gate
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ gap: rp(8), marginTop: rp(4) }}>
                    {editGates.map((gate, i) => (
                      <Text key={i} style={{ fontSize: rs(15), fontWeight: "900", color: "#111827" }}>{gate}</Text>
                    ))}
                  </View>
                )}
              </View>

              {/* Parking Zones */}
              <View style={{ marginTop: rp(12) }}>
                <Text style={modalLabel}>PARKING ZONES</Text>
                {editingInfo ? (
                  <>
                    {editZones.map((zone, index) => (
                      <View
                        key={index}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: rp(8),
                          marginBottom: rp(8),
                        }}
                      >
                        <TextInput
                          style={[modalTextInput, { flex: 1 }]}
                          placeholder="Zone name"
                          value={zone.name}
                          onChangeText={(text) => {
                            const newZones = [...editZones];
                            newZones[index] = { ...zone, name: text };
                            setEditZones(newZones);
                          }}
                        />
                        <TextInput
                          style={[modalTextInput, { width: rp(100) }]}
                          placeholder="Slots"
                          value={zone.slots?.toString() || ""}
                          onChangeText={(text) => {
                            const newZones = [...editZones];
                            newZones[index] = { ...zone, slots: text };
                            setEditZones(newZones);
                          }}
                          keyboardType="numeric"
                        />
                        {editZones.length > 1 && (
                          <TouchableOpacity
                            onPress={() => {
                              const newZones = editZones.filter(
                                (_, i) => i !== index
                              );
                              setEditZones(newZones);
                            }}
                          >
                            <Ionicons
                              name="close-circle"
                              size={rs(24)}
                              color="#F43F5E"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    <TouchableOpacity
                      onPress={() =>
                        setEditZones([...editZones, { name: "", slots: "" }])
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: rp(6),
                        paddingVertical: rp(8),
                      }}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={rs(20)}
                        color="#7C3AED"
                      />
                      <Text
                        style={{
                          color: "#7C3AED",
                          fontSize: rs(14),
                          fontWeight: "700",
                        }}
                      >
                        Add Zone
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ gap: rp(8), marginTop: rp(4) }}>
                    {editZones.map((zone, i) => (
                      <Text key={i} style={{ fontSize: rs(15), fontWeight: "900", color: "#111827" }}>
                        {zone.name} ({zone.slots} slots)
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: rp(12) }}>
                <View>
                  <Text style={{ fontSize: rs(10), fontWeight: "800", color: "#9CA3AF", letterSpacing: rs(1.5) }}>HOTEL STATUS</Text>
                  <Text style={{ fontSize: rs(15), fontWeight: "900", color: editHotel?.is_active ? "#059669" : "#6B7280", marginTop: rp(4) }}>
                    {editHotel?.is_active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
                {editingInfo && (
                  <Switch
                    value={editHotel?.is_active}
                    onValueChange={(v) => setEditHotel(prev => ({ ...prev, is_active: v }))}
                    trackColor={{ false: "#D1D5DB", true: "#D1FAE5" }}
                    thumbColor={editHotel?.is_active ? "#059669" : "#9CA3AF"}
                  />
                )}
              </View>
            </View>
          </View>
        )}

        {/* {tab === "qr" && (
          <View style={{ padding: rp(16) }}>
            <View style={[cardBase, cardShadow, { alignItems: "center", padding: rp(28) }]}>
              <Text
                style={{
                  fontSize: rs(11),
                  fontWeight: "800",
                  color: "#1D4ED8",
                  letterSpacing: rs(3),
                  marginBottom: rp(6),
                }}
              >
                HOTEL GUEST PRE-REGISTRATION
              </Text>
              <Text
                style={{
                  fontSize: rs(18),
                  fontWeight: "900",
                  color: "#111827",
                  textAlign: "center",
                  marginBottom: rp(4),
                }}
              >
                {hotel?.name}
              </Text>
              <Text
                style={{
                  color: "#9CA3AF",
                  fontSize: rs(13),
                  textAlign: "center",
                  marginBottom: rp(24),
                }}
              >
                Place this QR at your hotel valet desk
              </Text>
              <View
                style={{
                  padding: rp(14),
                  backgroundColor: "#EFF6FF",
                  borderRadius: rp(20),
                  marginBottom: rp(20),
                }}
              >
                {hotel?.hotel_qr_token ? (
                  <QRCode
                    value={`${process.env.EXPO_PUBLIC_GUEST_URL}/hotel-register/${hotel.hotel_qr_token}`}
                    size={200}
                    color="#1D4ED8"
                  />
                ) : (
                  <View
                    style={{
                      width: rp(200),
                      height: rp(200),
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#9CA3AF" }}>QR unavailable</Text>
                  </View>
                )}
              </View>
              <Text
                style={{
                  color: "#9CA3AF",
                  fontSize: rs(11),
                  textAlign: "center",
                  marginBottom: rp(20),
                }}
              >
                Guests scan this to pre-register their vehicle
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Share.share({
                    message: `Pre-register for ${hotel?.name} hotel valet: ${process.env.EXPO_PUBLIC_GUEST_URL}/hotel-register/${hotel?.hotel_qr_token}`,
                  })
                }
                style={{
                  backgroundColor: "rgba(29,78,216,0.1)",
                  borderWidth: rp(1.5),
                  borderColor: "#1D4ED8",
                  borderRadius: rp(14),
                  paddingVertical: rp(12),
                  paddingHorizontal: rp(28),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: rp(8),
                }}
              >
                <Ionicons name="share-outline" size={18} color="#1D4ED8" />
                <Text
                  style={{
                    color: "#1D4ED8",
                    fontWeight: "900",
                    letterSpacing: rs(1.5),
                    fontSize: rs(13),
                  }}
                >
                  SHARE LINK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )} */}
      </ScrollView>



      {/* Add Special Event Modal */}
      <Modal visible={showAddEventModal} transparent animationType="slide" onRequestClose={() => setShowAddEventModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), padding: rp(24), paddingBottom: rp(24) + (insets?.bottom || 0) }}>
              <View style={{ alignItems: "center", marginBottom: rp(16) }}>
                <View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} />
              </View>
              <Text style={{ fontSize: rs(20), fontWeight: "900", color: ACCENT_COLOR, marginBottom: rp(20) }}>Add Special Event</Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={modalLabel}>EVENT NAME</Text>
                <TextInput value={newEventName} onChangeText={setNewEventName} placeholder="Wedding Reception" style={modalTextInput} />

                <Text style={modalLabel}>HOST NAME (OPTIONAL)</Text>
                <TextInput value={newEventHostName} onChangeText={setNewEventHostName} placeholder="e.g. John Doe" style={modalTextInput} />

                <Text style={modalLabel}>HOST EMAIL (OPTIONAL)</Text>
                <TextInput value={newEventHostEmail} onChangeText={setNewEventHostEmail} placeholder="e.g. host@example.com" keyboardType="email-address" autoCapitalize="none" style={modalTextInput} />

                <Text style={modalLabel}>DATE</Text>
                <TouchableOpacity
                  style={modalInput}
                  onPress={() => setShowEventDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                  <Text style={{ color: newEventDate ? "#111827" : "#9CA3AF", flex: 1, marginLeft: rp(10) }}>
                    {newEventDate || "Select date"}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>

                <View style={{ flexDirection: "row", gap: rp(12) }}>
                  <View style={{ flex: 1 }}>
                    <Text style={modalLabel}>START TIME</Text>
                    <TouchableOpacity
                      style={modalInput}
                      onPress={() => setShowEventStartTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={18} color="#7C3AED" />
                      <Text style={{ color: newEventStartTime ? "#111827" : "#9CA3AF", flex: 1, marginLeft: rp(10) }}>
                        {newEventStartTime || "Select start time"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={modalLabel}>END TIME</Text>
                    <TouchableOpacity
                      style={modalInput}
                      onPress={() => setShowEventEndTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={18} color="#7C3AED" />
                      <Text style={{ color: newEventEndTime ? "#111827" : "#9CA3AF", flex: 1, marginLeft: rp(10) }}>
                        {newEventEndTime || "Select end time"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={modalLabel}>MAX CARS</Text>
                <TextInput value={newEventMaxCars} onChangeText={setNewEventMaxCars} keyboardType="numeric" placeholder="100" style={modalTextInput} />

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: rp(8), marginBottom: rp(24) }}>
                  <Text style={{ fontSize: rs(13), fontWeight: "700", color: "#374151", flex: 1, textTransform: "uppercase" }}>ALLOW INSTANT PARK</Text>
                  <Switch
                    value={newEventAllowInstantPark}
                    onValueChange={setNewEventAllowInstantPark}
                    trackColor={{ false: "#D1D5DB", true: "#059669" }}
                    thumbColor="#ffffff"
                  />
                </View>

                <Text style={modalLabel}>GATES</Text>
                {newEventGates.map((gate, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: rp(8),
                      marginBottom: rp(8),
                    }}
                  >
                    <TextInput
                      style={[modalTextInput, { flex: 1 }]}
                      placeholder="Gate name"
                      value={gate}
                      onChangeText={(text) => {
                        const newGates = [...newEventGates];
                        newGates[index] = text;
                        setNewEventGates(newGates);
                      }}
                    />
                    {newEventGates.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          const newGates = newEventGates.filter(
                            (_, i) => i !== index
                          );
                          setNewEventGates(newGates);
                        }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={rs(24)}
                          color="#F43F5E"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setNewEventGates([...newEventGates, ""])}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: rp(6),
                    paddingVertical: rp(8),
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={rs(20)}
                    color="#7C3AED"
                  />
                  <Text
                    style={{
                      color: "#7C3AED",
                      fontSize: rs(14),
                      fontWeight: "700",
                    }}
                  >
                    Add Gate
                  </Text>
                </TouchableOpacity>

                <Text style={modalLabel}>PARKING ZONES</Text>
                {newEventZones.map((zone, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: rp(8),
                      marginBottom: rp(8),
                    }}
                  >
                    <TextInput
                      style={[modalTextInput, { flex: 1 }]}
                      placeholder="Zone name"
                      value={zone.name}
                      onChangeText={(text) => {
                        const newZones = [...newEventZones];
                        newZones[index] = { ...zone, name: text };
                        setNewEventZones(newZones);
                      }}
                    />
                    <TextInput
                      style={[modalTextInput, { width: rp(100) }]}
                      placeholder="Slots"
                      value={zone.slots}
                      onChangeText={(text) => {
                        const newZones = [...newEventZones];
                        newZones[index] = { ...zone, slots: text };
                        setNewEventZones(newZones);
                      }}
                      keyboardType="numeric"
                    />
                    {newEventZones.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          const newZones = newEventZones.filter(
                            (_, i) => i !== index
                          );
                          setNewEventZones(newZones);
                        }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={rs(24)}
                          color="#F43F5E"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() =>
                    setNewEventZones([...newEventZones, { name: "", slots: "" }])
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: rp(6),
                    paddingVertical: rp(8),
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={rs(20)}
                    color="#7C3AED"
                  />
                  <Text
                    style={{
                      color: "#7C3AED",
                      fontSize: rs(14),
                      fontWeight: "700",
                    }}
                  >
                    Add Zone
                  </Text>
                </TouchableOpacity>

                <Text style={{ fontSize: rs(11), color: "#9CA3AF", marginTop: rp(12), fontStyle: "italic" }}>
                  Venue: {hotel?.name}
                </Text>

                <TouchableOpacity
                  onPress={saveSpecialEvent}
                  disabled={savingEvent}
                  style={{ backgroundColor: ACCENT_COLOR, borderRadius: rp(16), paddingVertical: rp(16), alignItems: "center", marginTop: rp(20) }}
                >
                  {savingEvent ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>CREATE EVENT</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowAddEventModal(false);
                    setNewEventName("");
                    setNewEventGates(["Main Gate"]);
                    setNewEventZones([{ name: "Zone A", slots: "50" }]);
                  }}
                  style={{ paddingVertical: rp(12), alignItems: "center" }}
                >
                  <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>

          {showEventDatePicker && (
            <DateTimePicker
              value={newEventDate ? new Date(newEventDate) : new Date()}
              mode="date"
              minimumDate={new Date()}
              onChange={(_, d) => {
                setShowEventDatePicker(false);
                if (d) setNewEventDate(toISTDateString(d));
              }}
            />
          )}
          {showEventStartTimePicker && (
            <DateTimePicker
              value={newEventStartTime ? new Date(`2000-01-01T${newEventStartTime}:00`) : new Date()}
              mode="time"
              is24Hour
              onChange={(_, d) => {
                setShowEventStartTimePicker(false);
                if (d) {
                  const h = String(d.getHours()).padStart(2, "0");
                  const m = String(d.getMinutes()).padStart(2, "0");
                  setNewEventStartTime(`${h}:${m}`);
                }
              }}
            />
          )}
          {showEventEndTimePicker && (
            <DateTimePicker
              value={newEventEndTime ? new Date(`2000-01-01T${newEventEndTime}:00`) : new Date()}
              mode="time"
              is24Hour
              onChange={(_, d) => {
                setShowEventEndTimePicker(false);
                if (d) {
                  const h = String(d.getHours()).padStart(2, "0");
                  const m = String(d.getMinutes()).padStart(2, "0");
                  setNewEventEndTime(`${h}:${m}`);
                }
              }}
            />
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Special Event QR Modal */}
      {/* <Modal
        visible={showEventQRModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEventQRModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: rp(24) }}>
          <View style={{ backgroundColor: "#fff", borderRadius: rp(32), padding: rp(32), alignItems: "center", width: "100%", ...cardShadow }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: rp(20) }}>
              <Text style={{ fontSize: rs(11), fontWeight: "800", color: ACCENT_COLOR, letterSpacing: rs(3) }}>SPECIAL EVENT GUEST QR</Text>
              <TouchableOpacity onPress={() => setShowEventQRModal(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: rs(22), fontWeight: "900", color: "#111827", textAlign: "center" }}>{selectedEventForQR?.name}</Text>
            <Text style={{ fontSize: rs(14), fontWeight: "700", color: "#6B7280", textAlign: "center", marginTop: rp(4), marginBottom: rp(24) }}>{hotel?.name}</Text>

            <View style={{ padding: rp(14), backgroundColor: "#F5F3FF", borderRadius: rp(20), marginBottom: rp(20) }}>
              {loadingEventQR ? (
                <View style={{ width: rp(220), height: rp(220), justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator color={ACCENT_COLOR} size="large" />
                </View>
              ) : eventQRToken ? (
                <QRCode
                  value={`${process.env.EXPO_PUBLIC_GUEST_URL}/pre-register/event/${eventQRToken}`}
                  size={220}
                  color={ACCENT_COLOR}
                />
              ) : (
                <View style={{ width: rp(220), height: rp(220), justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: "#9CA3AF" }}>QR Unavailable</Text>
                </View>
              )}
            </View>

            <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginBottom: rp(24), textAlign: "center" }}>Guest scans this to pre-register their vehicle</Text>

            <TouchableOpacity
              onPress={() => {
                const url = `${process.env.EXPO_PUBLIC_GUEST_URL}/pre-register/event/${eventQRToken}`;
                Share.share({
                  message: `Pre-register for ${selectedEventForQR?.name} at ${hotel?.name}: ${url}`,
                });
              }}
              disabled={!eventQRToken}
              style={{ backgroundColor: ACCENT_COLOR, borderRadius: rp(16), paddingVertical: rp(14), width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: rp(8), opacity: eventQRToken ? 1 : 0.6 }}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>SHARE LINK</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowEventQRModal(false)} style={{ paddingVertical: rp(12), marginTop: rp(8), alignItems: "center", width: "100%" }}>
              <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal> */}
    </View>
  );
}

function InfoField({ label, value, onSave, keyboardType = "default" }) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value);

  useEffect(() => { setVal(value); }, [value]);

  if (isEditing) {
    return (
      <View style={{ marginBottom: rp(16) }}>
        <Text style={{ fontSize: rs(10), fontWeight: "800", color: ACCENT_COLOR, letterSpacing: rs(1.5) }}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(4), gap: rp(10) }}>
          <TextInput
            value={val}
            onChangeText={setVal}
            keyboardType={keyboardType}
            autoFocus
            style={{ flex: 1, backgroundColor: "#F9FAF8", borderRadius: rp(12), paddingHorizontal: rp(12), paddingVertical: rp(8), fontSize: rs(15), color: "#111827", borderWidth: rp(1), borderColor: ACCENT_COLOR }}
          />
          <TouchableOpacity
            onPress={() => {
              onSave(val);
              setIsEditing(false);
            }}
            style={{ backgroundColor: ACCENT_COLOR, width: rp(36), height: rp(36), borderRadius: rp(18), alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setVal(value); setIsEditing(false); }}>
            <Ionicons name="close-circle" size={32} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={() => setIsEditing(true)} style={{ marginBottom: rp(16) }}>
      <Text style={{ fontSize: rs(10), fontWeight: "800", color: "#9CA3AF", letterSpacing: rs(1.5) }}>{label}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: rp(4) }}>
        <Text style={{ fontSize: rs(15), fontWeight: "900", color: "#111827" }}>{value || "—"}</Text>
        <Ionicons name="pencil" size={14} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

const sectionTitle = {
  fontSize: rs(11),
  fontWeight: "800",
  color: "#6B7280",
  letterSpacing: rs(2),
  marginBottom: rp(12),
  marginTop: rp(8),
};

const modalLabel = {
  fontSize: rs(11),
  fontWeight: "800",
  color: "#6B7280",
  letterSpacing: rs(1),
  marginBottom: rp(6),
  marginTop: rp(12),
};

const modalInput = {
  borderWidth: rp(1.5),
  borderColor: "#E5E7EB",
  borderRadius: rp(12),
  paddingHorizontal: rp(14),
  paddingVertical: rp(11),
  fontSize: rs(14),
  color: "#111827",
  backgroundColor: "#F9FAFB",
  flexDirection: "row",
  alignItems: "center",
};

const modalTextInput = {
  borderWidth: rp(1.5),
  borderColor: "#E5E7EB",
  borderRadius: rp(12),
  paddingHorizontal: rp(14),
  paddingVertical: rp(11),
  fontSize: rs(14),
  color: "#111827",
  backgroundColor: "#F9FAFB",
};

const modalTitle = {
  fontSize: rs(18),
  fontWeight: "900",
  color: "#0F2044",
  marginBottom: rp(4),
};

const iconBtn = {
  backgroundColor: "rgba(255,255,255,0.15)",
  borderRadius: rp(99),
  padding: rp(8),
};






