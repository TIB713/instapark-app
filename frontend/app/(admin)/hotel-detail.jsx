import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Share,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
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

const cardBase = {
  backgroundColor: "#fff",
  borderRadius: 24,
};

export default function HotelDetail() {
  const router = useRouter();
  const { hid } = useLocalSearchParams();
  const { setCurrentEventId } = useAppStore();
  
  const [hotel, setHotel] = useState(null);
  const [tab, setTab] = useState("today");
  const [teamTab, setTeamTab] = useState("drivers");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Events state
  const [allEvents, setAllEvents] = useState([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  // New event state
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [newEventStartTime, setNewEventStartTime] = useState("18:00");
  const [newEventEndTime, setNewEventEndTime] = useState("23:00");
  const [newEventMaxCars, setNewEventMaxCars] = useState("100");

  // Team tab state
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [availableSupervisors, setAvailableSupervisors] = useState([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Info tab state (editable)
  const [editHotel, setEditHotel] = useState(null);

  const today = new Date().toISOString().split("T")[0];
  const todayEvents = allEvents
    .filter(e => e.date === today)
    .sort((a, b) => (a.status === "active" ? -1 : 1));
  const pastEvents = allEvents
    .filter(e => e.status === "closed" && e.date < today)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const fetchHotel = useCallback(async () => {
    try {
      const { data } = await api.get(`/hotels/${hid}`);
      setHotel(data);
      setEditHotel(data);
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

  const fetchAvailableMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      if (teamTab === "drivers") {
        const { data } = await api.get("/drivers");
        const assignedIds = new Set((hotel?.assigned_drivers || []).map(d => d.id));
        setAvailableDrivers((data || []).filter(d => !assignedIds.has(d.id)));
      } else {
        const { data } = await api.get("/supervisors");
        const assignedIds = new Set((hotel?.assigned_supervisors || []).map(s => s.id));
        setAvailableSupervisors((data || []).filter(s => !assignedIds.has(s.id)));
      }
    } catch (e) {
      console.error("Error fetching available members:", e);
    } finally {
      setLoadingMembers(false);
    }
  }, [teamTab, hotel]);

  const init = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchHotel(), fetchEvents()]);
    setLoading(false);
  }, [fetchHotel, fetchEvents]);

  useEffect(() => {
    init();
  }, [init]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchHotel(), fetchEvents()]);
    setRefreshing(false);
  };

  const updateHotel = async (updates) => {
    try {
      const { data } = await api.patch(`/hotels/${hid}`, updates);
      setHotel(data);
      setEditHotel(data);
    } catch (e) {
      Alert.alert("Error", "Failed to update hotel");
    }
  };

  const addMember = async (memberId) => {
    try {
      const type = teamTab === "drivers" ? "drivers" : "supervisors";
      await api.post(`/hotels/${hid}/${type}/${memberId}`);
      setShowAddMemberModal(false);
      fetchHotel();
    } catch (e) {
      Alert.alert("Error", "Failed to add member");
    }
  };

  const removeMember = (memberId) => {
    Alert.alert("Remove Member", "Are you sure you want to remove this member from the hotel?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const type = teamTab === "drivers" ? "drivers" : "supervisors";
            await api.delete(`/hotels/${hid}/${type}/${memberId}`);
            fetchHotel();
          } catch (e) {
            Alert.alert("Error", "Failed to remove member");
          }
        },
      },
    ]);
  };

  const openEvent = (event) => {
    setCurrentEventId(event.id);
    router.push("/(admin)/event-detail");
  };

  const saveSpecialEvent = async () => {
    if (!newEventName || !newEventDate) {
      Alert.alert("Required", "Name and Date are required");
      return;
    }
    setSavingEvent(true);
    try {
      await api.post(`/hotels/${hid}/events`, {
        name: newEventName.trim(),
        date: newEventDate,
        start_time: newEventStartTime,
        end_time: newEventEndTime,
        max_cars: parseInt(newEventMaxCars),
        event_type: "hotel_special",
        venue: hotel?.address,
      });
      setShowAddEventModal(false);
      setNewEventName("");
      fetchEvents();
      Alert.alert("Success", "Special event created");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to create event");
    } finally {
      setSavingEvent(false);
    }
  };

  const addSpecialEvent = () => {
    setShowAddEventModal(true);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F5F3FF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={ACCENT_COLOR} />
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
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99, padding: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
                {hotel?.name}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{hotel?.city}, {hotel?.state}</Text>
            </View>
            <TouchableOpacity
              onPress={addSpecialEvent}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="star" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>SPECIAL EVENT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Tab bar */}
      <View
        style={{
          backgroundColor: "#fff",
          flexDirection: "row",
          marginHorizontal: 16,
          marginTop: -20,
          borderRadius: 20,
          padding: 4,
          ...cardShadow,
        }}
      >
        {[
          ["today", "Today"],
          ["events", "Events"],
          ["team", "Team"],
          ["info", "Info"],
          ["qr", "QR"],
        ].map(([k, l]) => {
          return (
            <TouchableOpacity
              key={k}
              onPress={() => setTab(k)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 16,
                backgroundColor: tab === k ? ACCENT_COLOR : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 12,
                  color: tab === k ? "#fff" : "#6B7280",
                  letterSpacing: 0.5,
                }}
              >
                {l}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
        contentContainerStyle={{ paddingBottom: 100 }}
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
                  style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, ...cardShadow, marginBottom: 12 }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>{e.name}</Text>
                        <View style={{ backgroundColor: e.event_type === "hotel_daily" ? "#E0F2FE" : "#EBF5FF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
                          <Text style={{ color: e.event_type === "hotel_daily" ? "#0369A1" : ACCENT_COLOR, fontWeight: "800", fontSize: 9 }}>
                            {e.event_type === "hotel_daily" ? "AUTO DAILY" : "SPECIAL"}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Ionicons name="time-outline" size={14} color={ACCENT_COLOR} />
                          <Text style={{ color: "#6B7280", fontSize: 13, marginLeft: 4 }}>{e.start_time}—{e.end_time}</Text>
                        </View>
                        <View style={{ backgroundColor: e.status === "active" ? "#D1FAE5" : "#F3F4F6", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
                          <Text style={{ color: e.status === "active" ? "#059669" : "#6B7280", fontWeight: "800", fontSize: 10 }}>{e.status.toUpperCase()}</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
                  </View>
                  
                  <View style={{ height: 1, backgroundColor: "#F3F4F6", marginVertical: 16 }} />
                  
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Text style={{ color: "#9CA3AF", fontSize: 11, fontWeight: "700" }}>TOTAL CARS</Text>
                      <Text style={{ fontSize: 24, fontWeight: "900", color: "#111827", marginTop: 4 }}>{e.total_cars || 0}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openEvent(e)}
                      style={{ backgroundColor: ACCENT_COLOR, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, justifyContent: "center" }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>OPEN EVENT</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ backgroundColor: "#F3F4F6", borderRadius: 24, padding: 32, alignItems: "center", borderStyle: "dashed", borderWidth: 2, borderColor: "#D1D5DB" }}>
                <Text style={{ fontSize: 40 }}>🗓️</Text>
                <Text style={{ color: "#6B7280", fontWeight: "700", marginTop: 12, fontSize: 15 }}>No events today</Text>
                <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4, textAlign: "center" }}>Daily event is created automatically at midnight</Text>
              </View>
            )}
          </View>
        )}

        {tab === "events" && (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={sectionTitle}>PAST EVENTS</Text>
              <TouchableOpacity onPress={addSpecialEvent} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="add-circle" size={18} color={ACCENT_COLOR} />
                <Text style={{ color: ACCENT_COLOR, fontWeight: "800", fontSize: 13 }}>Add Special</Text>
              </TouchableOpacity>
            </View>
            {pastEvents.length > 0 ? (
              pastEvents.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => openEvent(e)}
                  style={{ backgroundColor: "#fff", borderRadius: 24, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", ...cardShadow }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>{e.name}</Text>
                    <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{e.date}</Text>
                    <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
                      <View style={{ backgroundColor: e.event_type === "hotel_daily" ? "#E0F2FE" : "#EBF5FF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
                        <Text style={{ color: e.event_type === "hotel_daily" ? "#0369A1" : ACCENT_COLOR, fontWeight: "800", fontSize: 9 }}>
                          {e.event_type === "hotel_daily" ? "AUTO DAILY" : "SPECIAL"}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                        <Text style={{ color: "#9CA3AF", fontSize: 11, marginLeft: 4 }} numberOfLines={1}>{e.venue}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{e.total_cars || 0}</Text>
                    <Text style={{ color: "#9CA3AF", fontSize: 9, fontWeight: "700" }}>CARS</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginLeft: 12 }} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ backgroundColor: "#F3F4F6", borderRadius: 24, padding: 32, alignItems: "center", borderStyle: "dashed", borderWidth: 2, borderColor: "#D1D5DB" }}>
                <Text style={{ fontSize: 40 }}>📁</Text>
                <Text style={{ color: "#6B7280", fontWeight: "700", marginTop: 12, fontSize: 15 }}>No past events yet</Text>
              </View>
            )}
          </View>
        )}

        {tab === "team" && (
          <View>
            <View style={{ backgroundColor: "#fff", flexDirection: "row", borderRadius: 20, padding: 4, marginBottom: 16, ...cardShadow }}>
              {["Drivers", "Supervisors"].map((l) => {
                const k = l.toLowerCase();
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setTeamTab(k)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 16,
                      backgroundColor: teamTab === k ? ACCENT_COLOR : "transparent",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "800", fontSize: 13, color: teamTab === k ? "#fff" : "#6B7280" }}>{l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={sectionTitle}>{teamTab.toUpperCase()}</Text>
              <TouchableOpacity
                onPress={() => {
                  fetchAvailableMembers();
                  setShowAddMemberModal(true);
                }}
                style={{ backgroundColor: ACCENT_COLOR, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>ADD {teamTab.toUpperCase().slice(0, -1)}</Text>
              </TouchableOpacity>
            </View>

            {(teamTab === "drivers" ? hotel?.assigned_drivers : hotel?.assigned_supervisors)?.map((m) => (
              <View key={m.id} style={{ backgroundColor: "#fff", borderRadius: 24, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", ...cardShadow }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT_COLOR, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>{m.name?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: 15 }}>{m.name}</Text>
                  <Text style={{ color: "#6B7280", fontSize: 11 }}>ID: {m.employee_id || "N/A"}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <Ionicons name="call-outline" size={10} color="#9CA3AF" />
                    <Text style={{ color: "#9CA3AF", fontSize: 10, marginLeft: 4 }}>{m.phone || "No phone"}</Text>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#059669", marginLeft: 10, marginRight: 4 }} />
                    <Text style={{ color: "#059669", fontSize: 10, fontWeight: "700" }}>ACTIVE</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeMember(m.id)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={20} color="#F43F5E" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {tab === "info" && (
          <View>
            <Text style={sectionTitle}>HOTEL INFORMATION</Text>
            <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, ...cardShadow }}>
              <InfoField label="HOTEL NAME" value={editHotel?.name} onSave={(v) => updateHotel({ name: v })} />
              <InfoField label="ADDRESS" value={editHotel?.address} onSave={(v) => updateHotel({ address: v })} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <InfoField label="CITY" value={editHotel?.city} onSave={(v) => updateHotel({ city: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <InfoField label="STATE" value={editHotel?.state} onSave={(v) => updateHotel({ state: v })} />
                </View>
              </View>
              <InfoField label="CONTACT PERSON" value={editHotel?.contact_person_name} onSave={(v) => updateHotel({ contact_person_name: v })} />
              <InfoField label="PHONE" value={editHotel?.contact_person_phone} onSave={(v) => updateHotel({ contact_person_phone: v })} />
              <InfoField label="EMAIL" value={editHotel?.contact_person_email} onSave={(v) => updateHotel({ contact_person_email: v })} />
              <InfoField label="TOTAL SLOTS" value={editHotel?.total_valet_slots?.toString()} keyboardType="numeric" onSave={(v) => updateHotel({ total_valet_slots: parseInt(v) })} />
              
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <InfoField label="START HOURS" value={editHotel?.operating_hours_start} onSave={(v) => updateHotel({ operating_hours_start: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <InfoField label="END HOURS" value={editHotel?.operating_hours_end} onSave={(v) => updateHotel({ operating_hours_end: v })} />
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1.5 }}>HOTEL STATUS</Text>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: editHotel?.is_active ? "#059669" : "#6B7280", marginTop: 4 }}>
                    {editHotel?.is_active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
                <Switch
                  value={editHotel?.is_active}
                  onValueChange={(v) => updateHotel({ is_active: v })}
                  trackColor={{ false: "#D1D5DB", true: "#D1FAE5" }}
                  thumbColor={editHotel?.is_active ? "#059669" : "#9CA3AF"}
                />
              </View>
            </View>
          </View>
        )}

        {tab === "qr" && (
          <View style={{ padding: 16 }}>
            <View style={[cardBase, cardShadow, { alignItems: "center", padding: 28 }]}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: "#1D4ED8",
                  letterSpacing: 3,
                  marginBottom: 6,
                }}
              >
                HOTEL GUEST PRE-REGISTRATION
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "900",
                  color: "#111827",
                  textAlign: "center",
                  marginBottom: 4,
                }}
              >
                {hotel?.name}
              </Text>
              <Text
                style={{
                  color: "#9CA3AF",
                  fontSize: 13,
                  textAlign: "center",
                  marginBottom: 24,
                }}
              >
                Place this QR at your hotel valet desk
              </Text>
              <View
                style={{
                  padding: 14,
                  backgroundColor: "#EFF6FF",
                  borderRadius: 20,
                  marginBottom: 20,
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
                      width: 200,
                      height: 200,
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
                  fontSize: 11,
                  textAlign: "center",
                  marginBottom: 20,
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
                  borderWidth: 1.5,
                  borderColor: "#1D4ED8",
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 28,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Ionicons name="share-outline" size={18} color="#1D4ED8" />
                <Text
                  style={{
                    color: "#1D4ED8",
                    fontWeight: "900",
                    letterSpacing: 1.5,
                    fontSize: 13,
                  }}
                >
                  SHARE LINK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Member Modal */}
      <Modal visible={showAddMemberModal} transparent animationType="fade" onRequestClose={() => setShowAddMemberModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 32, padding: 24, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: ACCENT_COLOR }}>Add {teamTab === "drivers" ? "Driver" : "Supervisor"}</Text>
              <TouchableOpacity onPress={() => setShowAddMemberModal(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {loadingMembers ? (
              <ActivityIndicator color={ACCENT_COLOR} style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(teamTab === "drivers" ? availableDrivers : availableSupervisors).map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => addMember(m.id)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontWeight: "800", color: ACCENT_COLOR }}>{m.name?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontWeight: "800", color: "#111827" }}>{m.name}</Text>
                      <Text style={{ fontSize: 11, color: "#6B7280" }}>{m.employee_id || m.email}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color={ACCENT_COLOR} />
                  </TouchableOpacity>
                ))}
                {(teamTab === "drivers" ? availableDrivers : availableSupervisors).length === 0 && (
                  <View style={{ alignItems: "center", paddingVertical: 40 }}>
                    <Text style={{ color: "#9CA3AF", fontSize: 13 }}>No available {teamTab} found</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Special Event Modal */}
      <Modal visible={showAddEventModal} transparent animationType="slide" onRequestClose={() => setShowAddEventModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24 }}>
              <View style={{ alignItems: "center", marginBottom: 16 }}>
                <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: "900", color: ACCENT_COLOR, marginBottom: 20 }}>Add Special Event</Text>
              
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={modalLabel}>EVENT NAME</Text>
                <TextInput value={newEventName} onChangeText={setNewEventName} placeholder="Wedding Reception" style={modalInput} />

                <Text style={modalLabel}>DATE (YYYY-MM-DD)</Text>
                <TextInput value={newEventDate} onChangeText={setNewEventDate} placeholder="2026-06-15" style={modalInput} />

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={modalLabel}>START TIME</Text>
                    <TextInput value={newEventStartTime} onChangeText={setNewEventStartTime} placeholder="18:00" style={modalInput} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={modalLabel}>END TIME</Text>
                    <TextInput value={newEventEndTime} onChangeText={setNewEventEndTime} placeholder="23:00" style={modalInput} />
                  </View>
                </View>

                <Text style={modalLabel}>MAX CARS</Text>
                <TextInput value={newEventMaxCars} onChangeText={setNewEventMaxCars} keyboardType="numeric" placeholder="100" style={modalInput} />

                <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 12, fontStyle: "italic" }}>
                  Venue: {hotel?.address}
                </Text>

                <TouchableOpacity
                  onPress={saveSpecialEvent}
                  disabled={savingEvent}
                  style={{ backgroundColor: ACCENT_COLOR, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 20 }}
                >
                  {savingEvent ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>CREATE EVENT</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowAddEventModal(false)} style={{ paddingVertical: 12, alignItems: "center" }}>
                  <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function InfoField({ label, value, onSave, keyboardType = "default" }) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value);

  useEffect(() => { setVal(value); }, [value]);

  if (isEditing) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 10, fontWeight: "800", color: ACCENT_COLOR, letterSpacing: 1.5 }}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 10 }}>
          <TextInput
            value={val}
            onChangeText={setVal}
            keyboardType={keyboardType}
            autoFocus
            style={{ flex: 1, backgroundColor: "#F9FAF8", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: "#111827", borderWidth: 1, borderColor: ACCENT_COLOR }}
          />
          <TouchableOpacity
            onPress={() => {
              onSave(val);
              setIsEditing(false);
            }}
            style={{ backgroundColor: ACCENT_COLOR, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
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
    <TouchableOpacity onPress={() => setIsEditing(true)} style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 10, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1.5 }}>{label}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: "900", color: "#111827" }}>{value || "—"}</Text>
        <Ionicons name="pencil" size={14} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

const sectionTitle = {
  fontSize: 11,
  fontWeight: "800",
  color: "#6B7280",
  letterSpacing: 2,
  marginBottom: 12,
  marginTop: 8,
};

const modalLabel = {
  fontSize: 11,
  fontWeight: "800",
  color: "#6B7280",
  letterSpacing: 1,
  marginBottom: 6,
  marginTop: 12,
};

const modalInput = {
  borderWidth: 1.5,
  borderColor: "#E5E7EB",
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 11,
  fontSize: 14,
  color: "#111827",
  backgroundColor: "#F9FAFB",
};

const modalTitle = {
  fontSize: 18,
  fontWeight: "900",
  color: "#0F2044",
  marginBottom: 4,
};

const iconBtn = {
  backgroundColor: "rgba(255,255,255,0.15)",
  borderRadius: 99,
  padding: 8,
};
