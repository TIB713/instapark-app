import { confirmDialog } from "../../../lib/confirmDialog";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState, useCallback } from "react";
import { rs, rp } from "../../../utils/responsive";
import { fmtDateTime, todayIST, toISTDateString } from "../../../utils/time";
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
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import CityStatePicker from "../../../components/CityStatePicker";
import { State } from "country-state-city";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";

import { theme } from "../../../utils/theme";
import { Screen, TopBar, Card, Btn, StatusPill } from "../../../components/valet/ui";
import { SectionHead } from "../../../components/admin/SectionHead";
import { StatCard } from "../../../components/admin/StatCard";
import { Hero } from "../../../components/admin/Hero";

const generateTempPassword = () => Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "1!";

function InfoRow({ label, value, editing, onChange, keyboardType = "default" }) {
  if (editing) {
    return (
      <View style={{ marginBottom: rp(theme.spacing.md) }}>
        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.caption), fontWeight: theme.fontWeight.bold, color: theme.colors.primary, letterSpacing: rs(1.5), textTransform: "uppercase" }}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          style={{ fontFamily: theme.fontFamily.regular, marginTop: rp(4), backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(theme.radius.md), paddingHorizontal: rp(theme.spacing.sm), paddingVertical: rp(8), fontSize: rs(theme.fontSize.body), color: theme.colors.textPrimary, borderWidth: rp(1), borderColor: theme.colors.primary }}
        />
      </View>
    );
  }
  return (
    <View style={{ marginBottom: rp(theme.spacing.md) }}>
      <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.caption), fontWeight: theme.fontWeight.bold, color: theme.colors.textSecondary, letterSpacing: rs(1.5), textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.body), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, marginTop: rp(4) }}>{value || "—"}</Text>
    </View>
  );
}

export default function HotelDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();

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
    router.push("/(admin)/(tabs)/event-detail");
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
      <Screen scroll={false}>
        <Hero eyebrow="Hotel" title="Loading..." onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Hero
        eyebrow="Hotel"
        title={hotel?.name || "Loading..."}
        onBack={() => router.back()}
        rightAction={{ icon: "pencil", onPress: () => { setTab("info"); setEditingInfo(!editingInfo); }, tone: "accent" }}
        badges={[
          hotel?.city ? { label: `${hotel.city}, ${hotel.state}`, tone: "primary" } : null,
          { label: hotel?.is_active ? "ACTIVE" : "INACTIVE", tone: hotel?.is_active ? "primary" : "warning" }
        ].filter(Boolean)}
        stats={[
          { value: hotel?.total_valet_slots || 0, label: "SLOTS" },
          { value: (hotel?.gates || []).length, label: "GATES" },
          { value: allEvents.length, label: "EVENTS" },
          { value: hotel?.gate_timer_minutes ? `${hotel.gate_timer_minutes}m` : "5m", label: "GATE WAIT" }
        ]}
      />

      {/* Tab bar */}
      <View
        style={{
          backgroundColor: theme.colors.surface,
          flexDirection: "row",
          marginHorizontal: rp(theme.spacing.lg),
          marginTop: -rp(22),
          borderRadius: rp(theme.radius.pill),
          padding: rp(4),
          shadowColor: theme.colors.border,
          shadowOpacity: 0.1,
          shadowRadius: rp(8),
          shadowOffset: { width: 0, height: rp(2) },
          elevation: 2,
          zIndex: 10,
        }}
      >
        {[
          ["today", "Today"],
          ["events", "Events"],
          ["team", "Team"],
          ["info", "Info"],
        ].map(([k, l]) => {
          return (
            <TouchableOpacity
              key={k}
              onPress={() => setTab(k)}
              style={{
                flex: 1,
                paddingVertical: rp(10),
                borderRadius: rp(theme.radius.pill),
                backgroundColor: tab === k ? theme.colors.primary : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold,
                  fontSize: rs(theme.fontSize.caption),
                  color: tab === k ? theme.colors.surface : theme.colors.textMuted,
                  letterSpacing: rs(0.5),
                  textTransform: "uppercase"
                }}
              >
                {l}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: rp(theme.spacing.lg), paddingTop: rp(theme.spacing.md) }}
        contentContainerStyle={{ paddingBottom: rp(100) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {tab === "today" && (
          <View>
            <SectionHead title="TODAY'S OPERATIONS" />
            {todayEvents.length > 0 ? (
              todayEvents.map((e) => (
                <Card
                  key={e.id}
                  onPress={() => openEvent(e)}
                  style={{ marginBottom: rp(theme.spacing.md) }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: rp(8) }}>
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.subtitle), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary }}>{e.name}</Text>
                        <View style={{ backgroundColor: e.event_type === "hotel_daily" ? theme.colors.infoLight : theme.colors.primaryLight, paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(theme.radius.pill) }}>
                          <Text style={{ fontFamily: theme.fontFamily.bold, color: e.event_type === "hotel_daily" ? theme.colors.info : theme.colors.primary, fontWeight: theme.fontWeight.bold, fontSize: rs(9), textTransform: "uppercase" }}>
                            {e.event_type === "hotel_daily" ? "AUTO DAILY" : "SPECIAL"}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(8), gap: rp(12) }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Ionicons name="time-outline" size={rs(14)} color={theme.colors.primary} />
                          <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.body), marginLeft: rp(4) }}>{e.start_time}—{e.end_time}</Text>
                        </View>
                        <StatusPill status={e.status} />
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={rs(24)} color={theme.colors.textMuted} />
                  </View>

                  <View style={{ height: rp(1), backgroundColor: theme.colors.border, marginVertical: rp(theme.spacing.md) }} />

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textMuted, fontSize: rs(theme.fontSize.caption), fontWeight: theme.fontWeight.bold }}>TOTAL CARS</Text>
                      <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: rs(24), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, marginTop: rp(4) }}>{e.total_cars || 0}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openEvent(e)}
                      style={{ backgroundColor: theme.colors.primary, paddingHorizontal: rp(theme.spacing.lg), paddingVertical: rp(theme.spacing.sm), borderRadius: rp(theme.radius.md), justifyContent: "center" }}
                    >
                      <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.body) }}>OPEN EVENT</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            ) : (
              <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.xxxl), alignItems: "center", borderStyle: "dashed", borderWidth: rp(2), borderColor: theme.colors.border }}>
                <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(40) }}>🗓️</Text>
                <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.bold, marginTop: rp(12), fontSize: rs(theme.fontSize.bodyLarge) }}>No events today</Text>
                <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(theme.fontSize.caption), marginTop: rp(4), textAlign: "center" }}>Daily event is created automatically at midnight</Text>
              </View>
            )}
          </View>
        )}

        {tab === "events" && (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(theme.spacing.md) }}>
              <SectionHead title="PAST EVENTS" />
              <TouchableOpacity onPress={addSpecialEvent} style={{ flexDirection: "row", alignItems: "center", gap: rp(4) }}>
                <Ionicons name="add-circle" size={rs(18)} color={theme.colors.primary} />
                <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.primary, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.body) }}>Add Special</Text>
              </TouchableOpacity>
            </View>
            {pastEvents.length > 0 ? (
              pastEvents.map((e) => (
                <Card
                  key={e.id}
                  onPress={() => openEvent(e)}
                  style={{ marginBottom: rp(theme.spacing.md), flexDirection: "row", alignItems: "center" }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, fontSize: rs(theme.fontSize.bodyLarge) }}>{e.name}</Text>
                    <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.caption), marginTop: rp(2) }}>{e.date}</Text>
                    <View style={{ flexDirection: "row", marginTop: rp(8), gap: rp(8), alignItems: "center" }}>
                      <View style={{ backgroundColor: e.event_type === "hotel_daily" ? theme.colors.infoLight : theme.colors.primaryLight, paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(theme.radius.pill) }}>
                        <Text style={{ fontFamily: theme.fontFamily.bold, color: e.event_type === "hotel_daily" ? theme.colors.info : theme.colors.primary, fontWeight: theme.fontWeight.bold, fontSize: rs(9), textTransform: "uppercase" }}>
                          {e.event_type === "hotel_daily" ? "AUTO DAILY" : "SPECIAL"}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="location-outline" size={rs(12)} color={theme.colors.textMuted} />
                        <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(theme.fontSize.caption), marginLeft: rp(4) }} numberOfLines={1}>{e.venue}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, fontSize: rs(18) }}>{e.total_cars || 0}</Text>
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textMuted, fontSize: rs(9), fontWeight: theme.fontWeight.bold }}>CARS</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={rs(20)} color={theme.colors.textMuted} style={{ marginLeft: rp(theme.spacing.sm) }} />
                </Card>
              ))
            ) : (
              <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.xxxl), alignItems: "center", borderStyle: "dashed", borderWidth: rp(2), borderColor: theme.colors.border }}>
                <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(40) }}>📁</Text>
                <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.bold, marginTop: rp(12), fontSize: rs(theme.fontSize.bodyLarge) }}>No past events yet</Text>
              </View>
            )}
          </View>
        )}

        {tab === "team" && (
          <View>
            <View style={{ backgroundColor: theme.colors.surface, flexDirection: "row", borderRadius: rp(theme.radius.md), padding: rp(4), marginBottom: rp(theme.spacing.md), borderWidth: rp(1), borderColor: theme.colors.border }}>
              {["Drivers", "Supervisors"].map((l) => {
                const k = l.toLowerCase();
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setTeamTab(k)}
                    style={{
                      flex: 1,
                      paddingVertical: rp(10),
                      borderRadius: rp(theme.radius.sm),
                      backgroundColor: teamTab === k ? theme.colors.primary : "transparent",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.body), color: teamTab === k ? theme.colors.surface : theme.colors.textSecondary }}>{l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ marginBottom: rp(theme.spacing.md) }}>
              <SectionHead title={teamTab.toUpperCase()} />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(theme.radius.md), paddingHorizontal: rp(theme.spacing.sm), marginBottom: rp(theme.spacing.md) }}>
              <Ionicons name="search-outline" size={rs(18)} color={theme.colors.textMuted} />
              <TextInput
                value={teamSearch}
                onChangeText={setTeamSearch}
                placeholder={teamTab === "drivers" ? "Search drivers..." : "Search supervisors..."}
                placeholderTextColor={theme.colors.textMuted}
                style={{ fontFamily: theme.fontFamily.regular, flex: 1, paddingVertical: rp(10), paddingHorizontal: rp(8), fontSize: rs(theme.fontSize.body), color: theme.colors.textPrimary }}
              />
            </View>

            {(teamTab === "drivers" ? sortedDrivers : sortedSupervisors).map((m) => {
              const isAssigned = (teamTab === "drivers" ? assignedDriverIds : assignedSupervisorIds).has(m.id);
              return (
                <Card key={m.id} style={{ marginBottom: rp(theme.spacing.sm), flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: rp(44), height: rp(44), borderRadius: rp(22), backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge) }}>{m.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: rp(theme.spacing.md) }}>
                    <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, fontSize: rs(theme.fontSize.bodyLarge) }}>{m.name}</Text>
                    <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.caption) }}>ID: {m.employee_id || "N/A"}</Text>
                    {isAssigned && (
                      <View style={{ marginTop: rp(4), flexDirection: "row", alignItems: "center" }}>
                        <View style={{ backgroundColor: theme.colors.successLight, paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(theme.radius.sm) }}>
                          <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.success, fontSize: rs(10), fontWeight: theme.fontWeight.bold }}>ASSIGNED</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  {isAssigned ? (
                    <TouchableOpacity onPress={() => removeMember(m.id)} style={{ padding: rp(8) }}>
                      <Ionicons name="remove-circle-outline" size={rs(24)} color={theme.colors.danger} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => addMember(m.id)} style={{ padding: rp(8) }}>
                      <Ionicons name="add-circle-outline" size={rs(24)} color={theme.colors.success} />
                    </TouchableOpacity>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {tab === "info" && (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(theme.spacing.md) }}>
              <SectionHead title="HOTEL INFORMATION" />
              {editingInfo ? (
                <View style={{ flexDirection: "row", gap: rp(8) }}>
                  <TouchableOpacity
                    onPress={() => { setEditHotel(hotel); setEditGates(hotel.gates || [""]); setEditZones(hotel.zones?.length ? hotel.zones : [{ name: "", slots: "" }]); setEditingInfo(false); }}
                    style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(theme.radius.sm), backgroundColor: theme.colors.surfaceAlt }}
                  >
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.caption) }}>CANCEL</Text>
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
                        is_active: editHotel.is_active,
                        gates: editGates.filter(g => g.trim()),
                        zones: editZones.map(z => ({ name: z.name.trim(), slots: parseInt(z.slots) || 0 })).filter(z => z.name),
                      });
                      setEditingInfo(false);
                    }}
                    style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(theme.radius.sm), backgroundColor: theme.colors.primary }}
                  >
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.caption) }}>SAVE</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setEditingInfo(true)}
                  style={{ flexDirection: "row", alignItems: "center", gap: rp(4), paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(theme.radius.sm), backgroundColor: theme.colors.surfaceAlt }}
                >
                  <Ionicons name="pencil" size={rs(14)} color={theme.colors.primary} />
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.primary, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.caption) }}>EDIT</Text>
                </TouchableOpacity>
              )}
            </View>
            <Card>
              <InfoRow label="HOTEL NAME" value={editHotel?.name} editing={editingInfo} onChange={(v) => setEditHotel(prev => ({ ...prev, name: v }))} />
              <InfoRow label="ADDRESS" value={editHotel?.address} editing={editingInfo} onChange={(v) => setEditHotel(prev => ({ ...prev, address: v }))} />
              <View style={{ marginBottom: rp(theme.spacing.md) }}>
                <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.caption), fontWeight: theme.fontWeight.bold, color: theme.colors.textMuted, letterSpacing: rs(1.5), textTransform: "uppercase", marginBottom: rp(8) }}>STATE & CITY</Text>
                {editingInfo ? (
                  <CityStatePicker
                    state={State.getStatesOfCountry("IN").find(s => s.name === editHotel?.state)?.isoCode || editHotel?.state}
                    city={editHotel?.city}
                    onStateChange={val => setEditHotel(prev => ({ ...prev, state: State.getStatesOfCountry("IN").find(s => s.isoCode === val)?.name || val, city: "" }))}
                    onCityChange={val => setEditHotel(prev => ({ ...prev, city: val }))}
                  />
                ) : (
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.body), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, marginTop: rp(4) }}>
                    {editHotel?.city}, {editHotel?.state}
                  </Text>
                )}
              </View>
              <InfoRow label="CONTACT PERSON" value={editHotel?.contact_person_name} editing={editingInfo} onChange={(v) => setEditHotel(prev => ({ ...prev, contact_person_name: v }))} />
              <InfoRow label="PHONE" value={editHotel?.contact_person_phone} editing={editingInfo} onChange={(v) => setEditHotel(prev => ({ ...prev, contact_person_phone: v }))} />
              <InfoRow label="EMAIL" value={editHotel?.contact_person_email} editing={editingInfo} onChange={(v) => setEditHotel(prev => ({ ...prev, contact_person_email: v }))} />
              <InfoRow label="TOTAL SLOTS" value={editHotel?.total_valet_slots?.toString()} editing={editingInfo} keyboardType="numeric" onChange={(v) => setEditHotel(prev => ({ ...prev, total_valet_slots: v }))} />
              <InfoRow label="GATE WAIT TIMER (MIN)" value={editHotel?.gate_timer_minutes?.toString()} editing={editingInfo} keyboardType="numeric" onChange={(v) => setEditHotel(prev => ({ ...prev, gate_timer_minutes: v }))} />

              {/* Gates */}
              <View style={{ marginTop: rp(theme.spacing.md) }}>
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
                          style={[modalInput, { fontFamily: theme.fontFamily.regular, flex: 1, marginBottom: 0 }]}
                          placeholder="Gate name"
                          placeholderTextColor={theme.colors.textMuted}
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
                              color={theme.colors.danger}
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
                        color={theme.colors.primary}
                      />
                      <Text
                        style={{
                          fontFamily: theme.fontFamily.bold, color: theme.colors.primary,
                          fontSize: rs(theme.fontSize.body),
                          fontWeight: theme.fontWeight.bold,
                        }}
                      >
                        Add Gate
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ gap: rp(8), marginTop: rp(4) }}>
                    {editGates.map((gate, i) => (
                      <Text key={i} style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.body), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary }}>{gate}</Text>
                    ))}
                  </View>
                )}
              </View>

              {/* Parking Zones */}
              <View style={{ marginTop: rp(theme.spacing.md) }}>
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
                          style={[modalInput, { fontFamily: theme.fontFamily.regular, flex: 1, marginBottom: 0 }]}
                          placeholder="Zone name"
                          placeholderTextColor={theme.colors.textMuted}
                          value={zone.name}
                          onChangeText={(text) => {
                            const newZones = [...editZones];
                            newZones[index] = { ...zone, name: text };
                            setEditZones(newZones);
                          }}
                        />
                        <TextInput
                          style={[modalInput, { fontFamily: theme.fontFamily.regular, width: rp(100), marginBottom: 0 }]}
                          placeholder="Slots"
                          placeholderTextColor={theme.colors.textMuted}
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
                              color={theme.colors.danger}
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
                        color={theme.colors.primary}
                      />
                      <Text
                        style={{
                          fontFamily: theme.fontFamily.bold, color: theme.colors.primary,
                          fontSize: rs(theme.fontSize.body),
                          fontWeight: theme.fontWeight.bold,
                        }}
                      >
                        Add Zone
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ gap: rp(8), marginTop: rp(4) }}>
                    {editZones.map((zone, i) => (
                      <Text key={i} style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.body), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary }}>
                        {zone.name} ({zone.slots} slots)
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: rp(theme.spacing.lg) }}>
                <View>
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.caption), fontWeight: theme.fontWeight.bold, color: theme.colors.textMuted, letterSpacing: rs(1.5), textTransform: "uppercase" }}>HOTEL STATUS</Text>
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.body), fontWeight: theme.fontWeight.bold, color: editHotel?.is_active ? theme.colors.success : theme.colors.textSecondary, marginTop: rp(4) }}>
                    {editHotel?.is_active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
                {editingInfo && (
                  <Switch
                    value={editHotel?.is_active}
                    onValueChange={(v) => setEditHotel(prev => ({ ...prev, is_active: v }))}
                    trackColor={{ false: theme.colors.border, true: theme.colors.successLight }}
                    thumbColor={editHotel?.is_active ? theme.colors.success : theme.colors.textMuted}
                  />
                )}
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Add Special Event Modal */}
      {showAddEventModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
              <View style={{ backgroundColor: theme.colors.surfaceAlt, borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), maxHeight: "92%", paddingBottom: rp(theme.spacing.lg) + (insets?.bottom || 0) + tabBarHeight }}>
                <View
                  style={{
                    backgroundColor: theme.colors.primary,
                    borderTopLeftRadius: rp(36),
                    borderTopRightRadius: rp(36),
                    paddingHorizontal: rp(theme.spacing.lg),
                    paddingTop: rp(theme.spacing.md),
                    paddingBottom: rp(theme.spacing.lg),
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddEventModal(false);
                      setNewEventName("");
                      setNewEventHostName("");
                      setNewEventHostEmail("");
                      setNewEventGates(["Main Gate"]);
                      setNewEventZones([{ name: "Zone A", slots: "50" }]);
                    }}
                    style={{ padding: rp(8), marginLeft: -rp(8) }}
                  >
                    <Ionicons name="close" size={rs(24)} color={theme.colors.surface} />
                  </TouchableOpacity>
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontSize: rs(20), fontWeight: theme.fontWeight.bold, marginLeft: rp(12) }}>Add Special Event</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: rp(theme.spacing.lg) }} contentContainerStyle={{ paddingTop: rp(theme.spacing.lg) }}>
                  <Text style={modalLabel}>EVENT NAME</Text>
                  <TextInput value={newEventName} onChangeText={setNewEventName} placeholder="Wedding Reception" placeholderTextColor={theme.colors.textMuted} style={modalInput} />

                  <Text style={modalLabel}>HOST NAME (OPTIONAL)</Text>
                  <TextInput value={newEventHostName} onChangeText={setNewEventHostName} placeholder="e.g. John Doe" placeholderTextColor={theme.colors.textMuted} style={modalInput} />

                  <Text style={modalLabel}>HOST EMAIL (OPTIONAL)</Text>
                  <TextInput value={newEventHostEmail} onChangeText={setNewEventHostEmail} placeholder="e.g. host@example.com" placeholderTextColor={theme.colors.textMuted} keyboardType="email-address" autoCapitalize="none" style={modalInput} />

                  <Text style={modalLabel}>DATE</Text>
                  <TouchableOpacity
                    style={modalInput}
                    onPress={() => setShowEventDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={rs(18)} color={theme.colors.primary} />
                    <Text style={{ fontFamily: theme.fontFamily.regular, color: newEventDate ? theme.colors.textPrimary : theme.colors.textMuted, flex: 1, marginLeft: rp(10) }}>
                      {newEventDate || "Select date"}
                    </Text>
                    <Ionicons name="chevron-forward" size={rs(16)} color={theme.colors.textMuted} />
                  </TouchableOpacity>

                  <View style={{ flexDirection: "row", gap: rp(12) }}>
                    <View style={{ flex: 1 }}>
                      <Text style={modalLabel}>START TIME</Text>
                      <TouchableOpacity
                        style={modalInput}
                        onPress={() => setShowEventStartTimePicker(true)}
                      >
                        <Ionicons name="time-outline" size={rs(18)} color={theme.colors.primary} />
                        <Text style={{ fontFamily: theme.fontFamily.regular, color: newEventStartTime ? theme.colors.textPrimary : theme.colors.textMuted, flex: 1, marginLeft: rp(10) }}>
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
                        <Ionicons name="time-outline" size={rs(18)} color={theme.colors.primary} />
                        <Text style={{ fontFamily: theme.fontFamily.regular, color: newEventEndTime ? theme.colors.textPrimary : theme.colors.textMuted, flex: 1, marginLeft: rp(10) }}>
                          {newEventEndTime || "Select end time"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={modalLabel}>MAX CARS</Text>
                  <TextInput value={newEventMaxCars} onChangeText={setNewEventMaxCars} keyboardType="numeric" placeholder="100" placeholderTextColor={theme.colors.textMuted} style={modalInput} />

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
                        style={[modalInput, { fontFamily: theme.fontFamily.regular, flex: 1, marginBottom: 0 }]}
                        placeholder="Gate name"
                        placeholderTextColor={theme.colors.textMuted}
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
                            color={theme.colors.danger}
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
                      color={theme.colors.primary}
                    />
                    <Text
                      style={{
                        fontFamily: theme.fontFamily.bold, color: theme.colors.primary,
                        fontSize: rs(theme.fontSize.body),
                        fontWeight: theme.fontWeight.bold,
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
                        style={[modalInput, { fontFamily: theme.fontFamily.regular, flex: 1, marginBottom: 0 }]}
                        placeholder="Zone name"
                        placeholderTextColor={theme.colors.textMuted}
                        value={zone.name}
                        onChangeText={(text) => {
                          const newZones = [...newEventZones];
                          newZones[index] = { ...zone, name: text };
                          setNewEventZones(newZones);
                        }}
                      />
                      <TextInput
                        style={[modalInput, { fontFamily: theme.fontFamily.regular, width: rp(100), marginBottom: 0 }]}
                        placeholder="Slots"
                        placeholderTextColor={theme.colors.textMuted}
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
                            color={theme.colors.danger}
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
                      color={theme.colors.primary}
                    />
                    <Text
                      style={{
                        fontFamily: theme.fontFamily.bold, color: theme.colors.primary,
                        fontSize: rs(theme.fontSize.body),
                        fontWeight: theme.fontWeight.bold,
                      }}
                    >
                      Add Zone
                    </Text>
                  </TouchableOpacity>

                  <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(theme.fontSize.caption), color: theme.colors.textMuted, marginTop: rp(12), fontStyle: "italic" }}>
                    Venue: {hotel?.name}
                  </Text>

                  <View style={{ marginTop: rp(theme.spacing.lg) }}>
                    <Btn variant="primary" onPress={saveSpecialEvent} disabled={savingEvent}>
                      {savingEvent ? "CREATING..." : "CREATE EVENT"}
                    </Btn>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setShowAddEventModal(false);
                      setNewEventName("");
                      setNewEventGates(["Main Gate"]);
                      setNewEventZones([{ name: "Zone A", slots: "50" }]);
                    }}
                    style={{ paddingVertical: rp(12), alignItems: "center" }}
                  >
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.bold }}>Cancel</Text>
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
  fontFamily: theme.fontFamily.regular, borderWidth: rp(1),
  borderColor: theme.colors.border,
  borderRadius: rp(theme.radius.md),
  paddingHorizontal: rp(theme.spacing.md),
  paddingVertical: rp(11),
  fontSize: rs(theme.fontSize.body),
  color: theme.colors.textPrimary,
  backgroundColor: theme.colors.surfaceAlt,
  flexDirection: "row",
  alignItems: "center",
  marginBottom: rp(theme.spacing.md),
};

const modalTextInput = {
  fontFamily: theme.fontFamily.regular, borderWidth: rp(1),
  borderColor: theme.colors.border,
  borderRadius: rp(theme.radius.md),
  paddingHorizontal: rp(theme.spacing.md),
  paddingVertical: rp(11),
  fontSize: rs(theme.fontSize.body),
  color: theme.colors.textPrimary,
  backgroundColor: theme.colors.surfaceAlt,
};

const modalTitle = {
  fontFamily: theme.fontFamily.bold, fontSize: rs(theme.fontSize.subtitle),
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.textPrimary,
  marginBottom: rp(4),
};
