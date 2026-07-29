import { useEffect, useState, useMemo, useCallback } from "react";
import QRCode from "react-native-qrcode-svg";
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
  BackHandler,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
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

const INCIDENT_TYPES = [
  { key: "DAMAGE", label: "Damage", icon: "🚗" },
  { key: "THEFT", label: "Theft", icon: "🔓" },
  { key: "WRONG_CAR", label: "Wrong Car", icon: "🔄" },
  { key: "DELAY", label: "Delay", icon: "⏱️" },
  { key: "KEY_LOST", label: "Key Lost", icon: "🔑" },
  { key: "ACCIDENT", label: "Accident", icon: "💥" },
  { key: "MISCONDUCT", label: "Misconduct", icon: "⚠️" },
  { key: "GUEST_COMPLAINT", label: "Guest Complaint", icon: "👤" },
  { key: "OTHER", label: "Other", icon: "📝" },
];

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
  const { showQr } = useLocalSearchParams();

  useEffect(() => {
    const backAction = () => {
      if (showIncidentModal) { setShowIncidentModal(false); return true; }
      if (showCarModal) { setShowCarModal(false); return true; }
      if (showSOSPanel) { setShowSOSPanel(false); return true; }
      router.back(); return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [showIncidentModal, showCarModal, showSOSPanel]);

  const { currentEventId } = useAppStore();
  const [event, setEvent] = useState(null);
  const [showEventQRModal, setShowEventQRModal] = useState(false);
  const [eventQrToken, setEventQrToken] = useState(null);

  useEffect(() => {
    if (showQr === 'true' && currentEventId) {
      setShowEventQRModal(true);
    }
  }, [showQr, currentEventId]);
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
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [assignSuggestion, setAssignSuggestion] = useState(null);
  const [assigningDriver, setAssigningDriver] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [slots, setSlots] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentCar, setIncidentCar] = useState(null);
  const [incidentDriver, setIncidentDriver] = useState(null);
  const [incidentType, setIncidentType] = useState("");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [incidentPhoto, setIncidentPhoto] = useState(null);
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [incidentCarSearch, setIncidentCarSearch] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingIncident, setResolvingIncident] = useState(null);
  const [resolveStatus, setResolveStatus] = useState("IN_REVIEW");
  const [resolveRemark, setResolveRemark] = useState("");
  const [submittingResolve, setSubmittingResolve] = useState(false);
  const [resolveErrors, setResolveErrors] = useState({});
  const [incidentErrors, setIncidentErrors] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [sosAlerts, setSOSAlerts] = useState([]);
  const [sosCount, setSOSCount] = useState(0);
  const [showSOSPanel, setShowSOSPanel] = useState(false);
  const [resolvingSOSId, setResolvingSOSId] = useState(null);

  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}`);
      setEvent(data);
      try {
        const { data: qrData } = await api.get(`/events/${currentEventId}/qr-token`);
        setEventQrToken(qrData.event_qr_token);
      } catch {}
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

  const fetchSOSAlerts = useCallback(async () => {
    if (!currentEventId) return;
    try {
      const { data } = await api.get(`/sos/event/${currentEventId}`);
      setSOSAlerts(data || []);
      setSOSCount((data || []).filter(a => a.status === "ACTIVE").length);
    } catch {}
  }, [currentEventId]);

  const resolveSOSAlert = async (alertId) => {
    Alert.alert(
      "Resolve SOS Alert",
      "Mark this SOS alert as resolved?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => doResolveSOSAlert(alertId) }
      ]
    );
  };

  const doResolveSOSAlert = async (alertId) => {
    setResolvingSOSId(alertId);
    try {
      await api.patch(`/sos/${alertId}/resolve`);
      fetchSOSAlerts();
    } catch {
      Alert.alert("Error", "Failed to resolve alert.");
    } finally {
      setResolvingSOSId(null);
    }
  };

  useEffect(() => {
    if (!currentEventId) return;
    Promise.all([fetchEvent(), fetchCars(), fetchDrivers(), fetchStats(), fetchSlots(), fetchIncidents(), fetchKeys(), fetchSOSAlerts()]);
    connectWS(`/event/${currentEventId}`, (msg) => {
      if (msg.type === "car_update") fetchCars();
      if (msg.type === "slot_update") fetchSlots();
    });
    connectWS(`/sos/${currentEventId}`, (msg) => {
      if (msg.type === "sos_alert" || msg.type === "sos_resolved") fetchSOSAlerts();
    });
    return () => {
      disconnectWS(`/event/${currentEventId}`);
      disconnectWS(`/sos/${currentEventId}`);
    };
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

  const openAssignPicker = async () => {
    setShowAssignPicker(true);
    setAssignSuggestion(null);
    if (selectedCar.status === "RETRIEVAL_REQUESTED" || selectedCar.status === "BEING_FETCHED") {
      try {
        const { data } = await api.get(`/cars/${selectedCar.id}/suggest-retrieval-driver`);
        setAssignSuggestion(data.suggestion || null);
      } catch {
        setAssignSuggestion(null);
      }
    }
  };

  const handleAssignDriver = async (driverId, driverName) => {
    Alert.alert(
      "Confirm Assignment",
      `Assign ${driverName} to ${selectedCar?.plate}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => doAssign(driverId) }
      ]
    );
  };

  const doAssign = async (driverId) => {
    const stage = (selectedCar.status === "RETRIEVAL_REQUESTED" || selectedCar.status === "BEING_FETCHED") ? "retrieval" : "checkin";
    setAssigningDriver(true);
    try {
      await api.patch(`/cars/${selectedCar.id}/reassign-driver`, { driver_id: driverId, stage });
      setShowAssignPicker(false);
      setShowCarModal(false);
      fetchCars();
      fetchDrivers();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to assign driver");
    } finally {
      setAssigningDriver(false);
    }
  };

  const submitResolve = async () => {
    const errs = {};
    if ((resolveStatus === "RESOLVED" || resolveStatus === "DISMISSED") && !resolveRemark.trim()) {
      errs.remark = "Please provide a remark when resolving or dismissing.";
    }
    setResolveErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmittingResolve(true);
    try {
      await api.patch(`/incidents/${resolvingIncident.id}`, {
        status: resolveStatus,
        remark: resolveRemark
      });
      setShowResolveModal(false);
      setResolvingIncident(null);
      setResolveStatus("IN_REVIEW");
      setResolveRemark("");
      setResolveErrors({});
      fetchIncidents();
      Alert.alert("Success", "Incident status updated successfully");
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "Failed to update incident status");
    } finally {
      setSubmittingResolve(false);
    }
  };

  const submitIncident = async () => {
    const errs = {};
    if (!incidentCar) errs.car = "Please select a car";
    if (!incidentType) errs.type = "Please select an incident type";
    if (!incidentDesc.trim()) errs.description = "Please add a description";
    setIncidentErrors(errs);
    if (Object.keys(errs).length > 0) return;
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
        incident_type: incidentType,
        description: incidentDesc.trim(),
        photo_url: photoUrl,
      });
      setShowIncidentModal(false);
      setIncidentCar(null);
      setIncidentDriver(null);
      setIncidentType("");
      setIncidentDesc("");
      setIncidentPhoto(null);
      setIncidentCarSearch("");
      setIncidentErrors({});
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
      const headers = ["Plate","Make","Color","Status","Zone","Slot","Key Tag","Check-in Driver","Retrieval Driver","Duration (min)","Retrieval Time (min)","Platform Rating","Driver Rating","Notes","Pre-registered","Walk-in","Peak Hour","Still Parked"].join(",");
      const rows = data.cars.map(c => [c.plate, c.make, c.color, c.status, c.zone || "", c.slot || "", c.key_tag || "", c.check_in_driver || "", c.retrieval_driver || "", c.duration_minutes || "", c.retrieval_minutes || "", c.rating || "", c.driver_rating || "", `"${(c.notes || "").replace(/"/g, "'")}"`, data.summary.pre_registered || 0, data.summary.walk_in || 0, data.summary.peak_hour || "—", data.summary.still_parked || 0].join(","));
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
      const driverRows = data.drivers.map(d => `<tr><td>${d.name}</td><td>${d.employee_id}</td><td>${d.checkins}</td><td>${d.parkings}</td><td>${d.retrievals}</td><td>${d.avg_rating != null ? d.avg_rating + "★" : "—"}</td><td style="color:${d.incidents > 0 ? "#EF4444" : "#6B7280"}">${d.incidents}</td></tr>`).join("");
      const incidentRows = data.incidents.length > 0 ? data.incidents.map(i => `<tr><td>${i.plate}</td><td>${i.driver_name || "—"}</td><td>${i.description}</td><td>${new Date(i.created_at).toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</td></tr>`).join("") : `<tr><td colspan="4" style="text-align:center; color:#9CA3AF;">No incidents</td></tr>`;

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;color:#111827;font-size:12px;}.header{background:${ACCENT_COLOR};color:white;padding:24px 28px;}.header h1{font-size:22px;font-weight:900;}.header p{opacity:0.8;margin-top:3px;font-size:12px;}.section{padding:20px 28px;border-bottom:1px solid #f3f4f6;}.section h2{font-size:11px;font-weight:800;color:${ACCENT_COLOR};letter-spacing:3px;margin-bottom:12px;text-transform:uppercase;}.stats{display:flex;gap:12px;flex-wrap:wrap;}.stat{background:#f9fafb;border-radius:10px;padding:12px 16px;text-align:center;min-width:100px;}.stat-val{font-size:22px;font-weight:900;color:#111827;}.stat-lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-top:3px;}table{width:100%;border-collapse:collapse;font-size:11px;}th{padding:8px;text-align:left;background:#f9fafb;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;}td{padding:8px;border-bottom:1px solid #f3f4f6;}.footer{padding:16px 28px;text-align:center;color:#9ca3af;font-size:10px;}</style></head><body><div class="header"><h1>${e.name}</h1><p>${e.date || ""} ${e.start_time ? "· " + e.start_time + " to " + e.end_time : ""} ${e.venue ? "· " + e.venue : ""}</p><p style="margin-top:6px;font-size:10px;opacity:0.6;">Generated ${new Date().toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</p></div><div class="section"><h2>Summary</h2><div class="stats"><div class="stat"><div class="stat-val">${s.total_cars}</div><div class="stat-lbl">Total Cars</div></div><div class="stat"><div class="stat-val">${s.pre_registered || 0}</div><div class="stat-lbl">Pre-Registered</div></div><div class="stat"><div class="stat-val">${s.walk_in || 0}</div><div class="stat-lbl">Walk-in</div></div><div class="stat"><div class="stat-val">${s.delivered}</div><div class="stat-lbl">Delivered</div></div><div class="stat"><div class="stat-val">${s.still_parked || 0}</div><div class="stat-lbl">Still Parked</div></div><div class="stat"><div class="stat-val">${s.avg_retrieval_minutes}m</div><div class="stat-lbl">Avg Retrieval</div></div><div class="stat"><div class="stat-val">${s.platform_avg_rating > 0 ? s.platform_avg_rating + "★" : "—"}</div><div class="stat-lbl">Platform Rating</div></div><div class="stat"><div class="stat-val">${s.driver_avg_rating > 0 ? s.driver_avg_rating + "★" : "—"}</div><div class="stat-lbl">Driver Rating</div></div><div class="stat"><div class="stat-val">${s.total_incidents}</div><div class="stat-lbl">Incidents</div></div><div class="stat"><div class="stat-val">${s.peak_hour || "—"}</div><div class="stat-lbl">Peak Hour</div></div><div class="stat"><div class="stat-val">${s.total_drivers}</div><div class="stat-lbl">Drivers</div></div></div></div><div class="section"><h2>Driver Performance</h2><table><thead><tr><th>Driver</th><th>Emp ID</th><th>Check-ins</th><th>Parkings</th><th>Retrievals</th><th>Avg Rating</th><th>Incidents</th></tr></thead><tbody>${driverRows}</tbody></table></div><div class="section"><h2>Incidents</h2><table><thead><tr><th>Plate</th><th>Driver</th><th>Description</th><th>Time</th></tr></thead><tbody>${incidentRows}</tbody></table></div><div class="section"><h2>All Vehicles (${s.total_cars})</h2><table><thead><tr><th>Plate</th><th>Vehicle</th><th>Status</th><th>Check-in By</th><th>Retrieved By</th><th>Duration</th><th>Rating</th><th>Notes</th></tr></thead><tbody>${carRows}</tbody></table></div><div class="footer">InstaPark — Smart Valet Operations · ${e.name}</div></body></html>`;

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
    Alert.alert(
      d.assigned ? "Remove Driver" : "Assign Driver",
      d.assigned ? `Remove ${d.name} from this event?` : `Assign ${d.name} to this event?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => doToggleAssign(d) }
      ]
    );
  };

  const doToggleAssign = async (d) => {
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
    Alert.alert(
      "Assign All Drivers",
      `Assign all ${available.length} available drivers to this event?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => doAssignAll(available) }
      ]
    );
  };

  const doAssignAll = async (available) => {
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
            <TouchableOpacity
              onPress={() => setShowSOSPanel(true)}
              style={{ position: "relative", padding: 8 }}
            >
              <Ionicons
                name="warning"
                size={24}
                color={sosCount > 0 ? "#DC2626" : "rgba(255,255,255,0.5)"}
              />
              {sosCount > 0 && (
                <View style={{
                  position: "absolute", top: 4, right: 4,
                  backgroundColor: "#DC2626",
                  borderRadius: 8, minWidth: 16, height: 16,
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 1.5, borderColor: "white",
                }}>
                  <Text style={{ color: "white", fontSize: 9, fontWeight: "700" }}>
                    {sosCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
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
                  onPress={() => { setShowMenu(false); router.push({ pathname: "/(admin)/edit-event", params: { eventId: currentEventId } }); }}
                >
                  <Ionicons name="create-outline" size={20} color={ACCENT_COLOR} />
                  <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: '#0F2044' }}>Edit Event</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
                <TouchableOpacity 
                  style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => { setShowMenu(false); setShowEventQRModal(true); }}
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
        <TouchableOpacity
          onPress={() => router.push("/(supervisor)/add-car")}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: ACCENT_COLOR, borderRadius: rp(14), paddingVertical: rp(14), marginHorizontal: rp(16), marginTop: rp(16) }}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(1.5), marginLeft: rp(8) }}>ADD CAR & ASSIGN DRIVER</Text>
        </TouchableOpacity>
      )}
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
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: rp(12) }}>
                  <View style={{ flexDirection: "column", gap: rp(4) }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8) }}>
                      <View style={{ backgroundColor: "#111827", paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(8) }}>
                        <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(13) }}>{i.plate}</Text>
                      </View>
                      <View style={{ paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(6), backgroundColor: i.status === "OPEN" ? "#FEE2E2" : i.status === "IN_REVIEW" ? "#FEF3C7" : i.status === "RESOLVED" ? "#D1FAE5" : "#F3F4F6" }}>
                        <Text style={{ color: i.status === "OPEN" ? "#991B1B" : i.status === "IN_REVIEW" ? "#92400E" : i.status === "RESOLVED" ? "#065F46" : "#4B5563", fontSize: rs(10), fontWeight: "800" }}>{i.status}</Text>
                      </View>
                    </View>
                    <Text style={{ color: "#6B7280", fontSize: rs(11), fontWeight: "700" }}>{(i.incident_type || "UNKNOWN").replace(/_/g, " ").replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase())}</Text>
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

                {(i.status === "RESOLVED" || i.status === "DISMISSED") && i.remark && (
                  <View style={{ backgroundColor: "#F3F4F6", borderRadius: rp(12), padding: rp(12), marginBottom: rp(12) }}>
                    <Text style={{ color: "#374151", fontSize: rs(13), lineHeight: 18 }}>{i.remark}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6) }}>
                      <Ionicons name="checkmark-done-circle" size={14} color="#6B7280" />
                      <Text style={{ color: "#6B7280", fontSize: rs(11), marginLeft: rp(4) }}>
                        Resolved by {i.resolved_by || "Unknown"} on {i.resolved_at ? new Date(i.resolved_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: 'Asia/Kolkata' }) : "Unknown"}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: rp(1), borderTopColor: "#F3F4F6", paddingTop: rp(12) }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="person-outline" size={14} color="#6B7280" />
                    <Text style={{ color: "#6B7280", fontSize: rs(12), marginLeft: rp(6), fontWeight: "600" }}>
                      Driver: {i.driver_name || "—"}
                    </Text>
                  </View>
                  {(i.status === "OPEN" || i.status === "IN_REVIEW") && (
                    <TouchableOpacity
                      onPress={() => { setResolvingIncident(i); setResolveStatus(i.status === "OPEN" ? "IN_REVIEW" : i.status); setResolveRemark(""); setShowResolveModal(true); }}
                      style={{ backgroundColor: "#F3F4F6", paddingHorizontal: rp(10), paddingVertical: rp(6), borderRadius: rp(12) }}
                    >
                      <Text style={{ color: "#111827", fontWeight: "700", fontSize: rs(12) }}>Update Status</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {i.photo_url && (
                  <Image
                    source={{ uri: i.photo_url }}
                    style={{ width: "100%", height: rp(200), borderRadius: rp(16), marginTop: rp(12) }}
                    resizeMode="cover"
                  />
                )}
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
                  {event?.key_hook_start != null && event?.key_hook_end != null && (
                    <View style={{ backgroundColor: "#EFF6FF", borderRadius: rp(99), paddingHorizontal: rp(12), paddingVertical: rp(6), marginBottom: rp(12), alignSelf: "flex-start" }}>
                      <Text style={{ color: "#1D4ED8", fontSize: rs(12), fontWeight: "800" }}>
                        Hook range for this event: {event.key_hook_start} – {event.key_hook_end}
                      </Text>
                    </View>
                  )}
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
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
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
                  {["CHECKED_IN", "RETRIEVAL_REQUESTED", "BEING_FETCHED"].includes(selectedCar.status) && !showAssignPicker && (
                    <TouchableOpacity
                      onPress={openAssignPicker}
                      style={{ backgroundColor: ACCENT_COLOR, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(20), flexDirection: "row", justifyContent: "center" }}
                    >
                      <Ionicons name="person-add-outline" size={18} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>
                        {(selectedCar.status === "RETRIEVAL_REQUESTED" || selectedCar.status === "BEING_FETCHED")
                          ? (selectedCar.retrieval_driver_id ? "REASSIGN DRIVER" : "ASSIGN DRIVER")
                          : (selectedCar.check_in_driver_id ? "REASSIGN DRIVER" : "ASSIGN DRIVER")}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {showAssignPicker && (
                    <View style={{ marginTop: rp(16), backgroundColor: "#F9FAFB", borderRadius: rp(20), padding: rp(16) }}>
                      {assignSuggestion && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(10), gap: rp(6) }}>
                          <Ionicons name="star" size={14} color="#059669" />
                          <Text style={{ color: "#059669", fontWeight: "800", fontSize: rs(12) }}>Suggested: {assignSuggestion.name}</Text>
                        </View>
                      )}
                      {drivers.filter(d => d.assigned && d.duty_status === "available").length === 0 ? (
                        <Text style={{ color: "#9CA3AF", fontSize: rs(13), textAlign: "center", paddingVertical: rp(12) }}>No available drivers right now</Text>
                      ) : (
                        drivers.filter(d => d.assigned && d.duty_status === "available").map(d => (
                          <TouchableOpacity
                            key={d.id}
                            disabled={assigningDriver}
                            onPress={() => handleAssignDriver(d.id, d.name)}
                            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: rp(12), borderBottomWidth: rp(1), borderBottomColor: "#E5E7EB" }}
                          >
                            <Text style={{ fontWeight: "700", color: "#111827" }}>{d.name}</Text>
                            {assignSuggestion?.id === d.id && <Ionicons name="star" size={14} color="#059669" />}
                          </TouchableOpacity>
                        ))
                      )}
                      <TouchableOpacity onPress={() => setShowAssignPicker(false)} style={{ paddingVertical: rp(10), alignItems: "center" }}>
                        <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity 
                    onPress={() => { setShowCarModal(false); router.push({ pathname: "/(admin)/car-log", params: { car_id: selectedCar.id } }); }} 
                    style={{ backgroundColor: "#111827", borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(12), flexDirection: "row", justifyContent: "center" }} 
                  > 
                    <Ionicons name="time-outline" size={18} color="#fff" /> 
                    <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>VIEW FULL LOG</Text> 
                  </TouchableOpacity> 
                  {selectedCar.qr_token && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowCarModal(false);
                        router.push({ pathname: "/(admin)/qr-display", params: { token: selectedCar.qr_token, plate: selectedCar.plate, carId: selectedCar.id, guestPhone: selectedCar.guest_phone || "" } });
                      }}
                      style={{ backgroundColor: "#7C3AED", borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(12) }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>VIEW QR</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => { setShowCarModal(false); setShowAssignPicker(false); }} style={{ paddingVertical: rp(10), alignItems: "center", marginBottom: rp(12) }}>
                    <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
                                      </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showIncidentModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), padding: rp(20), maxHeight: "92%" }}>
              <View style={{ alignItems: "center", marginBottom: rp(14) }}><View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} /></View>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(16) }}>
                <View style={{ backgroundColor: "#FEF3C7", borderRadius: rp(99), padding: rp(8), marginRight: rp(10) }}><Ionicons name="warning" size={20} color="#F59E0B" /></View>
                <Text style={{ fontSize: rs(18), fontWeight: "900", color: "#111827", flex: 1 }}>Report Incident</Text>
                <TouchableOpacity onPress={() => { setShowIncidentModal(false); setIncidentErrors({}); }}><Ionicons name="close-circle" size={26} color="#D1D5DB" /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={modalLabel}>SELECT CAR *</Text>
                {!incidentCar && (
                  <>
                    <View style={{ backgroundColor: "#F9FAFB", borderRadius: rp(14), borderWidth: rp(1), borderColor: incidentErrors.car ? "#EF4444" : "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: rp(12), marginBottom: incidentErrors.car ? rp(6) : rp(6) }}>
                      <Ionicons name="search" size={16} color={ACCENT_COLOR} />
                      <TextInput value={incidentCarSearch} onChangeText={(text) => { setIncidentCarSearch(text); if(incidentErrors.car) setIncidentErrors(prev => ({...prev, car: undefined})); }} placeholder="Search plate..." style={{ flex: 1, paddingVertical: rp(13), paddingLeft: rp(8), color: "#111827", fontWeight: "700" }} />
                    </View>
                    {incidentErrors.car && <Text style={[modalErrorText, { marginTop: rp(4), marginBottom: rp(12) }]}>* {incidentErrors.car}</Text>}
                    {incidentCarSearch.length > 1 && (
                      <View style={{ backgroundColor: "#fff", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", marginBottom: rp(12), overflow: "hidden" }}>
                        {cars.filter(c => c.plate.toLowerCase().includes(incidentCarSearch.toLowerCase())).slice(0, 5).map(c => (
                          <TouchableOpacity key={c.id} onPress={() => { setIncidentCar(c); setIncidentCarSearch(c.plate); if(incidentErrors.car) setIncidentErrors(prev => ({...prev, car: undefined})); }} style={{ padding: rp(14), borderBottomWidth: rp(1), borderBottomColor: "#F3F4F6", flexDirection: "row", alignItems: "center" }}>
                            <Text style={{ fontWeight: "900", color: "#111827" }}>{c.plate}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
                {incidentCar && (
                  <View style={{ backgroundColor: "#D1FAE5", borderRadius: rp(12), padding: rp(12), marginBottom: rp(16), flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                      <Ionicons name="checkmark-circle" size={18} color="#059669" />
                      <Text style={{ color: "#059669", fontWeight: "800", marginLeft: rp(8) }}>{incidentCar.plate} selected</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setIncidentCar(null); setIncidentCarSearch(""); }}>
                      <Ionicons name="close-circle" size={20} color="#059669" />
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={modalLabel}>DRIVER INVOLVED (OPTIONAL)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: rp(16) }}>
                  <View style={{ flexDirection: "row", gap: rp(8), paddingRight: rp(16) }}>
                    {[{ id: null, name: "None" }, ...drivers.filter(d => d.assigned)].map((d, idx) => (
                      <TouchableOpacity
                        key={d.id || `none-${idx}`}
                        onPress={() => setIncidentDriver(d.id ? d : null)}
                        style={{
                          paddingHorizontal: rp(14),
                          paddingVertical: rp(8),
                          borderRadius: rp(12),
                          borderWidth: rp(1),
                          backgroundColor:
                            (incidentDriver?.id ?? null) === d.id
                              ? ACCENT_COLOR : "#fff",
                          borderColor:
                            (incidentDriver?.id ?? null) === d.id
                              ? ACCENT_COLOR : "#E5E7EB",
                        }}
                      >
                        <Text style={{
                          fontWeight: "800",
                          fontSize: rs(13),
                          color:
                            (incidentDriver?.id ?? null) === d.id
                              ? "#fff" : "#374151",
                        }}>
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {/* Incident Type Picker */}
                <Text style={{ fontSize: rs(12), fontWeight: "700", color: "#0F2044", marginBottom: rp(8) }}>
                  Incident Type <Text style={{ color: "#EF4444" }}>*</Text>
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: incidentErrors.type ? rp(6) : rp(12) }}>
                  <View style={{ flexDirection: "row", gap: rp(8), paddingRight: rp(16) }}>
                    {INCIDENT_TYPES.map(t => (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => { setIncidentType(t.key); if(incidentErrors.type) setIncidentErrors(prev => ({...prev, type: undefined})); }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: rp(4),
                          paddingHorizontal: rp(12),
                          paddingVertical: rp(8),
                          borderRadius: rp(20),
                          borderWidth: 1.5,
                          borderColor: incidentErrors.type ? "#EF4444" : (incidentType === t.key ? "#0F2044" : "#E5E7EB"),
                          backgroundColor: incidentType === t.key ? "#0F2044" : "#F9FAFB",
                        }}
                      >
                        <Text style={{ fontSize: rs(14) }}>{t.icon}</Text>
                        <Text style={{
                          fontSize: rs(11),
                          fontWeight: "700",
                          color: incidentType === t.key ? "#FFFFFF" : "#6B7280",
                        }}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {incidentErrors.type && <Text style={[modalErrorText, { marginBottom: rp(12) }]}>* {incidentErrors.type}</Text>}
                <Text style={modalLabel}>DESCRIPTION *</Text>
                <TextInput value={incidentDesc} onChangeText={(text) => { setIncidentDesc(text); if(incidentErrors.description) setIncidentErrors(prev => ({...prev, description: undefined})); }} placeholder="Describe what happened..." multiline numberOfLines={4} style={[modalInput, incidentErrors.description && modalInputError, { height: rp(100), textAlignVertical: "top" }]} />
                {incidentErrors.description && <Text style={modalErrorText}>* {incidentErrors.description}</Text>}
                                <View style={{ position: "relative" }}>
                  <TouchableOpacity onPress={pickIncidentPhoto} style={{ borderWidth: rp(1.5), borderColor: incidentPhoto ? "#059669" : "#E5E7EB", borderStyle: "dashed", borderRadius: rp(14), padding: rp(16), alignItems: "center", marginBottom: rp(20) }}>
                  <Text style={{ color: incidentPhoto ? "#059669" : "#9CA3AF", fontWeight: "700" }}>{incidentPhoto ? "Photo Added ✓" : "Add Photo (Optional)"}</Text>
                </TouchableOpacity>
                  {incidentPhoto && (
                    <TouchableOpacity onPress={() => setIncidentPhoto(null)} style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}>
                      <Ionicons name="close-circle" size={20} color="#059669" />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={submitIncident} disabled={submittingIncident} style={{ backgroundColor: "#F59E0B", borderRadius: rp(18), paddingVertical: rp(18), alignItems: "center", marginBottom: rp(24) }}>
                  {submittingIncident ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>SUBMIT INCIDENT</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showSOSPanel} transparent animationType="slide">
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F2044" }}>
                🚨 SOS Alerts {sosCount > 0 ? `(${sosCount} active)` : ""}
              </Text>
              <TouchableOpacity onPress={() => setShowSOSPanel(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {sosAlerts.length === 0 ? (
                <Text style={{ color: "#6B7280", textAlign: "center", marginTop: 32 }}>
                  No SOS alerts for this event
                </Text>
              ) : (
                [...sosAlerts]
                  .sort((a, b) => (a.status === "ACTIVE" ? -1 : 1))
                  .map((alert) => (
                    <View key={alert.id} style={{
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: alert.status === "ACTIVE" ? "#FCA5A5" : "#E5E7EB",
                      backgroundColor: alert.status === "ACTIVE" ? "#FEF2F2" : "#F9FAFB",
                      padding: 14,
                      marginBottom: 10,
                    }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Text style={{ fontWeight: "700", color: alert.status === "ACTIVE" ? "#DC2626" : "#6B7280", fontSize: 14 }}>
                          {alert.alert_type.replace(/_/g, " ")}
                        </Text>
                        {alert.status === "RESOLVED" && (
                          <Text style={{ color: "#059669", fontSize: 12, fontWeight: "600" }}>Resolved ✓</Text>
                        )}
                      </View>
                      <Text style={{ color: "#374151", fontSize: 13 }}>Driver: {alert.driver_name}</Text>
                      {alert.car_number ? <Text style={{ color: "#374151", fontSize: 13 }}>Car: {alert.car_number}</Text> : null}
                      {alert.note ? <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>{alert.note}</Text> : null}
                      <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 6 }}>{alert.created_at}</Text>
                      {alert.status === "ACTIVE" && (
                        <TouchableOpacity
                          onPress={() => resolveSOSAlert(alert.id)}
                          disabled={resolvingSOSId === alert.id}
                          style={{
                            marginTop: 10,
                            backgroundColor: "#059669",
                            borderRadius: 8,
                            padding: 10,
                            alignItems: "center",
                          }}
                        >
                          {resolvingSOSId === alert.id
                            ? <ActivityIndicator color="white" size="small" />
                            : <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>Mark Resolved</Text>
                          }
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
              )}
                          </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* RESOLVE INCIDENT MODAL */}
      <Modal visible={showResolveModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), maxHeight: "92%" }}>
              <View style={{ alignItems: "center", marginBottom: rp(14) }}>
                <View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(16), paddingHorizontal: rp(20) }}>
                <View style={{ backgroundColor: "#DBEAFE", borderRadius: rp(99), padding: rp(8), marginRight: rp(10) }}>
                  <Ionicons name="shield-checkmark" size={20} color={ACCENT_COLOR} />
                </View>
                <Text style={{ fontSize: rs(18), fontWeight: "900", color: "#111827", flex: 1 }}>Update Status</Text>
                <TouchableOpacity onPress={() => { setShowResolveModal(false); setResolveErrors({}); }}>
                  <Ionicons name="close-circle" size={26} color="#D1D5DB" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: rp(20), paddingBottom: rp(32) }}>
                <Text style={modalLabel}>STATUS</Text>
                <View style={{ flexDirection: "row", gap: rp(8), marginBottom: rp(16), flexWrap: "wrap" }}>
                  {["IN_REVIEW", "RESOLVED", "DISMISSED"].map(statusVal => (
                    <TouchableOpacity
                      key={statusVal}
                      onPress={() => setResolveStatus(statusVal)}
                      style={{
                        paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(12), borderWidth: rp(1),
                        backgroundColor: resolveStatus === statusVal ? ACCENT_COLOR : "#fff",
                        borderColor: resolveStatus === statusVal ? ACCENT_COLOR : "#E5E7EB"
                      }}
                    >
                      <Text style={{ fontWeight: "800", fontSize: rs(13), color: resolveStatus === statusVal ? "#fff" : "#374151" }}>
                        {statusVal === "IN_REVIEW" ? "Mark In Review" : statusVal === "RESOLVED" ? "Resolve" : "Dismiss"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={modalLabel}>HOW WAS THIS RESOLVED?</Text>
                <TextInput
                  value={resolveRemark}
                  onChangeText={(text) => { setResolveRemark(text); if (resolveErrors.remark) setResolveErrors(prev => ({ ...prev, remark: undefined })); }}
                  placeholder="Details about the resolution..."
                  multiline
                  style={[modalInput, resolveErrors.remark && modalInputError, { minHeight: rp(100), textAlignVertical: "top" }]}
                />
                {resolveErrors.remark && <Text style={modalErrorText}>* {resolveErrors.remark}</Text>}
                <TouchableOpacity
                  onPress={submitResolve}
                  disabled={submittingResolve}
                  style={{
                    backgroundColor: ACCENT_COLOR,
                    paddingVertical: rp(16),
                    borderRadius: rp(16),
                    alignItems: "center",
                    marginTop: rp(8)
                  }}
                >
                  {submittingResolve ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(14), letterSpacing: rs(1) }}>UPDATE INCIDENT</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {showEventQRModal && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(28), alignItems: "center", width: "85%" }}>
            <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#1D4ED8", letterSpacing: rs(3), marginBottom: rp(12) }}>EVENT GUEST QR</Text>
            <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#111827", textAlign: "center", marginBottom: rp(20) }}>{event?.name}</Text>
            <View style={{ padding: rp(14), backgroundColor: "#F5F3FF", borderRadius: rp(20), marginBottom: rp(20) }}>
              {eventQrToken ? (
                <QRCode value={`${process.env.EXPO_PUBLIC_GUEST_URL}/pre-register/event/${eventQrToken}`} size={220} color="#1D4ED8" />
              ) : (
                <View style={{ width: rp(220), height: rp(220), justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator color="#1D4ED8" size="large" />
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => setShowEventQRModal(false)} style={{ paddingVertical: rp(12), paddingHorizontal: rp(24) }}>
              <Text style={{ color: "#9CA3AF", fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
const iconBtn = { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(10) };
const modalLabel = { fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(2), marginBottom: rp(8) };
const modalInput = { backgroundColor: "#F9FAFB", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", padding: rp(14), color: "#111827", marginBottom: rp(16), fontSize: rs(14) };
const modalInputError = { borderColor: "#EF4444" };
const modalErrorText = { color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) };
const exportBtn = { flex: 1, borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center", borderWidth: rp(1), flexDirection: "row", justifyContent: "center" };
