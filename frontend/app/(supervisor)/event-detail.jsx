import { useEffect, useState, useMemo, useCallback } from "react";
import { rs, rp } from '../../utils/responsive';
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

const ACCENT_COLOR = "#0F2044";

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
  shadowColor: ACCENT_COLOR,
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function SupervisorEventDetail() {
  const router = useRouter();
  const { currentEventId } = useAppStore();
  const [event, setEvent] = useState(null);
  const isClosed = event?.status === "closed";
  const [tab, setTab] = useState("cars");
  const [slotTab, setSlotTab] = useState("parking");
  const [cars, setCars] = useState([]);
  const [carStats, setCarStats] = useState(null);
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
  const [showMenu, setShowMenu] = useState(false);

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
      
      if (data && data.length > 0) {
        const total = data.length;
        const delivered = data.filter(c => c.status === "DELIVERED").length;
        const parked = data.filter(c => c.status === "PARKED").length;
        const retrieving = data.filter(c => c.status === "RETRIEVAL_REQUESTED" || c.status === "BEING_FETCHED").length;
        const checkedIn = data.filter(c => c.status === "CHECKED_IN").length;
        setCarStats({ total, delivered, parked, retrieving, checkedIn });
      }
    } catch {}
  }, [currentEventId]);

  const fetchDrivers = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/drivers`);
      setDrivers(data || []);
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

  useEffect(() => {
    if (!currentEventId) return;
    Promise.all([fetchEvent(), fetchCars(), fetchDrivers(), fetchStats(), fetchSlots(), fetchIncidents(), fetchKeys()]);
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

  const exportCSV = async () => {
    setExportingCSV(true);
    try {
      const { data } = await api.get(`/events/${currentEventId}/report`);
      const headers = ["Plate","Make","Color","Status","Zone","Slot","Key Tag","Check-in Driver","Retrieval Driver","Duration (min)","Retrieval Time (min)","Rating","Notes"].join(",");
      const rows = data.cars.map(c => [c.plate, c.make, c.color, c.status, c.zone || "", c.slot || "", c.key_tag || "", c.check_in_driver || "", c.retrieval_driver || "", c.duration_minutes || "", c.retrieval_minutes || "", c.rating || "", `"${(c.notes || "").replace(/"/g, "'")}"`].join(","));
      const csv = [headers, ...rows].join("\n");
      const filename = `${data.event.name.replace(/\s+/g, "_")}_report.csv`;
      const path = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: `${data.event.name} — Event Report` });
    } catch {
      Alert.alert("Error", "Failed to generate CSV");
    } finally {
      setExportingCSV(false);
    }
  };

  const exportPDF = async () => {
    setExportingPDF(true);
    try {
      const { data } = await api.get(`/events/${currentEventId}/report`);
      const e = data.event;
      const s = data.summary;

      const carRows = data.cars.map(c => `<tr><td>${c.plate}</td><td>${c.color} ${c.make}</td><td>${c.status}</td><td>${c.check_in_driver || "—"}</td><td>${c.retrieval_driver || "—"}</td><td>${c.duration_minutes ? c.duration_minutes + " min" : "—"}</td><td>${c.rating ? "★".repeat(c.rating) : "—"}</td><td>${c.notes || "—"}</td></tr>`).join("");
      const driverRows = data.drivers.map(d => `<tr><td>${d.name}</td><td>${d.employee_id}</td><td>${d.checkins}</td><td>${d.parkings}</td><td>${d.retrievals}</td><td style="color:${d.incidents > 0 ? "#EF4444" : "#6B7280"}">${d.incidents}</td></tr>`).join("");
      const incidentRows = data.incidents.length > 0 ? data.incidents.map(i => `<tr><td>${i.plate}</td><td>${i.driver_name || "—"}</td><td>${i.description}</td><td>${new Date(i.created_at).toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</td></tr>`).join("") : `<tr><td colspan="4" style="text-align:center; color:#9CA3AF;">No incidents</td></tr>`;

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;color:#111827;font-size:12px;}.header{background:${ACCENT_COLOR};color:white;padding:24px 28px;}.header h1{font-size:22px;font-weight:900;}.header p{opacity:0.8;margin-top:3px;font-size:12px;}.section{padding:20px 28px;border-bottom:1px solid #f3f4f6;}.section h2{font-size:11px;font-weight:800;color:${ACCENT_COLOR};letter-spacing:3px;margin-bottom:12px;text-transform:uppercase;}.stats{display:flex;gap:12px;flex-wrap:wrap;}.stat{background:#f9fafb;border-radius:10px;padding:12px 16px;text-align:center;min-width:100px;}.stat-val{font-size:22px;font-weight:900;color:#111827;}.stat-lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-top:3px;}table{width:100%;border-collapse:collapse;font-size:11px;}th{padding:8px;text-align:left;background:#f9fafb;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;}td{padding:8px;border-bottom:1px solid #f3f4f6;}.footer{padding:16px 28px;text-align:center;color:#9ca3af;font-size:10px;}</style></head><body><div class="header"><h1>${e.name}</h1><p>${e.date || ""} ${e.start_time ? "· " + e.start_time + " to " + e.end_time : ""} ${e.venue ? "· " + e.venue : ""}</p><p style="margin-top:6px;font-size:10px;opacity:0.6;">Generated ${new Date().toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</p></div><div class="section"><h2>Summary</h2><div class="stats"><div class="stat"><div class="stat-val">${s.total_cars}</div><div class="stat-lbl">Total Cars</div></div><div class="stat"><div class="stat-val">${s.delivered}</div><div class="stat-lbl">Delivered</div></div><div class="stat"><div class="stat-val">${s.avg_retrieval_minutes}m</div><div class="stat-lbl">Avg Retrieval</div></div><div class="stat"><div class="stat-val">${s.avg_rating > 0 ? s.avg_rating + "★" : "—"}</div><div class="stat-lbl">Avg Rating</div></div><div class="stat"><div class="stat-val">${s.total_incidents}</div><div class="stat-lbl">Incidents</div></div><div class="stat"><div class="stat-val">${s.total_drivers}</div><div class="stat-lbl">Drivers</div></div></div></div><div class="section"><h2>Driver Performance</h2><table><thead><tr><th>Driver</th><th>Emp ID</th><th>Check-ins</th><th>Parkings</th><th>Retrievals</th><th>Incidents</th></tr></thead><tbody>${driverRows}</tbody></table></div><div class="section"><h2>Incidents</h2><table><thead><tr><th>Plate</th><th>Driver</th><th>Description</th><th>Time</th></tr></thead><tbody>${incidentRows}</tbody></table></div><div class="section"><h2>All Vehicles (${s.total_cars})</h2><table><thead><tr><th>Plate</th><th>Vehicle</th><th>Status</th><th>Check-in By</th><th>Retrieved By</th><th>Duration</th><th>Rating</th><th>Notes</th></tr></thead><tbody>${carRows}</tbody></table></div><div class="footer">InstaPark — Smart Valet Operations · ${e.name}</div></body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const filename = `${e.name.replace(/\s+/g, "_")}_report.pdf`;
      const dest = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      await Sharing.shareAsync(dest, { mimeType: "application/pdf", dialogTitle: `${e.name} — Event Report` });
    } catch {
      Alert.alert("Error", "Failed to generate PDF");
    } finally {
      setExportingPDF(false);
    }
  };

  const [assigningId, setAssigningId] = useState(null);
  const [assigningAll, setAssigningAll] = useState(false);

  const toggleAssign = async (d) => {
    setAssigningId(d.id);
    setDrivers(prev => prev.map(drv => drv.id === d.id ? { ...drv, assigned: !drv.assigned } : drv));
    try {
      if (d.assigned) {
        await api.delete(`/events/${currentEventId}/drivers/${d.id}`);
      } else {
        await api.post(`/events/${currentEventId}/drivers/${d.id}`);
      }
    } catch (e) {
      setDrivers(prev => prev.map(drv => drv.id === d.id ? { ...drv, assigned: d.assigned } : drv));
      Alert.alert("Error", e.response?.data?.detail || "Failed");
    } finally {
      setAssigningId(null);
    }
  };

  const assignAll = async () => {
    const available = drivers.filter(d => (d.available || d.assigned) && !d.assigned);
    if (available.length === 0) return;
    setAssigningAll(true);
    setDrivers(prev => prev.map(d => (d.available || d.assigned) ? { ...d, assigned: true } : d));
    try {
      await Promise.all(available.map(d => api.post(`/events/${currentEventId}/drivers/${d.id}`)));
    } catch (e) {
      fetchDrivers();
      Alert.alert("Error", "Some drivers could not be assigned");
    } finally {
      setAssigningAll(false);
    }
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

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="supervisor-event-detail">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: ACCENT_COLOR }}>
        <View
              style={{
                backgroundColor: ACCENT_COLOR,
                borderBottomLeftRadius: rp(44),
                borderBottomRightRadius: rp(44),
                paddingHorizontal: rp(20),
                paddingTop: rp(8),
                paddingBottom: rp(16),
              }}
            >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(14) }}>
            <TouchableOpacity onPress={() => router.push("/(supervisor)/dashboard")} style={iconBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: rp(12) }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900" }} numberOfLines={1}>
                  {event?.name || "Event"}
                </Text>
                {event?.event_type === "hotel_daily" && (
                  <View style={{ backgroundColor: "#0284C7", paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(6), marginLeft: rp(8) }}>
                    <Text style={{ color: "#fff", fontSize: rs(10), fontWeight: "900" }}>🏨 Auto Daily</Text>
                  </View>
                )}
                {event?.event_type === "hotel_special" && (
                  <View style={{ backgroundColor: "#1D4ED8", paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(6), marginLeft: rp(8) }}>
                    <Text style={{ color: "#fff", fontSize: rs(10), fontWeight: "900" }}>🏨 Special</Text>
                  </View>
                )}
              </View>
              {event?.status && (
                <View style={{ flexDirection: "row", marginTop: rp(4) }}>
                  <View style={{ backgroundColor: event.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.18)", paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(99) }}>
                    <Text style={{ color: "#fff", fontSize: rs(10), fontWeight: "800", letterSpacing: rs(1.5) }}>
                      {event.status === "closed" ? "CLOSED" : event.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={[iconBtn, { marginRight: rp(8) }]}>
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
            onPress={() => setShowMenu(false)} 
          />
          <View style={{ position: 'absolute', top: rp(130), right: rp(20), backgroundColor: '#fff', borderRadius: rp(16), paddingVertical: rp(8), zIndex: 1000, ...cardShadow }}>
            {!isClosed && (
              <>
                <TouchableOpacity 
                  style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => { setShowMenu(false); router.push("/(admin)/pre-register-qr"); }}
                >
                  <Ionicons name="qr-code-outline" size={20} color={ACCENT_COLOR} />
                  <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: '#0F2044' }}>QR Code</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
                <TouchableOpacity 
                  style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => { setShowMenu(false); setShowIncidentModal(true); }}
                >
                  <Ionicons name="warning-outline" size={20} color={ACCENT_COLOR} />
                  <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: '#0F2044' }}>Report Incident</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
              </>
            )}
            <TouchableOpacity 
              style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
              onPress={() => { setShowMenu(false); exportCSV(); }}
            >
              <Ionicons name="document-text-outline" size={20} color={ACCENT_COLOR} />
              <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: '#0F2044' }}>Export CSV</Text>
            </TouchableOpacity>
            <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
            <TouchableOpacity 
              style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
              onPress={() => { setShowMenu(false); exportPDF(); }}
            >
              <Ionicons name="document-outline" size={20} color={ACCENT_COLOR} />
              <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: '#0F2044' }}>Export PDF Report</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Tab bar */}
      <View style={{ backgroundColor: "#fff", flexDirection: "row", marginHorizontal: rp(16), marginTop: -rp(22), borderRadius: rp(20), padding: rp(4), ...cardShadow }}>
        {(isClosed
          ? [
              ["cars", "Cars"],
              ["stats", "Stats"],
              ["incidents", "Incidents"],
            ]
          : [
              ["cars", "Cars"],
              ["employees", "Employees"],
              ["stats", "Stats"],
              ["slots", "Slots"],
              ["incidents", "Incidents"],
            ]
        ).map(([k, l]) => (
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
            <Text style={{ fontWeight: "800", fontSize: isClosed ? 13 : 11, color: tab === k ? "#fff" : "#6B7280", letterSpacing: rs(1) }}>
              {l}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "cars" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchCars();
                setRefreshing(false);
              }}
              tintColor={ACCENT_COLOR}
            />
          }
        >
          <View style={{ backgroundColor: "#fff", borderRadius: rp(16), paddingHorizontal: rp(14), flexDirection: "row", alignItems: "center", marginBottom: rp(12), borderWidth: rp(1), borderColor: "#E5E7EB" }}>
            <Ionicons name="search" size={18} color={ACCENT_COLOR} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search plate..."
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, paddingVertical: rp(12), marginLeft: rp(8), color: "#111827" }}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(8), paddingBottom: rp(8) }}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setStatusFilter(f)}
                style={{
                  paddingHorizontal: rp(14),
                  paddingVertical: rp(8),
                  borderRadius: rp(99),
                  backgroundColor: statusFilter === f ? ACCENT_COLOR : "#fff",
                  borderWidth: rp(1),
                  borderColor: statusFilter === f ? ACCENT_COLOR : "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: rs(11), fontWeight: "800", color: statusFilter === f ? "#fff" : "#6B7280", letterSpacing: rs(1) }}>
                  {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label || f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={{ color: "#6B7280", fontSize: rs(11), marginVertical: rp(8), fontWeight: "600" }}>
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
                  borderRadius: rp(24),
                  padding: rp(16),
                  marginBottom: rp(12),
                  flexDirection: "row",
                  alignItems: "center",
                  borderLeftWidth: rp(4),
                  borderLeftColor: cfg.color,
                  ...cardShadow,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(18) }}>{car.plate}</Text>
                  <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>{car.color} {car.make}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6), flexWrap: "wrap", gap: rp(6) }}>
                    {car.zone && car.slot && (
                      <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                        <Text style={{ color: "#374151", fontSize: rs(10), fontWeight: "700" }}>
                          {car.zone}-{car.slot}
                        </Text>
                      </View>
                    )}
                    <Text style={{ color: "#9CA3AF", fontSize: rs(11) }}>
                      {car.check_in_time ? new Date(car.check_in_time).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : "Just now"}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(99), backgroundColor: cfg.color }}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: rs(10), letterSpacing: rs(0.5) }}>{cfg.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginTop: rp(8) }} />
                </View>
              </TouchableOpacity>
            );
          })}
          {filteredCars.length === 0 && (
            <View style={{ alignItems: "center", marginTop: rp(40) }}>
              <Text style={{ fontSize: rs(48) }}>🚗</Text>
              <Text style={{ color: "#6B7280", marginTop: rp(8), fontWeight: "700" }}>No cars yet</Text>
            </View>
          )}
        </ScrollView>
      )}

      {tab === "employees" && (
        <ScrollView style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }} contentContainerStyle={{ paddingBottom: rp(100) }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginBottom: rp(16), gap: rp(8) }}>
            <TouchableOpacity
              onPress={assignAll}
              disabled={assigningAll || drivers.filter(d => (d.available || d.assigned) && !d.assigned).length === 0}
              style={{
                backgroundColor: assigningAll ? "#F3F4F6" : ACCENT_COLOR,
                borderRadius: rp(12),
                paddingVertical: rp(7),
                paddingHorizontal: rp(14),
                flexDirection: "row",
                alignItems: "center",
                opacity: drivers.filter(d => (d.available || d.assigned) && !d.assigned).length === 0 ? 0.5 : 1,
              }}
            >
              {assigningAll ? (
                <ActivityIndicator size="small" color={ACCENT_COLOR} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(12), marginLeft: rp(6), letterSpacing: rs(1) }}>ASSIGN ALL</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {drivers.length === 0 && (
            <View style={{ alignItems: "center", marginTop: rp(40) }}>
              <Text style={{ fontSize: rs(48) }}>👥</Text>
              <Text style={{ color: "#6B7280", marginTop: rp(8), fontWeight: "700" }}>No drivers</Text>
            </View>
          )}

          {drivers.map((d) => (
            <View key={d.id} style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(16), marginBottom: rp(12), ...cardShadow }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ backgroundColor: ACCENT_COLOR, borderRadius: rp(99), width: rp(48), height: rp(48), alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(18) }}>{d.name?.[0]?.toUpperCase()}</Text>
                </View>
                <TouchableOpacity
                  style={{ flex: 1, marginLeft: rp(12) }}
                  onPress={() => router.push({ pathname: "/(admin)/driver-stats", params: { driverId: d.id, driverName: d.name } })}
                >
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(15) }}>{d.name}</Text>
                  <Text style={{ color: "#6B7280", fontSize: rs(12) }}>{d.employee_id}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(4) }}>
                    <View style={{ width: rp(8), height: rp(8), borderRadius: rp(99), marginRight: rp(6), backgroundColor: d.available ? "#059669" : "#F43F5E" }} />
                    <Text style={{ fontSize: rs(11), fontWeight: "700", color: d.available ? "#059669" : "#F43F5E" }}>
                      {d.available ? "Available" : `In ${d.conflict_event_name || "another event"}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", marginTop: rp(10), gap: rp(10) }}>
                <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                  <Text style={{ color: "#059669", fontSize: rs(11), fontWeight: "700" }}>Checked in: {d.cars_checked_in || 0}</Text>
                </View>
                <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                  <Text style={{ color: "#0EA5E9", fontSize: rs(11), fontWeight: "700" }}>Retrieved: {d.cars_retrieved || 0}</Text>
                </View>
              </View>
              {d.available || d.assigned ? (
                <TouchableOpacity
                  onPress={() => toggleAssign(d)}
                  disabled={assigningId === d.id}
                  activeOpacity={0.7}
                  style={{
                    marginTop: rp(12),
                    borderRadius: rp(14),
                    paddingVertical: rp(12),
                    alignItems: "center",
                    backgroundColor: d.assigned ? "transparent" : ACCENT_COLOR,
                    borderWidth: d.assigned ? 1.5 : 0,
                    borderColor: "#F43F5E",
                    opacity: assigningId === d.id ? 0.7 : 1,
                  }}
                >
                  {assigningId === d.id ? (
                    <ActivityIndicator size="small" color={d.assigned ? "#F43F5E" : "#fff"} />
                  ) : (
                    <Text style={{ fontWeight: "900", letterSpacing: rs(1.5), color: d.assigned ? "#F43F5E" : "#fff", fontSize: rs(13) }}>
                      {d.assigned ? "UNASSIGN" : "ASSIGN"}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={{ marginTop: rp(12), backgroundColor: "#F3F4F6", borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center" }}>
                  <Text style={{ color: "#9CA3AF", fontSize: rs(11) }}>In {d.conflict_event_name}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {tab === "stats" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
        >
          <TouchableOpacity onPress={fetchStats} style={{ backgroundColor: "#fff", borderRadius: rp(16), paddingVertical: rp(10), alignItems: "center", marginBottom: rp(16), borderWidth: rp(1), borderColor: "#E5E7EB" }}>
            <Text style={{ color: ACCENT_COLOR, fontWeight: "800", letterSpacing: rs(1) }}>↻ Refresh Stats</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: rp(16) }}>
            {[
              { label: "TOTAL CARS", value: stats?.total_cars ?? 0, color: "#1D4ED8", icon: "car" },
              { label: "PRE-REGISTERED", value: stats?.pre_registered ?? 0, color: "#7C3AED", icon: "bookmark", sub: "arrived with pass" },
              { label: "WALK-IN", value: stats?.walk_in ?? 0, color: "#059669", icon: "walk", sub: "direct check-in" },
              { label: "DELIVERED", value: stats?.total_delivered ?? 0, color: "#6B7280", icon: "checkmark-circle" },
              { label: "STILL PARKED", value: stats?.still_parked ?? 0, color: "#F59E0B", icon: "time" },
              { label: "INCIDENTS", value: stats?.total_incidents ?? 0, color: (stats?.total_incidents > 0 ? "#EF4444" : "#059669"), icon: "warning" },
              { label: "PEAK HOUR", value: stats?.peak_hour ?? "—", color: "#4F46E5", icon: "trending-up" },
              { label: "AVG RATING", value: stats?.avg_rating ?? 0, color: "#F59E0B", icon: "star" },
              { label: "AVG RETRIEVAL", value: stats?.avg_retrieval_minutes ? `${stats.avg_retrieval_minutes} min` : "0 min", color: "#0891B2", icon: "timer" },
              { label: "TOP DRIVER", value: stats?.top_driver ?? "—", color: "#0F2044", icon: "trophy" },
            ].map((s, idx) => (
              <View
                key={idx}
                style={{
                  width: "48%",
                  backgroundColor: "#fff",
                  borderRadius: rp(16),
                  padding: rp(16),
                  marginBottom: rp(12),
                  borderLeftWidth: rp(4),
                  borderLeftColor: s.color,
                  ...cardShadow,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rp(4) }}>
                  <Ionicons name={s.icon} size={16} color={s.color} />
                </View>
                <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#111827" }}>{s.value}</Text>
                <Text style={{ fontSize: rs(10), color: "#6B7280", fontWeight: "800", marginTop: rp(2) }}>{s.label}</Text>
                {s.sub && <Text style={{ fontSize: rs(9), color: "#9CA3AF", marginTop: rp(1) }}>{s.sub}</Text>}
              </View>
            ))}
          </View>

          {isClosed && (
            <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(20), marginBottom: rp(16), ...cardShadow }}>
              <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(16) }}>
                PARKING SUMMARY
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: rp(16) }}>
                <View style={{ width: "45%" }}>
                  <Text style={{ fontSize: rs(24), fontWeight: "900", color: "#7C3AED" }}>{slots.length}</Text>
                  <Text style={{ fontSize: rs(10), color: "#9CA3AF", fontWeight: "800" }}>TOTAL SLOTS</Text>
                </View>
                <View style={{ width: "45%" }}>
                  <Text style={{ fontSize: rs(24), fontWeight: "900", color: "#059669" }}>{slots.filter(s => s.is_occupied).length}</Text>
                  <Text style={{ fontSize: rs(10), color: "#9CA3AF", fontWeight: "800" }}>SLOTS USED</Text>
                </View>
                <View style={{ width: "45%" }}>
                  <Text style={{ fontSize: rs(24), fontWeight: "900", color: "#0EA5E9" }}>{keyStats?.total_hooks || 0}</Text>
                  <Text style={{ fontSize: rs(10), color: "#9CA3AF", fontWeight: "800" }}>TOTAL KEY HOOKS</Text>
                </View>
                <View style={{ width: "45%" }}>
                  <Text style={{ fontSize: rs(24), fontWeight: "900", color: "#F59E0B" }}>{keyStats?.returned || 0}</Text>
                  <Text style={{ fontSize: rs(10), color: "#9CA3AF", fontWeight: "800" }}>KEYS RETURNED</Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={exportCSV}
            disabled={exportingCSV}
            style={{
              backgroundColor: exportingCSV ? "#D1FAE5" : "#ECFDF5",
              borderRadius: rp(14),
              paddingVertical: rp(12),
              alignItems: "center",
              marginBottom: rp(16),
              borderWidth: rp(1),
              borderColor: "#6EE7B7",
              flexDirection: "row",
              justifyContent: "center",
              gap: rp(6),
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
              fontSize: rs(13),
              marginLeft: rp(6),
            }}>
              {exportingCSV ? "Generating..." : "Export CSV"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={exportPDF}
            disabled={exportingPDF}
            style={{
              backgroundColor: exportingPDF ? "#EDE9FE" : "#F5F3FF",
              borderRadius: rp(14),
              paddingVertical: rp(12),
              alignItems: "center",
              marginBottom: rp(16),
              borderWidth: rp(1),
              borderColor: "#DDD6FE",
              flexDirection: "row",
              justifyContent: "center",
              gap: rp(6),
            }}
          >
            {exportingPDF ? (
              <ActivityIndicator size="small" color={ACCENT_COLOR} />
            ) : (
              <Ionicons name="document-outline" size={16}
                color={ACCENT_COLOR} />
            )}
            <Text style={{ color: ACCENT_COLOR, fontWeight: "800",
              fontSize: rs(13), marginLeft: rp(6) }}>
              {exportingPDF ? "Generating..." : "Export PDF Report"}
            </Text>
          </TouchableOpacity>
          <View style={{ height: rp(40) }} />
        </ScrollView>
      )}

      {tab === "incidents" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
        >
          {incidents.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: rp(60) }}>
              <View
                style={{
                  width: rp(80),
                  height: rp(80),
                  borderRadius: rp(40),
                  backgroundColor: "#D1FAE5",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: rp(16),
                }}
              >
                <Ionicons name="checkmark-circle" size={40} color="#059669" />
              </View>
              <Text style={{ fontSize: rs(18), fontWeight: "900", color: "#111827" }}>
                All Good!
              </Text>
              <Text style={{ color: "#6B7280", marginTop: rp(4), fontWeight: "600" }}>
                No incidents reported for this event
              </Text>
            </View>
          ) : (
            incidents.map((i) => (
              <View
                key={i.id}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: rp(24),
                  padding: rp(16),
                  marginBottom: rp(12),
                  ...cardShadow,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: rp(12),
                  }}
                >
                  <View
                    style={{
                      backgroundColor: "#111827",
                      paddingHorizontal: rp(10),
                      paddingVertical: rp(4),
                      borderRadius: rp(8),
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(13) }}>
                      {i.plate}
                    </Text>
                  </View>
                  <Text style={{ color: "#9CA3AF", fontSize: rs(11), fontWeight: "700" }}>
                    {new Date(i.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: 'Asia/Kolkata'
                    })}
                  </Text>
                </View>
                <Text style={{ color: "#374151", fontSize: rs(14), lineHeight: rp(20), marginBottom: rp(12) }}>
                  {i.description}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderTopWidth: rp(1),
                    borderTopColor: "#F3F4F6",
                    paddingTop: rp(12),
                  }}
                >
                  <Ionicons name="person-outline" size={14} color="#6B7280" />
                  <Text style={{ color: "#6B7280", fontSize: rs(12), marginLeft: rp(6), fontWeight: "600" }}>
                    Driver: {i.driver_name || "—"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {tab === "slots" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: rp(16), paddingBottom: rp(100) }}>
          
          {/* Internal sub-tab toggle */}
          <View style={{ backgroundColor: "#fff", flexDirection: "row", borderRadius: rp(18), padding: rp(4), marginBottom: rp(16), ...cardShadow }}>
            <TouchableOpacity
              onPress={() => setSlotTab("parking")}
              style={{
                flex: 1, paddingVertical: rp(10), borderRadius: rp(14),
                backgroundColor: slotTab === "parking" ? ACCENT_COLOR : "transparent",
                alignItems: "center", flexDirection: "row", justifyContent: "center", gap: rp(6)
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: rs(13), color: slotTab === "parking" ? "#fff" : "#6B7280" }}>🅿 Parking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSlotTab("keys")}
              style={{
                flex: 1, paddingVertical: rp(10), borderRadius: rp(14),
                backgroundColor: slotTab === "keys" ? ACCENT_COLOR : "transparent",
                alignItems: "center", flexDirection: "row", justifyContent: "center", gap: rp(6)
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: rs(13), color: slotTab === "keys" ? "#fff" : "#6B7280" }}>🔑 Keys</Text>
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
                  <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(20), marginBottom: rp(16), ...cardShadow }}>
                    <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(12) }}>CAPACITY OVERVIEW</Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: rp(12) }}>
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: rs(28), fontWeight: "900", color: "#111827" }}>{occupied}</Text>
                        <Text style={{ fontSize: rs(11), color: "#6B7280", fontWeight: "700" }}>OCCUPIED</Text>
                      </View>
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: rs(28), fontWeight: "900", color: "#059669" }}>{free}</Text>
                        <Text style={{ fontSize: rs(11), color: "#6B7280", fontWeight: "700" }}>FREE</Text>
                      </View>
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: rs(28), fontWeight: "900", color: ACCENT_COLOR }}>{total}</Text>
                        <Text style={{ fontSize: rs(11), color: "#6B7280", fontWeight: "700" }}>TOTAL</Text>
                      </View>
                    </View>
                    <View style={{ height: rp(10), backgroundColor: "#F3F4F6", borderRadius: rp(99), overflow: "hidden" }}>
                      <View style={{ height: rp(10), width: `${pct}%`, backgroundColor: barColor, borderRadius: rp(99) }} />
                    </View>
                    <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(8), textAlign: "right" }}>{pct}% full</Text>
                  </View>
                );
              })()}

              {/* Zone Selector */}
              {(() => {
                const zones = [...new Set(slots.map(s => s.zone_name))];
                if (!selectedZone && zones.length > 0) setSelectedZone(zones[0]);
                return (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: rp(16) }}>
                    {zones.map(z => {
                      const zSlots = slots.filter(s => s.zone_name === z);
                      const zOcc = zSlots.filter(s => s.is_occupied).length;
                      return (
                        <TouchableOpacity
                          key={z}
                          onPress={() => setSelectedZone(z)}
                          style={{
                            backgroundColor: selectedZone === z ? ACCENT_COLOR : "#fff",
                            borderRadius: rp(16),
                            paddingHorizontal: rp(16),
                            paddingVertical: rp(10),
                            marginRight: rp(10),
                            ...cardShadow,
                          }}
                        >
                          <Text style={{ fontWeight: "800", fontSize: rs(13), color: selectedZone === z ? "#fff" : "#111827" }}>Zone {z}</Text>
                          <Text style={{ fontSize: rs(11), color: selectedZone === z ? "rgba(255,255,255,0.8)" : "#9CA3AF", marginTop: rp(2) }}>{zOcc}/{zSlots.length} occupied</Text>
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
                  <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(16), ...cardShadow }}>
                    <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(16) }}>ZONE {selectedZone} — SLOT MAP</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(8) }}>
                      {zoneSlots.map(s => (
                        <View
                          key={s.id}
                          style={{
                            width: rp(56),
                            height: rp(56),
                            borderRadius: rp(14),
                            backgroundColor: s.is_occupied ? "#FEE2E2" : "#D1FAE5",
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: rp(1.5),
                            borderColor: s.is_occupied ? "#FECACA" : "#A7F3D0",
                          }}
                        >
                          <Ionicons name={s.is_occupied ? "car" : "car-outline"} size={16} color={s.is_occupied ? "#EF4444" : "#059669"} />
                          <Text style={{ fontSize: rs(11), fontWeight: "800", color: s.is_occupied ? "#EF4444" : "#059669", marginTop: rp(2) }}>{s.slot_number}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })()}
            </>
          ) : (
            <>
              {/* Summary card */}
              {keyStats && (
                <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(20), marginBottom: rp(16), ...cardShadow }}>
                  <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(14) }}>KEY BOARD STATUS</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: rp(16) }}>
                    {[
                      { label: "IN BOOTH", value: keyStats.in_booth, color: ACCENT_COLOR },
                      { label: "AVAILABLE", value: keyStats.hooks_available, color: "#059669" },
                      { label: "RETURNED", value: keyStats.returned, color: "#9CA3AF" },
                      { label: "TOTAL HOOKS", value: keyStats.total_hooks, color: "#0EA5E9" },
                    ].map(s => (
                      <View key={s.label} style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: rs(24), fontWeight: "900", color: s.color }}>{s.value}</Text>
                        <Text style={{ fontSize: rs(9), fontWeight: "800", color: "#9CA3AF", letterSpacing: rs(1.5), marginTop: rp(4), textAlign: "center" }}>{s.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Capacity bar */}
                  {(() => {
                    const pct = keyStats.total_hooks > 0 ? Math.round((keyStats.in_booth / keyStats.total_hooks) * 100) : 0;
                    const barColor = pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : ACCENT_COLOR;
                    return (
                      <>
                        <View style={{ height: rp(8), backgroundColor: "#F3F4F6", borderRadius: rp(99), overflow: "hidden" }}>
                          <View style={{ height: rp(8), width: `${pct}%`, backgroundColor: barColor, borderRadius: rp(99) }} />
                        </View>
                        <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginTop: rp(6), textAlign: "right" }}>{pct}% full</Text>
                      </>
                    );
                  })()}

                  {/* Full board warning */}
                  {keyStats.hooks_full && (
                    <View style={{ backgroundColor: "#FEE2E2", borderRadius: rp(14), padding: rp(12), marginTop: rp(8), flexDirection: "row", alignItems: "center", gap: rp(8) }}>
                      <Ionicons name="warning" size={18} color="#EF4444" />
                      <Text style={{ color: "#991B1B", fontWeight: "800", fontSize: rs(13), flex: 1 }}>Key board is full — no hooks available</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Untagged warning */}
              {keyStats?.untagged_count > 0 && (
                <View style={{ backgroundColor: "#FEF3C7", borderRadius: rp(16), padding: rp(14), marginBottom: rp(16), flexDirection: "row", alignItems: "center", gap: rp(10), borderWidth: rp(1), borderColor: "#FDE68A" }}>
                  <Ionicons name="warning" size={20} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: "#92400E", fontSize: rs(13) }}>{keyStats.untagged_count} car(s) have no key tag</Text>
                    <Text style={{ color: "#B45309", fontSize: rs(11), marginTop: rp(2) }}>Ask drivers to add key tag numbers for these cars</Text>
                  </View>
                </View>
              )}

              {/* Keys in booth */}
              {keys.filter(k => k.in_booth).length > 0 && (
                <>
                  <Text style={{ fontSize: rs(11), fontWeight: "800", color: ACCENT_COLOR, letterSpacing: rs(3), marginBottom: rp(10) }}>IN BOOTH ({keys.filter(k => k.in_booth).length})</Text>
                  {keys.filter(k => k.in_booth).map(k => (
                    <View key={k.car_id} style={{ backgroundColor: "#fff", borderRadius: rp(16), padding: rp(14), marginBottom: rp(8), flexDirection: "row", alignItems: "center", borderLeftWidth: rp(4), borderLeftColor: ACCENT_COLOR, ...cardShadow }}>
                      <View style={{ backgroundColor: "#F5F3FF", borderRadius: rp(12), width: rp(44), height: rp(44), alignItems: "center", justifyContent: "center", marginRight: rp(12) }}>
                        <Ionicons name="key" size={16} color={ACCENT_COLOR} />
                        <Text style={{ fontSize: rs(10), fontWeight: "900", color: ACCENT_COLOR, marginTop: rp(1) }}>#{k.key_tag}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(14) }}>{k.plate}</Text>
                        <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>{k.color} {k.make}{k.zone ? ` · Zone ${k.zone} Slot ${k.slot}` : ""}</Text>
                      </View>
                      <View style={{ backgroundColor: "#EDE9FE", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                        <Text style={{ fontSize: rs(10), fontWeight: "800", color: ACCENT_COLOR, letterSpacing: rs(1) }}>{k.status === "RETRIEVAL_REQUESTED" ? "REQUESTED" : k.status === "BEING_FETCHED" ? "FETCHING" : "PARKED"}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Returned keys */}
              {keys.filter(k => !k.in_booth).length > 0 && (
                <>
                  <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#059669", letterSpacing: rs(3), marginTop: rp(8), marginBottom: rp(10) }}>RETURNED ({keys.filter(k => !k.in_booth).length})</Text>
                  {keys.filter(k => !k.in_booth).map(k => (
                    <View key={k.car_id} style={{ backgroundColor: "#fff", borderRadius: rp(16), padding: rp(14), marginBottom: rp(8), flexDirection: "row", alignItems: "center", borderLeftWidth: rp(4), borderLeftColor: "#D1FAE5", opacity: 0.75, ...cardShadow }}>
                      <View style={{ backgroundColor: "#D1FAE5", borderRadius: rp(12), width: rp(44), height: rp(44), alignItems: "center", justifyContent: "center", marginRight: rp(12) }}>
                        <Ionicons name="key-outline" size={16} color="#059669" />
                        <Text style={{ fontSize: rs(10), fontWeight: "900", color: "#059669", marginTop: rp(1) }}>#{k.key_tag}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "900", color: "#374151", fontSize: rs(14) }}>{k.plate}</Text>
                        <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginTop: rp(2) }}>{k.color} {k.make} · Delivered</Text>
                      </View>
                      <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                        <Text style={{ fontSize: rs(10), fontWeight: "800", color: "#059669", letterSpacing: rs(1) }}>RETURNED</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Empty state */}
              {keys.length === 0 && (
                <View style={{ backgroundColor: "#fff", borderRadius: rp(20), padding: rp(40), alignItems: "center", ...cardShadow }}>
                  <Ionicons name="key-outline" size={44} color="#D1D5DB" />
                  <Text style={{ color: "#9CA3AF", fontWeight: "700", marginTop: rp(12), fontSize: rs(15) }}>No key tags recorded yet</Text>
                  <Text style={{ color: "#D1D5DB", fontSize: rs(12), marginTop: rp(6), textAlign: "center" }}>Drivers add key tags from their tasks screen after parking</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Modals same as admin but with ACCENT_COLOR */}
      <Modal visible={showCarModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), padding: rp(20), maxHeight: "85%" }}>
            <View style={{ alignItems: "center", marginBottom: rp(12) }}><View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} /></View>
            <ScrollView>
              {selectedCar && (
                <>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: rs(28), fontWeight: "900", color: ACCENT_COLOR }}>{selectedCar.plate}</Text>
                      <Text style={{ color: "#6B7280", marginTop: rp(4) }}>{selectedCar.color} {selectedCar.make}</Text>
                    </View>
                    <View style={{ paddingHorizontal: rp(12), paddingVertical: rp(4), borderRadius: rp(99), backgroundColor: STATUS_CONFIG[selectedCar.status]?.color }}>
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: rs(11) }}>{STATUS_CONFIG[selectedCar.status]?.label}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => { setShowCarModal(false); router.push({ pathname: "/(admin)/car-log", params: { car_id: selectedCar.id } }); }} 
                    style={{ backgroundColor: "#111827", borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(20), flexDirection: "row", justifyContent: "center" }} 
                  > 
                    <Ionicons name="time-outline" size={18} color="#fff" /> 
                    <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>VIEW FULL LOG</Text> 
                  </TouchableOpacity> 
                  <TouchableOpacity onPress={() => setShowCarModal(false)} style={{ paddingVertical: rp(10), alignItems: "center", marginBottom: rp(12) }}>
                    <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showIncidentModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), padding: rp(20), maxHeight: "92%" }}>
              <View style={{ alignItems: "center", marginBottom: rp(14) }}><View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} /></View>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(16) }}>
                <View style={{ backgroundColor: "#FEF3C7", borderRadius: rp(99), padding: rp(8), marginRight: rp(10) }}><Ionicons name="warning" size={20} color="#F59E0B" /></View>
                <Text style={{ fontSize: rs(18), fontWeight: "900", color: "#111827", flex: 1 }}>Report Incident</Text>
                <TouchableOpacity onPress={() => setShowIncidentModal(false)}><Ionicons name="close-circle" size={26} color="#D1D5DB" /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={modalLabel}>SELECT CAR *</Text>
                <View style={{ backgroundColor: "#F9FAFB", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: rp(12), marginBottom: rp(6) }}>
                  <Ionicons name="search" size={16} color={ACCENT_COLOR} />
                  <TextInput value={incidentCarSearch} onChangeText={setIncidentCarSearch} placeholder="Search plate..." style={{ flex: 1, paddingVertical: rp(13), paddingLeft: rp(8), color: "#111827", fontWeight: "700" }} />
                </View>
                {incidentCarSearch.length > 1 && !incidentCar && (
                  <View style={{ backgroundColor: "#fff", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", marginBottom: rp(12), overflow: "hidden" }}>
                    {cars.filter(c => c.plate.toLowerCase().includes(incidentCarSearch.toLowerCase())).slice(0, 5).map(c => (
                      <TouchableOpacity key={c.id} onPress={() => { setIncidentCar(c); setIncidentCarSearch(c.plate); }} style={{ padding: rp(14), borderBottomWidth: rp(1), borderBottomColor: "#F3F4F6", flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ fontWeight: "900", color: "#111827" }}>{c.plate}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {incidentCar && <View style={{ backgroundColor: "#D1FAE5", borderRadius: rp(12), padding: rp(12), marginBottom: rp(16) }}><Text style={{ color: "#059669", fontWeight: "800" }}>{incidentCar.plate} selected</Text></View>}
                <Text style={modalLabel}>DESCRIPTION *</Text>
                <TextInput value={incidentDesc} onChangeText={setIncidentDesc} placeholder="Describe what happened..." multiline numberOfLines={4} style={[modalInput, { height: rp(100), textAlignVertical: "top" }]} />
                <TouchableOpacity onPress={pickIncidentPhoto} style={{ borderWidth: rp(1.5), borderColor: incidentPhoto ? "#059669" : "#E5E7EB", borderStyle: "dashed", borderRadius: rp(14), padding: rp(16), alignItems: "center", marginBottom: rp(20) }}>
                  <Text style={{ color: incidentPhoto ? "#059669" : "#9CA3AF", fontWeight: "700" }}>{incidentPhoto ? "Photo Added ✓" : "Add Photo (Optional)"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={submitIncident} disabled={submittingIncident} style={{ backgroundColor: "#F59E0B", borderRadius: rp(18), paddingVertical: rp(18), alignItems: "center", marginBottom: rp(24) }}>
                  {submittingIncident ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>SUBMIT INCIDENT</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const iconBtn = { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(10) };
const modalLabel = { fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(2), marginBottom: rp(8) };
const modalInput = { backgroundColor: "#F9FAFB", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", padding: rp(14), color: "#111827", marginBottom: rp(16), fontSize: rs(14) };
const exportBtn = { flex: 1, borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center", borderWidth: rp(1), flexDirection: "row", justifyContent: "center" };
