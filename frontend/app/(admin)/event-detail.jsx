import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { formatDistanceToNow } from "date-fns";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { connectWS, disconnectWS } from "../../lib/websocket";

const STATUS_CONFIG = {
  PRE_REGISTERED: { color: "#8B5CF6", label: "Pre-Registered" },
  CHECKED_IN: { color: "#0EA5E9", label: "Checked In" },
  PARKED: { color: "#059669", label: "Parked" },
  RETRIEVAL_REQUESTED: { color: "#F59E0B", label: "Requested" },
  BEING_FETCHED: { color: "#F97316", label: "Fetching" },
  DELIVERED: { color: "#9CA3AF", label: "Delivered" },
};

const FILTERS = ["ALL", "PRE_REGISTERED", "CHECKED_IN", "PARKED", "RETRIEVAL_REQUESTED", "BEING_FETCHED", "DELIVERED"];

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export default function EventDetail() {
  const router = useRouter();
  const { currentEventId } = useAppStore();
  const [event, setEvent] = useState(null);
  const [tab, setTab] = useState("cars");
  const [slotTab, setSlotTab] = useState("parking");
  const [cars, setCars] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [stats, setStats] = useState(null);
  const [keys, setKeys] = useState([]);
  const [keyStats, setKeyStats] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedCar, setSelectedCar] = useState(null);
  const [showCarModal, setShowCarModal] = useState(false);
  const [carPhotos, setCarPhotos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [slots, setSlots] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentCar, setIncidentCar] = useState(null);
  const [incidentDriver, setIncidentDriver] = useState(null);
  const [incidentDesc, setIncidentDesc] = useState("");
  const [incidentPhoto, setIncidentPhoto] = useState(null);
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [incidentCarSearch, setIncidentCarSearch] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const [supervisors, setSupervisors] = useState([]);
  const [assigningSupervisorId, setAssigningSupervisorId] = useState(null);
  const [showAddSupervisorModal, setShowAddSupervisorModal] = useState(false);
  const [supName, setSupName] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supPassword, setSupPassword] = useState("");
  const [savingSupervisor, setSavingSupervisor] = useState(false);

  const [employeeTab, setEmployeeTab] = useState("supervisors");

  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}`);
      setEvent(data);
    } catch {}
  }, [currentEventId]);

  const fetchSlots = useCallback(async () => {
    try {
      const { data } = await api.get(`/slots/event/${currentEventId}`);
      setSlots(data || []);
    } catch {}
  }, [currentEventId]);

  const fetchCars = useCallback(async () => {
    try {
      const { data } = await api.get(`/cars/event/${currentEventId}`);
      setCars(data || []);
    } catch {}
  }, [currentEventId]);

  const fetchDrivers = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/drivers`);
      setDrivers(data || []);
    } catch {}
  }, [currentEventId]);

  const fetchSupervisors = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/supervisors`);
      setSupervisors(data || []);
    } catch {}
  }, [currentEventId]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/stats`);
      setStats(data);
    } catch {}
  }, [currentEventId]);

  const fetchIncidents = useCallback(async () => {
    try {
      const { data } = await api.get(`/incidents/event/${currentEventId}`);
      setIncidents(data || []);
    } catch {}
  }, [currentEventId]);

  const fetchKeys = useCallback(async () => {
    try {
      const { data } = await api.get(
        `/events/${currentEventId}/keys`
      );
      setKeys(data.keys || []);
      setKeyStats(data);
    } catch {}
  }, [currentEventId]);

  const submitIncident = async () => {
    if (!incidentCar) {
      Alert.alert("Required", "Please select a car");
      return;
    }
    if (!incidentDesc.trim()) {
      Alert.alert("Required", "Please add a description");
      return;
    }
    setSubmittingIncident(true);
    try {
      let photoUrl = null;
      if (incidentPhoto) {
        const formData = new FormData();
        formData.append("file", {
          uri: incidentPhoto,
          type: "image/jpeg",
          name: "incident.jpg",
        });
        formData.append("folder", `incidents/${currentEventId}`);
        const up = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        photoUrl = up.data.url;
      }
      await api.post("/incidents", {
        event_id: currentEventId,
        car_id: incidentCar.id,
        driver_id: incidentDriver?.id || null,
        description: incidentDesc.trim(),
        photo_url: photoUrl,
      });
      setShowIncidentModal(false);
      setIncidentCar(null);
      setIncidentDriver(null);
      setIncidentDesc("");
      setIncidentPhoto(null);
      setIncidentCarSearch("");
      fetchIncidents();
      Alert.alert("Saved", "Incident report saved successfully");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to save");
    } finally {
      setSubmittingIncident(false);
    }
  };

  const pickIncidentPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.75,
    });
    if (!result.canceled) setIncidentPhoto(result.assets[0].uri);
  };

  useEffect(() => {
    if (!currentEventId) return;
    // Run all fetches in parallel instead of sequentially
    Promise.all([fetchEvent(), fetchCars(), fetchDrivers(), fetchSupervisors(), fetchStats(), fetchSlots(), fetchIncidents(), fetchKeys()]);
    connectWS(`/event/${currentEventId}`, (msg) => {
      if (msg.type === "car_update") fetchCars();
      if (msg.type === "slot_update") fetchSlots();
    });
    return () => disconnectWS(`/event/${currentEventId}`);
  }, [currentEventId]);

  const filteredCars = useMemo(() => {
    return cars.filter((c) => {
      if (search && !c.plate?.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      return true;
    });
  }, [cars, search, statusFilter]);

  const openCar = async (car) => {
    setSelectedCar(car);
    setShowCarModal(true);
    try {
      const { data } = await api.get(`/cars/${car.id}/photos`);
      setCarPhotos(data || []);
    } catch {
      setCarPhotos([]);
    }
  };

  const exportCSV = async () => {
    setExportingCSV(true);
    try {
      const { data } = await api.get(
        `/events/${currentEventId}/report`
      );
      const headers = [
        "Plate","Make","Color","Status","Zone","Slot",
        "Key Tag","Check-in Driver","Retrieval Driver",
        "Duration (min)","Retrieval Time (min)","Rating","Notes"
      ].join(",");
      const rows = data.cars.map(c =>
        [
          c.plate, c.make, c.color, c.status,
          c.zone || "", c.slot || "", c.key_tag || "",
          c.check_in_driver || "", c.retrieval_driver || "",
          c.duration_minutes || "", c.retrieval_minutes || "",
          c.rating || "",
          `"${(c.notes || "").replace(/"/g, "'")}"`,
        ].join(",")
      );
      const csv = [headers, ...rows].join("\n");
      const filename = `${
        data.event.name.replace(/\s+/g, "_")
      }_report.csv`;
      const path = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(path, {
        mimeType: "text/csv",
        dialogTitle: `${data.event.name} — Event Report`,
      });
    } catch {
      Alert.alert("Error", "Failed to generate CSV");
    } finally {
      setExportingCSV(false);
    }
  };

  const exportPDF = async () => {
    setExportingPDF(true);
    try {
      const { data } = await api.get(
        `/events/${currentEventId}/report`
      );
      const e = data.event;
      const s = data.summary;

      const carRows = data.cars.map(c => `
      <tr>
        <td>${c.plate}</td>
        <td>${c.color} ${c.make}</td>
        <td>${c.status}</td>
        <td>${c.check_in_driver || "—"}</td>
        <td>${c.retrieval_driver || "—"}</td>
        <td>${c.duration_minutes
          ? c.duration_minutes + " min" : "—"}</td>
        <td>${c.rating
          ? "★".repeat(c.rating) : "—"}</td>
        <td>${c.notes || "—"}</td>
      </tr>`
      ).join("");

      const driverRows = data.drivers.map(d => `
      <tr>
        <td>${d.name}</td>
        <td>${d.employee_id}</td>
        <td>${d.checkins}</td>
        <td>${d.parkings}</td>
        <td>${d.retrievals}</td>
        <td style="color:${
          d.incidents > 0 ? "#EF4444" : "#6B7280"
        }">${d.incidents}</td>
      </tr>`
      ).join("");

      const incidentRows = data.incidents.length > 0
        ? data.incidents.map(i => `
        <tr>
          <td>${i.plate}</td>
          <td>${i.driver_name || "—"}</td>
          <td>${i.description}</td>
          <td>${new Date(i.created_at)
            .toLocaleString("en-IN")}</td>
        </tr>`
        ).join("")
        : `<tr><td colspan="4" style="text-align:center;
          color:#9CA3AF;">No incidents</td></tr>`;

      const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,sans-serif;color:#111827;
          font-size:12px;}
        .header{background:#7C3AED;color:white;
          padding:24px 28px;}
        .header h1{font-size:22px;font-weight:900;}
        .header p{opacity:0.8;margin-top:3px;font-size:12px;}
        .section{padding:20px 28px;
          border-bottom:1px solid #f3f4f6;}
        .section h2{font-size:11px;font-weight:800;
          color:#7C3AED;letter-spacing:3px;
          margin-bottom:12px;text-transform:uppercase;}
        .stats{display:flex;gap:12px;flex-wrap:wrap;}
        .stat{background:#f9fafb;border-radius:10px;
          padding:12px 16px;text-align:center;
          min-width:100px;}
        .stat-val{font-size:22px;font-weight:900;
          color:#111827;}
        .stat-lbl{font-size:9px;color:#6b7280;
          text-transform:uppercase;letter-spacing:1px;
          margin-top:3px;}
        table{width:100%;border-collapse:collapse;
          font-size:11px;}
        th{padding:8px;text-align:left;background:#f9fafb;
          font-size:10px;text-transform:uppercase;
          letter-spacing:1px;color:#6b7280;font-weight:700;
          border-bottom:1px solid #e5e7eb;}
        td{padding:8px;border-bottom:1px solid #f3f4f6;}
        .footer{padding:16px 28px;text-align:center;
          color:#9ca3af;font-size:10px;}
      </style></head><body>
      <div class="header">
        <h1>${e.name}</h1>
        <p>${e.date || ""}
          ${e.start_time
            ? "· " + e.start_time + " to " + e.end_time
            : ""}
          ${e.venue ? "· " + e.venue : ""}</p>
        <p style="margin-top:6px;font-size:10px;opacity:0.6;">
          Generated ${new Date().toLocaleString("en-IN")}
        </p>
      </div>
      <div class="section">
        <h2>Summary</h2>
        <div class="stats">
          <div class="stat">
            <div class="stat-val">${s.total_cars}</div>
            <div class="stat-lbl">Total Cars</div>
          </div>
          <div class="stat">
            <div class="stat-val">${s.delivered}</div>
            <div class="stat-lbl">Delivered</div>
          </div>
          <div class="stat">
            <div class="stat-val">
              ${s.avg_retrieval_minutes}m
            </div>
            <div class="stat-lbl">Avg Retrieval</div>
          </div>
          <div class="stat">
            <div class="stat-val">
              ${s.avg_rating > 0
                ? s.avg_rating + "★" : "—"}
            </div>
            <div class="stat-lbl">Avg Rating</div>
          </div>
          <div class="stat">
            <div class="stat-val">${s.total_incidents}</div>
            <div class="stat-lbl">Incidents</div>
          </div>
          <div class="stat">
            <div class="stat-val">${s.total_drivers}</div>
            <div class="stat-lbl">Drivers</div>
          </div>
        </div>
      </div>
      <div class="section">
        <h2>Driver Performance</h2>
        <table><thead><tr>
          <th>Driver</th><th>Emp ID</th>
          <th>Check-ins</th><th>Parkings</th>
          <th>Retrievals</th><th>Incidents</th>
        </tr></thead>
        <tbody>${driverRows}</tbody></table>
      </div>
      <div class="section">
        <h2>Incidents</h2>
        <table><thead><tr>
          <th>Plate</th><th>Driver</th>
          <th>Description</th><th>Time</th>
        </tr></thead>
        <tbody>${incidentRows}</tbody></table>
      </div>
      <div class="section">
        <h2>All Vehicles (${s.total_cars})</h2>
        <table><thead><tr>
          <th>Plate</th><th>Vehicle</th><th>Status</th>
          <th>Check-in By</th><th>Retrieved By</th>
          <th>Duration</th><th>Rating</th><th>Notes</th>
        </tr></thead>
        <tbody>${carRows}</tbody></table>
      </div>
      <div class="footer">
        InstaPark — Smart Valet Operations · ${e.name}
      </div>
    </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const filename = `${
        e.name.replace(/\s+/g, "_")
      }_report.pdf`;
      const dest = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      await Sharing.shareAsync(dest, {
        mimeType: "application/pdf",
        dialogTitle: `${e.name} — Event Report`,
      });
    } catch {
      Alert.alert("Error", "Failed to generate PDF");
    } finally {
      setExportingPDF(false);
    }
  };

  const closeEvent = () => {
    Alert.alert("Close Event", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post(`/events/${currentEventId}/close`);
            router.back();
          } catch (e) {
            Alert.alert("Error", "Failed to close event");
          }
        },
      },
    ]);
  };

  const removeCar = (car) => {
    Alert.alert("Remove Vehicle", `Remove ${car.plate}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/cars/${car.id}`);
            setShowCarModal(false);
            fetchCars();
          } catch (e) {
            Alert.alert("Error", "Failed to remove");
          }
        },
      },
    ]);
  };

  const [assigningId, setAssigningId] = useState(null);
  const [assigningAll, setAssigningAll] = useState(false);

  const toggleAssign = async (d) => {
    setAssigningId(d.id);
    // Optimistic update — update UI immediately
    setDrivers(prev => prev.map(drv => drv.id === d.id ? { ...drv, assigned: !drv.assigned } : drv));
    try {
      if (d.assigned) {
        await api.delete(`/events/${currentEventId}/drivers/${d.id}`);
      } else {
        await api.post(`/events/${currentEventId}/drivers/${d.id}`);
      }
    } catch (e) {
      // Revert optimistic update on error
      setDrivers(prev => prev.map(drv => drv.id === d.id ? { ...drv, assigned: d.assigned } : drv));
      Alert.alert("Error", e.response?.data?.detail || "Failed");
    } finally {
      setAssigningId(null);
    }
  };

  const toggleAssignSupervisor = async (s) => {
    setAssigningSupervisorId(s.id);
    try {
      if (s.assigned) {
        await api.delete(`/events/${currentEventId}/supervisors/${s.id}`);
      } else {
        await api.post(`/events/${currentEventId}/supervisors/${s.id}`);
      }
      await fetchSupervisors();
    } catch (e) {
      const msg = e.response?.data?.detail || "Failed to update assignment";
      Alert.alert("Cannot Assign", msg);
    } finally {
      setAssigningSupervisorId(null);
    }
  };

  const resetSupForm = () => {
    setSupName(""); setSupEmail(""); setSupPhone(""); setSupPassword("");
  };

  const saveSupervisor = async () => {
    if (!supName.trim() || !supEmail.trim() || !supPassword.trim()) {
      Alert.alert("Required", "Name, email and password are required");
      return;
    }
    setSavingSupervisor(true);
    try {
      await api.post("/supervisors", {
        name: supName.trim(),
        email: supEmail.trim().toLowerCase(),
        phone: supPhone.trim() || undefined,
        password: supPassword,
      });
      setShowAddSupervisorModal(false);
      resetSupForm();
      Alert.alert("Supervisor Added!", `${supName} has been added and will receive login credentials by email.`);
      fetchSupervisors();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to add supervisor");
    } finally {
      setSavingSupervisor(false);
    }
  };

  const assignAll = async () => {
    const available = drivers.filter(d => (d.available || d.assigned) && !d.assigned);
    if (available.length === 0) return;
    setAssigningAll(true);
    // Optimistic update all at once
    setDrivers(prev => prev.map(d => (d.available || d.assigned) ? { ...d, assigned: true } : d));
    try {
      await Promise.all(available.map(d => api.post(`/events/${currentEventId}/drivers/${d.id}`)));
    } catch (e) {
      // Refetch on error to get correct state
      fetchDrivers();
      Alert.alert("Error", "Some drivers could not be assigned");
    } finally {
      setAssigningAll(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="event-detail-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
        <View
          style={{
            backgroundColor: "#7C3AED",
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(79,70,229,0.5)",
              borderBottomLeftRadius: 44,
              borderBottomRightRadius: 44,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
            <TouchableOpacity onPress={() => router.back()} style={iconBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
                  {event?.name || "Event"}
                </Text>
                {event?.event_type === "hotel_daily" && (
                  <View style={{ backgroundColor: "#0284C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>🏨 Auto Daily</Text>
                  </View>
                )}
                {event?.event_type === "hotel_special" && (
                  <View style={{ backgroundColor: "#1D4ED8", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>🏨 Special</Text>
                  </View>
                )}
              </View>
              {event?.status && (
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <View
                    style={{
                      backgroundColor: event.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.18)",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 99,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                      {event.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(admin)/edit-event", params: { eventId: currentEventId } })}
              style={[iconBtn, { marginRight: 8 }]}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push("/(admin)/pre-register-qr")} 
              style={[iconBtn, { marginRight: 8 }]} 
              testID="pre-register-qr-btn" 
            > 
              <Ionicons name="qr-code-outline" size={20} color="#fff" /> 
            </TouchableOpacity> 
            <TouchableOpacity 
              onPress={() => setShowIncidentModal(true)} 
              style={[iconBtn, { marginRight: 8 }]} 
              testID="report-incident-btn" 
            > 
              <Ionicons name="warning-outline" size={20} color="#FCD34D" /> 
            </TouchableOpacity> 
            {event?.status === "active" && (
              <TouchableOpacity onPress={closeEvent} style={[iconBtn, { backgroundColor: "rgba(244,63,94,0.7)" }]}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Tab bar */}
      <View
        style={{
          backgroundColor: "#fff",
          flexDirection: "row",
          marginHorizontal: 16,
          marginTop: -22,
          borderRadius: 20,
          padding: 4,
          ...cardShadow,
        }}
      >
        {[["cars", "Cars"], ["employees", "Employees"], ["stats", "Stats"], ["slots", "Slots"]].map(([k, l]) => (
          <TouchableOpacity
            key={k}
            onPress={() => setTab(k)}
            testID={`tab-${k}`}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: tab === k ? "#7C3AED" : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontWeight: "800",
                fontSize: 13,
                color: tab === k ? "#fff" : "#6B7280",
                letterSpacing: 1,
              }}
            >
              {l}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "cars" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchCars();
                setRefreshing(false);
              }}
              tintColor="#7C3AED"
            />
          }
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Ionicons name="search" size={18} color="#7C3AED" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search plate..."
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, paddingVertical: 12, marginLeft: 8, color: "#111827" }}
              testID="car-search"
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setStatusFilter(f)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 99,
                  backgroundColor: statusFilter === f ? "#7C3AED" : "#fff",
                  borderWidth: 1,
                  borderColor: statusFilter === f ? "#7C3AED" : "#E5E7EB",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: statusFilter === f ? "#fff" : "#6B7280",
                    letterSpacing: 1,
                  }}
                >
                  {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label || f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={{ color: "#6B7280", fontSize: 11, marginVertical: 8, fontWeight: "600" }}>
            {filteredCars.length} cars found
          </Text>
          {filteredCars.map((car) => {
            const cfg = STATUS_CONFIG[car.status] || STATUS_CONFIG.CHECKED_IN;
            return (
              <TouchableOpacity
                key={car.id}
                onPress={() => openCar(car)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 24,
                  padding: 16,
                  marginBottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  borderLeftWidth: 4,
                  borderLeftColor: cfg.color,
                  ...cardShadow,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{car.plate}</Text>
                  <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{car.color} {car.make}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 6 }}>
                    {car.zone && car.slot && (
                      <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                        <Text style={{ color: "#374151", fontSize: 10, fontWeight: "700" }}>
                          {car.zone}-{car.slot}
                        </Text>
                      </View>
                    )}
                    <Text style={{ color: "#9CA3AF", fontSize: 11 }}>
                      {car.check_in_time ? formatDistanceToNow(new Date(car.check_in_time), { addSuffix: true }) : "Just now"}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: cfg.color }}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 0.5 }}>{cfg.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginTop: 8 }} />
                </View>
              </TouchableOpacity>
            );
          })}
          {filteredCars.length === 0 && (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text style={{ fontSize: 48 }}>🚗</Text>
              <Text style={{ color: "#6B7280", marginTop: 8, fontWeight: "700" }}>No cars yet</Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {tab === "employees" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Internal tab toggle bar */}
          <View
            style={{
              backgroundColor: "#fff",
              flexDirection: "row",
              borderRadius: 20,
              padding: 4,
              marginBottom: 16,
              ...cardShadow,
            }}
          >
            <TouchableOpacity
              onPress={() => setEmployeeTab("supervisors")}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 16,
                backgroundColor: employeeTab === "supervisors" ? "#0F2044" : "transparent",
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 13,
                  color: employeeTab === "supervisors" ? "#fff" : "#6B7280",
                  letterSpacing: 1,
                }}
              >
                Supervisors
              </Text>
              <View style={{ backgroundColor: employeeTab === "supervisors" ? "rgba(255,255,255,0.2)" : "#EDE9FE", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99 }}>
                <Text style={{ color: employeeTab === "supervisors" ? "#fff" : "#7C3AED", fontWeight: "800", fontSize: 10 }}>{supervisors.length}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setEmployeeTab("drivers")}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 16,
                backgroundColor: employeeTab === "drivers" ? "#0F2044" : "transparent",
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 13,
                  color: employeeTab === "drivers" ? "#fff" : "#6B7280",
                  letterSpacing: 1,
                }}
              >
                Drivers
              </Text>
              <View style={{ backgroundColor: employeeTab === "drivers" ? "rgba(255,255,255,0.2)" : "#F3F0FF", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99 }}>
                <Text style={{ color: employeeTab === "drivers" ? "#fff" : "#7C3AED", fontWeight: "800", fontSize: 10 }}>{drivers.filter(d => d.assigned).length}/{drivers.length}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {employeeTab === "supervisors" && (
            <>
              {/* SUPERVISORS CONTENT */}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowAddSupervisorModal(true)}
                  style={{ backgroundColor: "#0F2044", borderRadius: 12, paddingVertical: 7, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 1 }}>ADD SUPERVISOR</Text>
                </TouchableOpacity>
              </View>

              {supervisors.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 48 }}>🛡️</Text>
                  <Text style={{ color: "#6B7280", marginTop: 8, fontWeight: "700" }}>No supervisors</Text>
                </View>
              )}

              {supervisors.map((s) => (
                <View
                  key={s.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 24,
                    padding: 16,
                    marginBottom: 12,
                    ...cardShadow,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        backgroundColor: "#0F2044",
                        borderRadius: 99,
                        width: 48,
                        height: 48,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>
                        {s.name?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontWeight: "900", color: "#111827", fontSize: 15 }}>{s.name}</Text>
                      <Text style={{ color: "#6B7280", fontSize: 12 }}>{s.email}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 99,
                            marginRight: 6,
                            backgroundColor: s.available ? "#059669" : "#F43F5E",
                          }}
                        />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: s.available ? "#059669" : "#F43F5E" }}>
                          {s.available ? "Available" : `In ${s.conflict_event_name || "another event"}`}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {s.available || s.assigned ? (
                    <TouchableOpacity
                      onPress={() => toggleAssignSupervisor(s)}
                      disabled={assigningSupervisorId === s.id}
                      activeOpacity={0.7}
                      style={{
                        marginTop: 12,
                        borderRadius: 14,
                        paddingVertical: 12,
                        alignItems: "center",
                        backgroundColor: s.assigned ? "transparent" : "#0F2044",
                        borderWidth: s.assigned ? 1.5 : 0,
                        borderColor: "#F43F5E",
                        opacity: assigningSupervisorId === s.id ? 0.7 : 1,
                      }}
                    >
                      {assigningSupervisorId === s.id ? (
                        <ActivityIndicator size="small" color={s.assigned ? "#F43F5E" : "#fff"} />
                      ) : (
                        <Text
                          style={{
                            fontWeight: "900",
                            letterSpacing: 1.5,
                            color: s.assigned ? "#F43F5E" : "#fff",
                            fontSize: 13,
                          }}
                        >
                          {s.assigned ? "UNASSIGN" : "ASSIGN"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: 12, backgroundColor: "#F3F4F6", borderRadius: 14, paddingVertical: 12, alignItems: "center" }}>
                      <Text style={{ color: "#9CA3AF", fontSize: 11 }}>In {s.conflict_event_name}</Text>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}

          {employeeTab === "drivers" && (
            <>
              {/* DRIVERS CONTENT */}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginBottom: 16, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowModal(true)}
                  style={{ backgroundColor: "#7C3AED", borderRadius: 12, paddingVertical: 7, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 1 }}>ADD DRIVER</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={assignAll}
                  disabled={assigningAll || drivers.filter(d => (d.available || d.assigned) && !d.assigned).length === 0}
                  style={{
                    backgroundColor: assigningAll ? "#EDE9FE" : "#7C3AED",
                    borderRadius: 12,
                    paddingVertical: 7,
                    paddingHorizontal: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    opacity: drivers.filter(d => (d.available || d.assigned) && !d.assigned).length === 0 ? 0.5 : 1,
                  }}
                >
                  {assigningAll ? (
                    <ActivityIndicator size="small" color="#7C3AED" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={14} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1 }}>ASSIGN ALL</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {drivers.length === 0 && (
                <View style={{ alignItems: "center", marginTop: 40 }}>
                  <Text style={{ fontSize: 48 }}>👥</Text>
                  <Text style={{ color: "#6B7280", marginTop: 8, fontWeight: "700" }}>No drivers</Text>
                </View>
              )}

              {drivers.map((d) => (
                <View
                  key={d.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 24,
                    padding: 16,
                    marginBottom: 12,
                    ...cardShadow,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        backgroundColor: "#7C3AED",
                        borderRadius: 99,
                        width: 48,
                        height: 48,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>
                        {d.name?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ flex: 1, marginLeft: 12 }}
                      onPress={() =>
                        router.push({
                          pathname: "/(admin)/driver-stats",
                          params: { driverId: d.id, driverName: d.name },
                        })
                      }
                    >
                      <Text style={{ fontWeight: "900", color: "#111827", fontSize: 15 }}>{d.name}</Text>
                      <Text style={{ color: "#6B7280", fontSize: 12 }}>{d.employee_id}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 99,
                            marginRight: 6,
                            backgroundColor: d.available ? "#059669" : "#F43F5E",
                          }}
                        />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: d.available ? "#059669" : "#F43F5E" }}>
                          {d.available ? "Available" : `In ${d.conflict_event_name || "another event"}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: "row", marginTop: 10, gap: 10 }}>
                    <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                      <Text style={{ color: "#059669", fontSize: 11, fontWeight: "700" }}>
                        Checked in: {d.cars_checked_in || 0}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                      <Text style={{ color: "#0EA5E9", fontSize: 11, fontWeight: "700" }}>
                        Retrieved: {d.cars_retrieved || 0}
                      </Text>
                    </View>
                  </View>
                  {d.available || d.assigned ? (
                    <TouchableOpacity
                      onPress={() => toggleAssign(d)}
                      disabled={assigningId === d.id}
                      activeOpacity={0.7}
                      style={{
                        marginTop: 12,
                        borderRadius: 14,
                        paddingVertical: 12,
                        alignItems: "center",
                        backgroundColor: d.assigned ? "transparent" : "#7C3AED",
                        borderWidth: d.assigned ? 1.5 : 0,
                        borderColor: "#F43F5E",
                        opacity: assigningId === d.id ? 0.7 : 1,
                      }}
                    >
                      {assigningId === d.id ? (
                        <ActivityIndicator size="small" color={d.assigned ? "#F43F5E" : "#fff"} />
                      ) : (
                        <Text
                          style={{
                            fontWeight: "900",
                            letterSpacing: 1.5,
                            color: d.assigned ? "#F43F5E" : "#fff",
                            fontSize: 13,
                          }}
                        >
                          {d.assigned ? "UNASSIGN" : "ASSIGN"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: 12, backgroundColor: "#F3F4F6", borderRadius: 14, paddingVertical: 12, alignItems: "center" }}>
                      <Text style={{ color: "#9CA3AF", fontSize: 11 }}>In {d.conflict_event_name}</Text>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {tab === "stats" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <TouchableOpacity onPress={fetchStats} style={{ backgroundColor: "#fff", borderRadius: 16, paddingVertical: 10, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" }}>
            <Text style={{ color: "#7C3AED", fontWeight: "800", letterSpacing: 1 }}>↻ Refresh Stats</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={exportCSV}
            disabled={exportingCSV}
            style={{
              backgroundColor: exportingCSV ? "#D1FAE5" : "#ECFDF5",
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "#6EE7B7",
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {exportingCSV ? (
              <ActivityIndicator size="small" color="#059669" />
            ) : (
              <Ionicons
                name="document-text-outline"
                size={16}
                color="#059669"
              />
            )}
            <Text style={{
              color: "#059669",
              fontWeight: "800",
              fontSize: 13,
              marginLeft: 6,
            }}>
              {exportingCSV ? "Generating..." : "Export CSV"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={exportPDF}
            disabled={exportingPDF}
            style={{
              backgroundColor: exportingPDF ? "#EDE9FE" : "#F5F3FF",
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "#DDD6FE",
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {exportingPDF ? (
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <Ionicons name="document-outline" size={16}
                color="#7C3AED" />
            )}
            <Text style={{ color: "#7C3AED", fontWeight: "800",
              fontSize: 13, marginLeft: 6 }}>
              {exportingPDF ? "Generating..." : "Export PDF Report"}
            </Text>
          </TouchableOpacity>
          {[
            { color: "#7C3AED", icon: "star", label: "AVG RATING", value: stats?.avg_rating || "—" },
            { color: "#059669", icon: "trophy", label: "TOP DRIVER", value: stats?.top_driver || "—" },
            { color: "#F59E0B", icon: "timer", label: "AVG RETRIEVAL", value: stats?.avg_retrieval_minutes ? `${stats.avg_retrieval_minutes} min` : "—" },
            { color: "#0EA5E9", icon: "car", label: "TOTAL CARS", value: stats?.total_cars || 0 },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                backgroundColor: s.color,
                borderRadius: 24,
                padding: 20,
                marginBottom: 12,
                shadowColor: s.color,
                shadowOpacity: 0.25,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>
                  {s.label}
                </Text>
                <Ionicons name={s.icon} size={22} color="#fff" />
              </View>
              <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 8 }}>{s.value}</Text>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {tab === "slots" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          
          {/* Internal sub-tab toggle */}
          <View style={{ backgroundColor: "#fff", flexDirection: "row", borderRadius: 18, padding: 4, marginBottom: 16, ...cardShadow }}>
            <TouchableOpacity
              onPress={() => setSlotTab("parking")}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 14,
                backgroundColor: slotTab === "parking" ? "#7C3AED" : "transparent",
                alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: 13, color: slotTab === "parking" ? "#fff" : "#6B7280" }}>🅿 Parking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSlotTab("keys")}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 14,
                backgroundColor: slotTab === "keys" ? "#7C3AED" : "transparent",
                alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: 13, color: slotTab === "keys" ? "#fff" : "#6B7280" }}>🔑 Keys</Text>
            </TouchableOpacity>
          </View>

          {slotTab === "parking" ? (
            <>
              {/* Capacity Summary */}
              {(() => {
                const total = slots.length;
                const occupied = slots.filter(s => s.is_occupied).length;
                const free = total - occupied;
                const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
                const barColor = pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#059669";
                return (
                  <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16, ...cardShadow }}>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 3, marginBottom: 12 }}>
                      CAPACITY OVERVIEW
                    </Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: 28, fontWeight: "900", color: "#111827" }}>{occupied}</Text>
                        <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "700" }}>OCCUPIED</Text>
                      </View>
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: 28, fontWeight: "900", color: "#059669" }}>{free}</Text>
                        <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "700" }}>FREE</Text>
                      </View>
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: 28, fontWeight: "900", color: "#7C3AED" }}>{total}</Text>
                        <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "700" }}>TOTAL</Text>
                      </View>
                    </View>
                    <View style={{ height: 10, backgroundColor: "#F3F4F6", borderRadius: 99, overflow: "hidden" }}>
                      <View style={{ height: 10, width: `${pct}%`, backgroundColor: barColor, borderRadius: 99 }} />
                    </View>
                    <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 8, textAlign: "right" }}>
                      {pct}% full
                    </Text>
                    {pct >= 80 && (
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: "/(admin)/edit-event", params: { eventId: currentEventId } })}
                        style={{ backgroundColor: pct >= 90 ? "#FEE2E2" : "#FEF3C7", borderRadius: 14, padding: 12, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
                      >
                        <Ionicons name="warning-outline" size={16} color={pct >= 90 ? "#EF4444" : "#D97706"} />
                        <Text style={{ fontWeight: "800", fontSize: 12, color: pct >= 90 ? "#EF4444" : "#D97706", marginLeft: 6 }}>
                          {pct >= 90 ? "ALMOST FULL — TAP TO ADD MORE SLOTS" : "FILLING UP — TAP TO ADD MORE SLOTS"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}

              {/* Zone Selector */}
              {(() => {
                const zones = [...new Set(slots.map(s => s.zone_name))];
                if (!selectedZone && zones.length > 0) setSelectedZone(zones[0]);
                return (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {zones.map(z => {
                      const zSlots = slots.filter(s => s.zone_name === z);
                      const zOcc = zSlots.filter(s => s.is_occupied).length;
                      return (
                        <TouchableOpacity
                          key={z}
                          onPress={() => setSelectedZone(z)}
                          style={{
                            backgroundColor: selectedZone === z ? "#7C3AED" : "#fff",
                            borderRadius: 16,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            marginRight: 10,
                            ...cardShadow,
                          }}
                        >
                          <Text style={{ fontWeight: "800", fontSize: 13, color: selectedZone === z ? "#fff" : "#111827" }}>
                            Zone {z}
                          </Text>
                          <Text style={{ fontSize: 11, color: selectedZone === z ? "rgba(255,255,255,0.8)" : "#9CA3AF", marginTop: 2 }}>
                            {zOcc}/{zSlots.length} occupied
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                );
              })()}

              {/* Slot Grid */}
              {(() => {
                const zoneSlots = slots.filter(s => s.zone_name === selectedZone);
                return (
                  <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 16, ...cardShadow }}>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 3, marginBottom: 16 }}>
                      ZONE {selectedZone} — SLOT MAP
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {zoneSlots.map(s => (
                        <View
                          key={s.id}
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 14,
                            backgroundColor: s.is_occupied ? "#FEE2E2" : "#D1FAE5",
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1.5,
                            borderColor: s.is_occupied ? "#FECACA" : "#A7F3D0",
                          }}
                        >
                          <Ionicons
                            name={s.is_occupied ? "car" : "car-outline"}
                            size={16}
                            color={s.is_occupied ? "#EF4444" : "#059669"}
                          />
                          <Text style={{ fontSize: 11, fontWeight: "800", color: s.is_occupied ? "#EF4444" : "#059669", marginTop: 2 }}>
                            {s.slot_number}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {zoneSlots.length === 0 && (
                      <Text style={{ color: "#9CA3AF", textAlign: "center", paddingVertical: 24 }}>
                        No slots in this zone
                      </Text>
                    )}
                  </View>
                );
              })()}
            </>
          ) : (
            <>
              {/* Summary card */}
              {keyStats && (
                <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16, ...cardShadow }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 3, marginBottom: 14 }}>
                    KEY BOARD STATUS
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                    {[
                      { label: "IN BOOTH", value: keyStats.in_booth, color: "#7C3AED" },
                      { label: "AVAILABLE", value: keyStats.hooks_available, color: "#059669" },
                      { label: "RETURNED", value: keyStats.returned, color: "#9CA3AF" },
                      { label: "TOTAL HOOKS", value: keyStats.total_hooks, color: "#0EA5E9" },
                    ].map(s => (
                      <View key={s.label} style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: 24, fontWeight: "900", color: s.color }}>{s.value}</Text>
                        <Text style={{ fontSize: 9, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1.5, marginTop: 4, textAlign: "center" }}>
                          {s.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Capacity bar */}
                  {(() => {
                    const pct = keyStats.total_hooks > 0 ? Math.round((keyStats.in_booth / keyStats.total_hooks) * 100) : 0;
                    const barColor = pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#7C3AED";
                    return (
                      <>
                        <View style={{ height: 8, backgroundColor: "#F3F4F6", borderRadius: 99, overflow: "hidden" }}>
                          <View style={{ height: 8, width: `${pct}%`, backgroundColor: barColor, borderRadius: 99 }} />
                        </View>
                        <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 6, textAlign: "right" }}>
                          {pct}% full
                        </Text>
                      </>
                    );
                  })()}

                  {/* Full board warning */}
                  {keyStats.hooks_full && (
                    <View style={{ backgroundColor: "#FEE2E2", borderRadius: 14, padding: 12, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="warning" size={18} color="#EF4444" />
                      <Text style={{ color: "#991B1B", fontWeight: "800", fontSize: 13, flex: 1 }}>
                        Key board is full — no hooks available
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Untagged warning */}
              {keyStats?.untagged_count > 0 && (
                <View style={{ backgroundColor: "#FEF3C7", borderRadius: 16, padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#FDE68A" }}>
                  <Ionicons name="warning" size={20} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: "#92400E", fontSize: 13 }}>
                      {keyStats.untagged_count} car(s) have no key tag
                    </Text>
                    <Text style={{ color: "#B45309", fontSize: 11, marginTop: 2 }}>
                      Ask drivers to add key tag numbers for these cars
                    </Text>
                  </View>
                </View>
              )}

              {/* Keys in booth */}
              {keys.filter(k => k.in_booth).length > 0 && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#7C3AED", letterSpacing: 3, marginBottom: 10 }}>
                    IN BOOTH ({keys.filter(k => k.in_booth).length})
                  </Text>
                  {keys.filter(k => k.in_booth).map(k => (
                    <View key={k.car_id} style={{
                      backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 8,
                      flexDirection: "row", alignItems: "center", borderLeftWidth: 4, borderLeftColor: "#7C3AED",
                      ...cardShadow }}>
                      <View style={{ backgroundColor: "#F5F3FF", borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                        <Ionicons name="key" size={16} color="#7C3AED" />
                        <Text style={{ fontSize: 10, fontWeight: "900", color: "#7C3AED", marginTop: 1 }}>
                          #{k.key_tag}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "900", color: "#111827", fontSize: 14 }}>{k.plate}</Text>
                        <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>
                          {k.color} {k.make}{k.zone ? ` · Zone ${k.zone} Slot ${k.slot}` : ""}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: "#EDE9FE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#7C3AED", letterSpacing: 1 }}>
                          {k.status === "RETRIEVAL_REQUESTED" ? "REQUESTED" : k.status === "BEING_FETCHED" ? "FETCHING" : "PARKED"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Returned keys */}
              {keys.filter(k => !k.in_booth).length > 0 && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#059669", letterSpacing: 3, marginTop: 8, marginBottom: 10 }}>
                    RETURNED ({keys.filter(k => !k.in_booth).length})
                  </Text>
                  {keys.filter(k => !k.in_booth).map(k => (
                    <View key={k.car_id} style={{
                      backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 8,
                      flexDirection: "row", alignItems: "center", borderLeftWidth: 4, borderLeftColor: "#D1FAE5",
                      opacity: 0.75, ...cardShadow }}>
                      <View style={{ backgroundColor: "#D1FAE5", borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                        <Ionicons name="key-outline" size={16} color="#059669" />
                        <Text style={{ fontSize: 10, fontWeight: "900", color: "#059669", marginTop: 1 }}>
                          #{k.key_tag}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "900", color: "#374151", fontSize: 14 }}>{k.plate}</Text>
                        <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>
                          {k.color} {k.make} · Delivered
                        </Text>
                      </View>
                      <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#059669", letterSpacing: 1 }}>
                          RETURNED
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Empty state */}
              {keys.length === 0 && (
                <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 40, alignItems: "center", ...cardShadow }}>
                  <Ionicons name="key-outline" size={44} color="#D1D5DB" />
                  <Text style={{ color: "#9CA3AF", fontWeight: "700", marginTop: 12, fontSize: 15 }}>
                    No key tags recorded yet
                  </Text>
                  <Text style={{ color: "#D1D5DB", fontSize: 12, marginTop: 6, textAlign: "center" }}>
                    Drivers add key tags from their tasks screen after parking
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}



      <Modal visible={showCarModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20, maxHeight: "85%" }}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
            </View>
            <ScrollView>
              {selectedCar && (
                <>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 28, fontWeight: "900", color: "#7C3AED" }}>{selectedCar.plate}</Text>
                      <Text style={{ color: "#6B7280", marginTop: 4 }}>{selectedCar.color} {selectedCar.make}</Text>
                      <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
                        {selectedCar.zone ? `Zone ${selectedCar.zone} · Slot ${selectedCar.slot}` : "Not parked"}
                      </Text>
                    </View>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, backgroundColor: STATUS_CONFIG[selectedCar.status]?.color }}>
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
                        {STATUS_CONFIG[selectedCar.status]?.label}
                      </Text>
                    </View>
                  </View>
                  {selectedCar.notes ? (
                    <Text style={{ color: "#6B7280", marginTop: 12, fontStyle: "italic" }}>"{selectedCar.notes}"</Text>
                  ) : null}

                  <Text style={[modalLabel, { marginTop: 16 }]}>CHECK-IN PHOTOS</Text>
                  {carPhotos.filter((p) => p.type === "checkin").length === 0 ? (
                    <Text style={{ color: "#9CA3AF", fontSize: 13 }}>No photos available</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {carPhotos.filter((p) => p.type === "checkin").map((p, i) => (
                        <Image key={i} source={{ uri: p.url }} style={{ width: 120, height: 120, borderRadius: 14 }} />
                      ))}
                    </ScrollView>
                  )}

                  {carPhotos.find((p) => p.type === "handover") && (
                    <>
                      <Text style={[modalLabel, { marginTop: 16 }]}>HANDOVER PHOTO</Text>
                      <Image
                        source={{ uri: carPhotos.find((p) => p.type === "handover").url }}
                        style={{ width: "100%", height: 200, borderRadius: 14 }}
                      />
                    </>
                  )}

                  <TouchableOpacity 
                    onPress={() => { 
                      setShowCarModal(false); 
                      router.push({ 
                        pathname: "/(admin)/car-log", 
                        params: { car_id: selectedCar.id } 
                      }); 
                    }} 
                    style={{ backgroundColor: "#111827", borderRadius: 16, 
                    paddingVertical: 14, alignItems: "center", 
                    marginTop: 20, flexDirection: "row", 
                    justifyContent: "center" }} 
                  > 
                    <Ionicons name="time-outline" size={18} color="#fff" /> 
                    <Text style={{ color: "#fff", fontWeight: "900", 
                    letterSpacing: 2, marginLeft: 8 }}>VIEW FULL LOG</Text> 
                  </TouchableOpacity> 

                  <TouchableOpacity
                    onPress={() => {
                      setShowCarModal(false);
                      router.push({ pathname: "/(admin)/qr-display", params: { token: selectedCar.qr_token, plate: selectedCar.plate } });
                    }}
                    style={{ backgroundColor: "#7C3AED", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 20 }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>VIEW QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeCar(selectedCar)}
                    style={{ borderWidth: 1.5, borderColor: "#F43F5E", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 8, marginBottom: 16 }}
                  >
                    <Text style={{ color: "#F43F5E", fontWeight: "900", letterSpacing: 2 }}>REMOVE VEHICLE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowCarModal(false)} style={{ paddingVertical: 10, alignItems: "center", marginBottom: 12 }}>
                    <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddSupervisorModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20 }}>
              <View style={{ alignItems: "center", marginBottom: 14 }}>
                <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: "900", color: "#0F2044", marginBottom: 20 }}>Add Supervisor</Text>

              <Text style={modalLabel}>NAME</Text>
              <TextInput value={supName} onChangeText={setSupName} placeholder="Full Name" style={modalInput} />

              <Text style={modalLabel}>EMAIL</Text>
              <TextInput value={supEmail} onChangeText={setSupEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" style={modalInput} />

              <Text style={modalLabel}>PHONE (OPTIONAL)</Text>
              <TextInput value={supPhone} onChangeText={setSupPhone} placeholder="10-digit mobile" keyboardType="phone-pad" style={modalInput} />

              <Text style={modalLabel}>PASSWORD</Text>
              <TextInput value={supPassword} onChangeText={setSupPassword} placeholder="Min 6 characters" secureTextEntry style={modalInput} />

              <TouchableOpacity
                onPress={saveSupervisor}
                disabled={savingSupervisor}
                style={{ backgroundColor: "#0F2044", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 10, shadowColor: "#0F2044", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
              >
                {savingSupervisor ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>SAVE SUPERVISOR</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  resetSupForm();
                  setShowAddSupervisorModal(false);
                }}
                style={{ paddingVertical: 12, alignItems: "center", marginTop: 4 }}
              >
                <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal 
        visible={showIncidentModal} 
        animationType="slide" 
        transparent 
      > 
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", 
        justifyContent: "flex-end" }}> 
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
          > 
            <View style={{ backgroundColor: "#fff", 
            borderTopLeftRadius: 36, borderTopRightRadius: 36, 
            padding: 20, maxHeight: "92%" }}> 
      
              {/* Handle */} 
              <View style={{ alignItems: "center", marginBottom: 14 }}> 
                <View style={{ backgroundColor: "#D1D5DB", width: 48, 
                height: 4, borderRadius: 99 }} /> 
              </View> 
      
              {/* Header */} 
              <View style={{ flexDirection: "row", alignItems: "center", 
              marginBottom: 16 }}> 
                <View style={{ backgroundColor: "#FEF3C7", 
                borderRadius: 99, padding: 8, marginRight: 10 }}> 
                  <Ionicons name="warning" size={20} color="#F59E0B" /> 
                </View> 
                <View style={{ flex: 1 }}> 
                  <Text style={{ fontSize: 18, fontWeight: "900", 
                  color: "#111827" }}>Report Incident</Text> 
                  <Text style={{ fontSize: 12, color: "#9CA3AF", 
                  marginTop: 2 }}> 
                    {event?.name || "Current Event"} 
                  </Text> 
                </View> 
                <TouchableOpacity 
                  onPress={() => setShowIncidentModal(false)} 
                > 
                  <Ionicons name="close-circle" size={26} 
                  color="#D1D5DB" /> 
                </TouchableOpacity> 
              </View> 
      
              <ScrollView showsVerticalScrollIndicator={false}> 
      
                {/* Car search */} 
                <Text style={{ fontSize: 11, fontWeight: "800", 
                color: "#6B7280", letterSpacing: 2, marginBottom: 8 }}> 
                  SELECT CAR * 
                </Text> 
                <View style={{ backgroundColor: "#F9FAFB", 
                borderRadius: 14, borderWidth: 1, 
                borderColor: "#E5E7EB", flexDirection: "row", 
                alignItems: "center", paddingHorizontal: 12, 
                marginBottom: 6 }}> 
                  <Ionicons name="search" size={16} color="#7C3AED" /> 
                  <TextInput 
                    value={incidentCarSearch} 
                    onChangeText={setIncidentCarSearch} 
                    placeholder="Search plate number..." 
                    placeholderTextColor="#9CA3AF" 
                    autoCapitalize="characters" 
                    style={{ flex: 1, paddingVertical: 13, 
                    paddingLeft: 8, color: "#111827", fontWeight: "700" }} 
                  /> 
                  {incidentCar && ( 
                    <TouchableOpacity onPress={() => { 
                      setIncidentCar(null); 
                      setIncidentCarSearch(""); 
                    }}> 
                      <Ionicons name="close-circle" size={18} 
                      color="#D1D5DB" /> 
                    </TouchableOpacity> 
                  )} 
                </View> 
      
                {incidentCarSearch.length > 1 && !incidentCar && ( 
                  <View style={{ backgroundColor: "#fff", 
                  borderRadius: 14, borderWidth: 1, 
                  borderColor: "#E5E7EB", marginBottom: 12, 
                  overflow: "hidden" }}> 
                    {cars 
                      .filter(c => 
                        c.plate.toLowerCase().includes( 
                          incidentCarSearch.toLowerCase() 
                        ) 
                      ) 
                      .slice(0, 5) 
                      .map(c => ( 
                        <TouchableOpacity 
                          key={c.id} 
                          onPress={() => { 
                            setIncidentCar(c); 
                            setIncidentCarSearch(c.plate); 
                          }} 
                          style={{ padding: 14, borderBottomWidth: 1, 
                          borderBottomColor: "#F3F4F6", 
                          flexDirection: "row", 
                          alignItems: "center" }} 
                        > 
                          <View style={{ backgroundColor: "#F3F4F6", 
                          borderRadius: 8, padding: 6, 
                          marginRight: 10 }}> 
                            <Ionicons name="car-outline" size={16} 
                            color="#374151" /> 
                          </View> 
                          <View> 
                            <Text style={{ fontWeight: "900", 
                            color: "#111827" }}>{c.plate}</Text> 
                            <Text style={{ color: "#6B7280", 
                            fontSize: 12 }}> 
                              {c.color} {c.make} 
                            </Text> 
                          </View> 
                        </TouchableOpacity> 
                      )) 
                    } 
                    {cars.filter(c => 
                      c.plate.toLowerCase().includes( 
                        incidentCarSearch.toLowerCase() 
                      ) 
                    ).length === 0 && ( 
                      <View style={{ padding: 16, alignItems: "center" }}> 
                        <Text style={{ color: "#9CA3AF", fontSize: 13 }}> 
                          No cars found 
                        </Text> 
                      </View> 
                    )} 
                  </View> 
                )} 
      
                {incidentCar && ( 
                  <View style={{ backgroundColor: "#D1FAE5", 
                  borderRadius: 12, padding: 12, marginBottom: 16, 
                  flexDirection: "row", alignItems: "center" }}> 
                    <Ionicons name="checkmark-circle" size={18} 
                    color="#059669" /> 
                    <Text style={{ color: "#059669", fontWeight: "800", 
                    marginLeft: 8, flex: 1 }}> 
                      {incidentCar.plate} · {incidentCar.color}{" "} 
                      {incidentCar.make} 
                    </Text> 
                  </View> 
                )} 
      
                {/* Driver select */} 
                <Text style={{ fontSize: 11, fontWeight: "800", 
                color: "#6B7280", letterSpacing: 2, marginBottom: 8 }}> 
                  DRIVER INVOLVED (OPTIONAL) 
                </Text> 
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={{ gap: 8, marginBottom: 16 }} 
                > 
                  {[{ id: null, name: "None" }, 
                    ...drivers.filter(d => d.assigned) 
                  ].map(d => ( 
                    <TouchableOpacity 
                      key={d.id || "none"} 
                      onPress={() => 
                        setIncidentDriver(d.id ? d : null) 
                      } 
                      style={{ 
                        paddingHorizontal: 14, 
                        paddingVertical: 10, 
                        borderRadius: 99, 
                        borderWidth: 1.5, 
                        backgroundColor: 
                          (incidentDriver?.id ?? null) === d.id 
                            ? "#7C3AED" : "#fff", 
                        borderColor: 
                          (incidentDriver?.id ?? null) === d.id 
                            ? "#7C3AED" : "#E5E7EB", 
                      }} 
                    > 
                      <Text style={{ 
                        fontWeight: "800", 
                        fontSize: 13, 
                        color: 
                          (incidentDriver?.id ?? null) === d.id 
                            ? "#fff" : "#374151", 
                      }}> 
                        {d.name} 
                      </Text> 
                    </TouchableOpacity> 
                  ))} 
                </ScrollView> 
      
                {/* Description */} 
                <Text style={{ fontSize: 11, fontWeight: "800", 
                color: "#6B7280", letterSpacing: 2, marginBottom: 8 }}> 
                  DESCRIPTION * 
                </Text> 
                <TextInput 
                  value={incidentDesc} 
                  onChangeText={setIncidentDesc} 
                  placeholder="Describe what happened..." 
                  placeholderTextColor="#9CA3AF" 
                  multiline 
                  numberOfLines={4} 
                  style={{ backgroundColor: "#F9FAFB", borderRadius: 14, 
                  borderWidth: 1, borderColor: "#E5E7EB", padding: 14, 
                  color: "#111827", textAlignVertical: "top", 
                  minHeight: 110, marginBottom: 16, fontSize: 14, 
                  lineHeight: 22 }} 
                /> 
      
                {/* Photo */} 
                <TouchableOpacity 
                  onPress={pickIncidentPhoto} 
                  style={{ borderWidth: 1.5, 
                  borderColor: incidentPhoto ? "#059669" : "#E5E7EB", 
                  borderStyle: incidentPhoto ? "solid" : "dashed", 
                  borderRadius: 14, padding: 16, alignItems: "center", 
                  marginBottom: 20, 
                  backgroundColor: incidentPhoto 
                    ? "#D1FAE5" : "#FAFAFA" }} 
                > 
                  <Ionicons 
                    name={incidentPhoto 
                      ? "checkmark-circle" : "camera-outline"} 
                    size={26} 
                    color={incidentPhoto ? "#059669" : "#9CA3AF"} 
                  /> 
                  <Text style={{ 
                    color: incidentPhoto ? "#059669" : "#9CA3AF", 
                    marginTop: 6, fontWeight: "700", fontSize: 13 
                  }}> 
                    {incidentPhoto 
                      ? "Photo Added ✓ (tap to retake)" 
                      : "Add Photo (Optional)"} 
                  </Text> 
                </TouchableOpacity> 
      
                {/* Submit */} 
                <TouchableOpacity 
                  onPress={submitIncident} 
                  disabled={submittingIncident} 
                  activeOpacity={0.85} 
                  style={{ backgroundColor: 
                    submittingIncident ? "#D1D5DB" : "#F59E0B", 
                    borderRadius: 18, paddingVertical: 18, 
                    alignItems: "center", marginBottom: 24, 
                    shadowColor: "#F59E0B", shadowOpacity: 0.35, 
                    shadowRadius: 12, 
                    shadowOffset: { width: 0, height: 6 }, 
                    elevation: 6 }} 
                > 
                  {submittingIncident ? ( 
                    <ActivityIndicator color="#fff" /> 
                  ) : ( 
                    <Text style={{ color: "#fff", fontWeight: "900", 
                    letterSpacing: 2, fontSize: 14 }}> 
                      SUBMIT INCIDENT REPORT 
                    </Text> 
                  )} 
                </TouchableOpacity> 
      
              </ScrollView> 
            </View> 
          </KeyboardAvoidingView> 
        </View> 
      </Modal> 
    </View> 
  ); 
}

const iconBtn = {
  backgroundColor: "rgba(255,255,255,0.15)",
  borderRadius: 99,
  padding: 8,
};

const modalLabel = {
  fontSize: 11,
  fontWeight: "800",
  color: "#6B7280",
  letterSpacing: 3,
  marginBottom: 8,
};

const modalInput = {
  backgroundColor: "#F9FAFB",
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  padding: 14,
  color: "#111827",
  marginBottom: 16,
  fontSize: 15,
  fontWeight: "700",
};