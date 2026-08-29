import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Audio } from "expo-av";
import { confirmDialog } from "../../../lib/confirmDialog";
import { Vibration, Share } from "react-native";
import { buildQueueRows } from "../../../lib/liveQueue";
import QRCode from "react-native-qrcode-svg";
import { rs, rp } from '../../../utils/responsive';
import { configureBackgroundAudio } from "../../../lib/audio";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

const FEEDBACK_QUESTIONS = [
  { key: 'extra_money_asked', label: 'Did the driver ask for extra money?' },
  { key: 'misbehaved', label: 'Was the driver rude or misbehaving?' },
  { key: 'late_arrival', label: 'Did the driver arrive late to retrieve your car?' },
  { key: 'vehicle_damaged', label: 'Was your vehicle damaged?' },
  { key: 'unauthorized_personal_use', label: 'Did you notice the driver using your vehicle without permission?' },
];
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { formatDistanceToNow } from "date-fns";
import { fmtDateTime, fmtDuration } from "../../../utils/time";
import { useEventCars } from "../../../hooks/useEventCars";
import { useEventIncidents } from "../../../hooks/useEventIncidents";
import { useEventSOS } from "../../../hooks/useEventSOS";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import { connectWS, disconnectWS } from "../../../lib/websocket";
import { theme } from "../../../utils/theme";
import Heading from "../../../components/Heading";

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

const ACCENT_COLOR = theme.colors.primary;

const STATUS_CONFIG = {
  PRE_REGISTERED: { color: "#8B5CF6", label: "Pre-Registered" },
  REGISTERED: { color: "#F59E0B", label: "Registered" },
  CHECKED_IN: { color: "#0EA5E9", label: "Checked In" },
  PARKED: { color: theme.colors.success, label: "Parked" },
  RETRIEVAL_REQUESTED: { color: "#F59E0B", label: "Requested" },
  ACCEPTED: { color: "#EAB308", label: "Accepted" },
  BEING_FETCHED: { color: "#F97316", label: "Fetching" },
  DELIVERED: { color: theme.colors.textMuted, label: "Delivered" },
};

const FILTERS = ["ALL", "PRE_REGISTERED", "REGISTERED", "CHECKED_IN", "PARKED", "RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED", "DELIVERED"];

const cardShadow = {
  shadowColor: ACCENT_COLOR,
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function SupervisorEventDetail() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const router = useRouter();
  const { showQr, tab: initialTab } = useLocalSearchParams();
  const { currentEventId } = useAppStore();
  const [event, setEvent] = useState(null);
  const [showEventQRModal, setShowEventQRModal] = useState(false);
  const [eventQrToken, setEventQrToken] = useState(null);

  useEffect(() => {
    if (showQr === 'true' && currentEventId) {
      setShowEventQRModal(true);
    }
  }, [showQr, currentEventId]);


  const closeEvent = () => {
    confirmDialog.destructiveConfirm("Close event", "Are you sure? This cannot be undone.", async () => {
      try {
        await api.post(`/events/${currentEventId}/close`);
        fetchEvent();
      } catch (err) {
        confirmDialog.info("Error", err.response?.data?.detail || "Could not close event");
      }
    });
  };

  const reopenEvent = () => {
    confirmDialog.confirm("Reactivate event", "Are you sure you want to reopen this event?", async () => {
      try {
        await api.post(`/events/${currentEventId}/reopen`);
        fetchEvent();
      } catch (err) {
        confirmDialog.info("Error", err.response?.data?.detail || "Could not reopen event");
      }
    });
  };

  const isClosed = event?.status === "closed";


  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}`);
      setEvent(data);
      try {
        const { data: qrData } = await api.get(`/events/${currentEventId}/qr-token`);
        setEventQrToken(qrData.event_qr_token);
      } catch { }
    } catch { }
  }, [currentEventId]);

  const {
    cars, carStats, drivers, stats, search, setSearch, statusFilter, setStatusFilter,
    selectedCar, setSelectedCar, showCarModal, setShowCarModal, carPhotos, setCarPhotos,
    selfPickupOtpInput, setSelfPickupOtpInput, showSelfPickupOtpField, setShowSelfPickupOtpField,
    showAssignPicker, setShowAssignPicker, assignSuggestion, assigningDriver, slots,
    assigningId, assigningAll, sendingRetrieval, markingSelfPickup,
    fetchCars, fetchDrivers, fetchStats, fetchSlots, handleAssignDriver, assignAll,
    doAssign, openAssignPicker, toggleAssign, removeCar, sendRetrievalRequest, markSelfPickup, doMarkSelfPickup
  } = useEventCars(currentEventId, fetchEvent);

  const {
    showIncidentModal, setShowIncidentModal, incidentCar, setIncidentCar, incidentDriver, setIncidentDriver,
    incidentType, setIncidentType, incidentDesc, setIncidentDesc, incidentPhoto, setIncidentPhoto,
    submittingIncident, incidentCarSearch, setIncidentCarSearch, showResolveModal, setShowResolveModal,
    resolvingIncident, setResolvingIncident, resolveStatus, setResolveStatus, resolveRemark, setResolveRemark,
    submittingResolve, resolveErrors, setResolveErrors, incidentErrors, setIncidentErrors, incidents,
    fetchIncidents, submitResolve, submitIncident
  } = useEventIncidents(currentEventId, fetchStats, fetchEvent);

  const {
    sosAlerts, sosCount, showSOSPanel, setShowSOSPanel, resolvingSOSId,
    activeSOSQueue, forcedSOSAlert, resolvingForcedSOS,
    fetchSOSAlerts, resolveSOSAlert
  } = useEventSOS(currentEventId, fetchEvent);

  const [tab, setTab] = useState(initialTab || "cars");
  const [deliveryOtp, setDeliveryOtp] = useState(null);
  const [loadingOtp, setLoadingOtp] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [liveQueueToken, setLiveQueueToken] = useState(null);
  const [sharingQueue, setSharingQueue] = useState(false);

  const handleShareLiveQueue = async () => {
    if (sharingQueue) return;
    setSharingQueue(true);
    try {
      let token = liveQueueToken;
      if (!token) {
        const { data } = await api.get(`/events/${currentEventId}/live-queue-token`);
        token = data.live_queue_token;
        setLiveQueueToken(token);
      }
      const url = `${process.env.EXPO_PUBLIC_GUEST_URL || "https://app.instapark.co"}/queue/${token}`;
      await Share.share({ message: `Live car queue for ${event?.name || "this event"}: ${url}` });
    } catch (e) {
      confirmDialog.info("Error", "Could not generate the live queue link.");
    } finally {
      setSharingQueue(false);
    }
  };

  const queueRows = useMemo(() => buildQueueRows(cars, drivers), [cars, drivers]);

  useEffect(() => {
    const backAction = () => {
      if (forcedSOSAlert) return true;
      if (showIncidentModal) { setShowIncidentModal(false); return true; }
      if (showCarModal) { setShowCarModal(false); return true; }
      if (showSOSPanel) {
        if (sosCount > 0) {
          confirmDialog.info("Resolve SOS", "Please resolve active SOS alerts first");
          return true;
        }
        setShowSOSPanel(false);
        return true;
      }
      router.push('/(supervisor)/(tabs)/events'); return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [showIncidentModal, showCarModal, showSOSPanel, forcedSOSAlert, sosCount, router]);

  const fetchDeliveryOtp = async () => {
    try {
      setLoadingOtp(true);
      const { data } = await api.get(`/cars/${selectedCar.id}/delivery-otp`);
      setDeliveryOtp(data.otp);
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not fetch delivery code";
      confirmDialog.info("Operation failed", msg || "Something went wrong. Please try again.");
    } finally {
      setLoadingOtp(false);
    }
  };

  useEffect(() => {
    if (tab === "feedback") {
      setLoadingFeedback(true);
      api.get(`/events/${currentEventId}/feedback`)
        .then(res => setFeedback(res.data))
        .catch(() => { })
        .finally(() => setLoadingFeedback(false));
    }
  }, [tab, currentEventId]);

  useFocusEffect(
    useCallback(() => {
      if (currentEventId) {
        Promise.all([fetchEvent(), fetchCars(), fetchDrivers(), fetchStats(), fetchSlots(), fetchIncidents(), fetchSOSAlerts()]).catch(() => {});
      }
    }, [currentEventId, fetchEvent, fetchCars, fetchDrivers, fetchStats, fetchSlots, fetchIncidents, fetchSOSAlerts])
  );

  useEffect(() => {
    if (!currentEventId) return;
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
      if (search) {
        const q = search.toLowerCase();
        const matchesPlate = c.plate?.toLowerCase().includes(q);
        const matchesCode = c.checkin_code?.includes(search.trim());
        if (!matchesPlate && !matchesCode) return false;
      }
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      return true;
    });
  }, [cars, search, statusFilter]);

  const openCar = async (car) => {
    setSelectedCar(car);
    setDeliveryOtp(null);
    setShowCarModal(true);
    try {
      const { data } = await api.get(`/cars/${car.id}/photos`);
      setCarPhotos(data || []);
    } catch {
      setCarPhotos([]);
    }
  };



  const pickIncidentPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      confirmDialog.info("Permission needed", "Camera access required");
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
      const headers = ["Plate", "Make", "Color", "Status", "Zone", "Slot", "Key Tag", "Check-in Driver", "Retrieval Driver", "Duration (min)", "Retrieval Time (min)", "Platform Rating", "Notes", "Pre-registered", "Walk-in", "Peak Hour", "Still Parked"].join(",");
      const rows = data.cars.map(c => [c.plate, c.make, c.color, c.status, c.zone || "", c.slot || "", c.key_tag || "", c.check_in_driver || "", c.retrieval_driver || "", c.duration_minutes || "", c.retrieval_minutes || "", c.rating || "", `"${(c.notes || "").replace(/"/g, "'")}"`, data.summary.pre_registered || 0, data.summary.walk_in || 0, data.summary.peak_hour || "—", data.summary.still_parked || 0].join(","));
      const csv = [headers, ...rows].join("\n");
      const filename = `${data.event.name.replace(/\s+/g, "_")}_report.csv`;
      const path = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: `${data.event.name} — Event Report` });
    } catch {
      confirmDialog.info("Couldn't generate CSV", "Something went wrong creating the file. Please try again.");
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

      const carRows = data.cars.map(c => `<tr><td>${c.plate}</td><td>${c.color} ${c.make}</td><td>${c.status}</td><td>${c.check_in_driver || "—"}</td><td>${c.retrieval_driver || "—"}</td><td>${c.duration_minutes != null ? fmtDuration(c.duration_minutes) : "—"}</td><td>${c.rating ? "★".repeat(c.rating) : "—"}</td><td>${c.notes || "—"}</td></tr>`).join("");
      const driverRows = data.drivers.map(d => `<tr><td>${d.name}</td><td>${d.employee_id}</td><td>${d.checkins}</td><td>${d.parkings}</td><td>${d.retrievals}</td><td style="color:${d.incidents > 0 ? theme.colors.danger : theme.colors.textSecondary}">${d.incidents}</td></tr>`).join("");
      const incidentRows = data.incidents.length > 0 ? data.incidents.map(i => `<tr><td>${i.plate}</td><td>${i.driver_name || "—"}</td><td>${i.description}</td><td>${new Date(i.created_at).toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</td></tr>`).join("") : `<tr><td colspan="4" style="text-align:center; color:#9CA3AF;">No incidents</td></tr>`;

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;color:#111827;font-size:12px;}.header{background:${ACCENT_COLOR};color:white;padding:24px 28px;}.header h1{font-size:22px;font-weight:900;}.header p{opacity:0.8;margin-top:3px;font-size:12px;}.section{padding:20px 28px;border-bottom:1px solid #f3f4f6;}.section h2{font-size:11px;font-weight:800;color:${ACCENT_COLOR};letter-spacing:3px;margin-bottom:12px;text-transform:uppercase;}.stats{display:flex;gap:12px;flex-wrap:wrap;}.stat{background:#f9fafb;border-radius:10px;padding:12px 16px;text-align:center;min-width:100px;}.stat-val{font-size:22px;font-weight:900;color:#111827;}.stat-lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-top:3px;}table{width:100%;border-collapse:collapse;font-size:11px;}th{padding:8px;text-align:left;background:#f9fafb;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;}td{padding:8px;border-bottom:1px solid #f3f4f6;}.footer{padding:16px 28px;text-align:center;color:#9ca3af;font-size:10px;}</style></head><body><div class="header"><h1>${e.name}</h1><p>${e.date || ""} ${e.start_time ? "· " + e.start_time + " to " + e.end_time : ""} ${e.venue ? "· " + e.venue : ""}</p><p style="margin-top:6px;font-size:10px;opacity:0.6;">Generated ${new Date().toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</p></div><div class="section"><h2>Summary</h2><div class="stats"><div class="stat"><div class="stat-val">${s.total_cars}</div><div class="stat-lbl">Total Cars</div></div><div class="stat"><div class="stat-val">${s.pre_registered || 0}</div><div class="stat-lbl">Pre-Registered</div></div><div class="stat"><div class="stat-val">${s.walk_in || 0}</div><div class="stat-lbl">Walk-in</div></div><div class="stat"><div class="stat-val">${s.delivered}</div><div class="stat-lbl">Delivered</div></div><div class="stat"><div class="stat-val">${s.still_parked || 0}</div><div class="stat-lbl">Still Parked</div></div><div class="stat"><div class="stat-val">${s.avg_retrieval_minutes}m</div><div class="stat-lbl">Avg Retrieval</div></div><div class="stat"><div class="stat-val">${s.platform_avg_rating > 0 ? s.platform_avg_rating + "★" : "—"}</div><div class="stat-lbl">Platform Rating</div></div><div class="stat"><div class="stat-val">${s.total_incidents}</div><div class="stat-lbl">Incidents</div></div><div class="stat"><div class="stat-val">${s.peak_hour || "—"}</div><div class="stat-lbl">Peak Hour</div></div><div class="stat"><div class="stat-val">${s.total_drivers}</div><div class="stat-lbl">Drivers</div></div></div></div><div class="section"><h2>Driver Performance</h2><table><thead><tr><th>Driver</th><th>Emp ID</th><th>Check-ins</th><th>Parkings</th><th>Retrievals</th><th>Incidents</th></tr></thead><tbody>${driverRows}</tbody></table></div><div class="section"><h2>Incidents</h2><table><thead><tr><th>Plate</th><th>Driver</th><th>Description</th><th>Time</th></tr></thead><tbody>${incidentRows}</tbody></table></div><div class="section"><h2>All Vehicles (${s.total_cars})</h2><table><thead><tr><th>Plate</th><th>Vehicle</th><th>Status</th><th>Check-in By</th><th>Retrieved By</th><th>Duration</th><th>Rating</th><th>Notes</th></tr></thead><tbody>${carRows}</tbody></table></div><div class="footer">InstaPark — Smart Valet Operations · ${e.name}</div></body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const filename = `${e.name.replace(/\s+/g, "_")}_report.pdf`;
      const newPath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({ from: uri, to: newPath });
      await Sharing.shareAsync(newPath, { UTI: ".pdf", mimeType: "application/pdf" });
    } catch {
      confirmDialog.info("Couldn't generate PDF", "Something went wrong creating the file. Please try again.");
    } finally {
      setExportingPDF(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="supervisor-event-detail">
      {/* 1. Hero Card & Overlapping Metrics */}
      <View style={{ zIndex: 10 }}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: ACCENT_COLOR }}>
          <View
            style={{
              backgroundColor: ACCENT_COLOR,
              paddingHorizontal: rp(20),
              paddingTop: rp(8),
              paddingBottom: rp(36),
            }}
          >
            {/* Top Row: Back, Hero Content, Actions */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <TouchableOpacity onPress={() => router.push('/(supervisor)/(tabs)/events')} style={iconBtn}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>

              <View style={{ flex: 1, marginHorizontal: rp(12) }}>
                {/* Eyebrow */}
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: rs(12), fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: rp(2) }}>
                  {event?.venue || "InstaPark"} · {event?.date || "Today"}
                </Text>
                {/* Title */}
                <Heading level="display" style={{ color: "#fff", fontSize: rs(24), marginBottom: rp(8) }} numberOfLines={1}>
                  {event?.name || "Loading..."}
                </Heading>
                {/* Pills Row */}
                <View style={{ flexDirection: "row", gap: rp(8), flexWrap: "wrap" }}>
                  {event?.status && (
                    <View style={{ backgroundColor: event.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.18)", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(6) }}>
                      <Text style={{ color: "#fff", fontSize: rs(10), fontWeight: "900", letterSpacing: rs(1) }}>
                        {event.status === "closed" ? "CLOSED" : event.status.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {event?.start_time && (
                    <View style={{ backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(6) }}>
                      <Text style={{ color: "#fff", fontSize: rs(10), fontWeight: "700" }}>
                        {event.start_time} - {event.end_time || "End"}
                      </Text>
                    </View>
                  )}
                </View>
                {event?.end_time && (
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: rs(10), fontWeight: "600", marginTop: rp(4) }}>
                    Auto-closes {event.auto_close_grace_minutes ?? 30} min after {event.end_time}
                  </Text>
                )}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8) }}>
                {/* SOS Button */}
                <TouchableOpacity
                  onPress={() => setShowSOSPanel(true)}
                  style={[iconBtn, { position: "relative" }]}
                >
                  <Ionicons name="warning" size={20} color={sosCount > 0 ? "#DC2626" : "rgba(255,255,255,0.5)"} />
                  {sosCount > 0 && (
                    <View style={{
                      position: "absolute", top: -rp(4), right: -rp(4),
                      backgroundColor: "#DC2626",
                      borderRadius: rp(8), minWidth: rp(16), height: rp(16),
                      alignItems: "center", justifyContent: "center",
                      borderWidth: 1.5, borderColor: ACCENT_COLOR,
                    }}>
                      <Text style={{ color: "white", fontSize: rs(9), fontWeight: "900" }}>{sosCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Kebab Menu */}
                <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={iconBtn}>
                  <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
                </TouchableOpacity>
                {isClosed && (
                  <TouchableOpacity onPress={reopenEvent} style={[iconBtn, { backgroundColor: theme.colors.success + "20" }]}>
                    <Ionicons name="play" size={22} color={theme.colors.success} />
                  </TouchableOpacity>
                )}
                {event?.status === "active" && (
                  <TouchableOpacity onPress={closeEvent} style={[iconBtn, { backgroundColor: theme.colors.danger + "20" }]}>
                    <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 4 Metric Pills inside Hero */}
            <View style={{ flexDirection: "row", gap: rp(8), marginTop: rp(16) }}>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: rp(16), paddingVertical: rp(12), alignItems: "center" }}>
                <Heading level="display" style={{ fontSize: rs(20), color: "#FFFFFF" }}>{stats?.total_cars || 0}</Heading>
                <Text style={{ fontSize: rs(9), color: "rgba(255,255,255,0.7)", fontWeight: "800", marginTop: rp(2), letterSpacing: 1 }}>CARS</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: rp(16), paddingVertical: rp(12), alignItems: "center" }}>
                <Heading level="display" style={{ fontSize: rs(20), color: "#FFFFFF" }}>{stats?.still_parked || 0}</Heading>
                <Text style={{ fontSize: rs(9), color: "rgba(255,255,255,0.7)", fontWeight: "800", marginTop: rp(2), letterSpacing: 1 }}>PARKED</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: rp(16), paddingVertical: rp(12), alignItems: "center" }}>
                <Heading level="display" style={{ fontSize: rs(20), color: "#FFFFFF" }}>{stats?.total_delivered || 0}</Heading>
                <Text style={{ fontSize: rs(9), color: "rgba(255,255,255,0.7)", fontWeight: "800", marginTop: rp(2), letterSpacing: 1 }}>DELIVERED</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: rp(16), paddingVertical: rp(12), alignItems: "center" }}>
                <Heading level="display" style={{ fontSize: rs(20), color: "#FFFFFF" }}>
                  {slots ? slots.filter(s => s.is_occupied).length : 0}/{slots ? slots.length : 0}
                </Heading>
                <Text style={{ fontSize: rs(9), color: "rgba(255,255,255,0.7)", fontWeight: "800", marginTop: rp(2), letterSpacing: 1 }}>SLOTS</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>

        {/* Floating Menu Dropdown */}
        {showMenu && (
          <>
            <TouchableOpacity
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -1000, zIndex: 999 }}
              onPress={() => setShowMenu(false)}
            />
            <View style={{ position: 'absolute', top: rp(80), right: rp(20), backgroundColor: '#fff', borderRadius: rp(16), paddingVertical: rp(8), zIndex: 1000, ...cardShadow }}>
              {!isClosed && (
                <>
                  <TouchableOpacity
                    style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => { setShowMenu(false); router.push({ pathname: "/(supervisor)/(tabs)/edit-event", params: { eventId: currentEventId } }); }}
                  >
                    <Ionicons name="create-outline" size={20} color={ACCENT_COLOR} />
                    <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Edit Event</Text>
                  </TouchableOpacity>
                  <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
                  <TouchableOpacity
                    style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => { setShowMenu(false); setShowEventQRModal(true); }}
                  >
                    <Ionicons name="qr-code-outline" size={20} color={ACCENT_COLOR} />
                    <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Event Guest QR</Text>
                  </TouchableOpacity>
                  <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
                  <TouchableOpacity
                    style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => { setShowMenu(false); setShowIncidentModal(true); }}
                  >
                    <Ionicons name="warning-outline" size={20} color={ACCENT_COLOR} />
                    <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Report Incident</Text>
                  </TouchableOpacity>
                  <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
                </>
              )}
              <TouchableOpacity
                style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                onPress={() => { setShowMenu(false); exportCSV(); }}
              >
                <Ionicons name="document-text-outline" size={20} color={ACCENT_COLOR} />
                <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Export CSV</Text>
              </TouchableOpacity>
              <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
              <TouchableOpacity
                style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                onPress={() => { setShowMenu(false); exportPDF(); }}
              >
                <Ionicons name="document-outline" size={20} color={ACCENT_COLOR} />
                <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Export PDF Report</Text>
              </TouchableOpacity>
            </View>
          </>
        )}


      </View>

      {/* Sub-Tabs Row */}
      <View style={{ flexDirection: "row", marginTop: rp(16), marginHorizontal: rp(16), gap: rp(6) }}>
        {(() => {
          const tabLabel = (t) => {
            if (t === "employees") return "Team";
            if (t === "livequeue") return "Queue";
            return t.charAt(0).toUpperCase() + t.slice(1);
          };
          const tabs = isClosed ? ["cars", "incidents", "feedback", "insights"] : ["cars", "employees", "livequeue", "insights", "incidents", "feedback"];

          return tabs.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1,
                paddingVertical: rp(8),
                paddingHorizontal: rp(4),
                borderRadius: rp(99),
                backgroundColor: tab === t ? ACCENT_COLOR : "#fff",
                borderWidth: rp(1),
                borderColor: tab === t ? ACCENT_COLOR : "#E5E7EB",
                alignItems: "center",
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  fontSize: rs(11),
                  fontWeight: "800",
                  color: tab === t ? "#fff" : theme.colors.textSecondary,
                }}
              >
                {tabLabel(t)}
              </Text>
            </TouchableOpacity>
          ));
        })()}
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={{ flex: 1, marginTop: rp(16) }}
        contentContainerStyle={{ paddingHorizontal: rp(16), paddingBottom: rp(120)  + tabBarHeight}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchEvent(); await fetchCars(); setRefreshing(false); }} tintColor={ACCENT_COLOR} />}
      >
        {tab === "cars" ? (
          <>
            {/* Add Car Button */}
            {(!isClosed && event?.is_checkin_open !== false) && (
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/(supervisor)/(tabs)/scan", params: { cameFromDetail: "true" } })}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#111827", borderRadius: rp(16), paddingVertical: rp(16), marginBottom: rp(16) }}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(1), marginLeft: rp(8) }}>CHECK IN CAR</Text>
              </TouchableOpacity>
            )}

            {/* Search Input */}
            <View style={{ backgroundColor: "#fff", borderRadius: rp(16), paddingHorizontal: rp(16), flexDirection: "row", alignItems: "center", marginBottom: rp(12), ...cardShadow }}>
              <Ionicons name="search" size={18} color={theme.colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search plate or card code..."
                placeholderTextColor={theme.colors.textMuted}
                style={{ flex: 1, paddingVertical: rp(14), marginLeft: rp(12), color: "#111827", fontSize: rs(14), fontWeight: "600" }}
              />
            </View>

            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(8), paddingBottom: rp(8), marginBottom: rp(8) }}>
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
                  <Text style={{ fontSize: rs(11), fontWeight: "800", color: statusFilter === f ? "#fff" : theme.colors.textSecondary, letterSpacing: rs(1) }}>
                    {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label || f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Cars Counter */}
            <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginBottom: rp(12), fontWeight: "700" }}>
              {filteredCars.length} cars found
            </Text>

            {/* Car List */}
            {filteredCars.map((car) => {
              const cfg = STATUS_CONFIG[car.status] || STATUS_CONFIG.CHECKED_IN;
              return (
                <TouchableOpacity
                  key={car.id}
                  onPress={() => openCar(car)}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: rp(20),
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
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: rp(8) }}>
                      <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(18), letterSpacing: 0.5 }}>{car.plate}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6), gap: rp(8), flexWrap: "wrap" }}>
                      {car.zone && car.slot && (
                        <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                          <Text style={{ color: "#4B5563", fontSize: rs(10), fontWeight: "800" }}>
                            {car.zone}-{car.slot}{(car.key_tag_number || car.key_tag) ? ` · #${car.key_tag_number || car.key_tag}` : ""}
                          </Text>
                        </View>
                      )}
                      {!car.zone && !car.slot && (car.key_tag_number || car.key_tag) && (
                        <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                          <Text style={{ color: "#4B5563", fontSize: rs(10), fontWeight: "800" }}>
                            Key Tag #{car.key_tag_number || car.key_tag}
                          </Text>
                        </View>
                      )}
                      <Text style={{ color: theme.colors.textMuted, fontSize: rs(11), fontWeight: "600" }}>
                        {car.check_in_time ? new Date(car.check_in_time).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : "Just now"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", justifyContent: "space-between", height: rp(44) }}>
                    <View style={{ paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(8), backgroundColor: cfg.color + "1A" }}>
                      <Text style={{ color: cfg.color, fontWeight: "900", fontSize: rs(9), letterSpacing: rs(0.5) }}>{cfg.label.toUpperCase()}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                  </View>
                </TouchableOpacity>
              );
            })}

            {filteredCars.length === 0 && (
              <View style={{ alignItems: "center", marginTop: rp(40) }}>
                <Text style={{ fontSize: rs(48) }}>🚗</Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: rp(8), fontWeight: "700" }}>No cars found</Text>
              </View>
            )}
          </>
        ) : tab === "livequeue" ? (
          <View style={{ paddingHorizontal: rp(16), paddingTop: rp(16) }}>
            <TouchableOpacity
              onPress={handleShareLiveQueue}
              disabled={sharingQueue}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#111827", borderRadius: rp(16), paddingVertical: rp(14), marginBottom: rp(16) }}
            >
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(1), marginLeft: rp(8) }}>
                {sharingQueue ? "PREPARING LINK..." : "SHARE LIVE QUEUE LINK"}
              </Text>
            </TouchableOpacity>

            {queueRows.length === 0 ? (
              <Text style={{ textAlign: "center", color: theme.colors.textMuted, paddingVertical: rp(32) }}>
                No cars in the queue right now.
              </Text>
            ) : (
              queueRows.map((car) => {
                const cfg = STATUS_CONFIG[car.status] || STATUS_CONFIG.CHECKED_IN;
                return (
                  <View
                    key={car.id}
                    style={{ backgroundColor: "#fff", borderRadius: rp(16), padding: rp(14), marginBottom: rp(10), borderLeftWidth: rp(4), borderLeftColor: cfg.color, ...cardShadow }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: rp(6) }}>
                        <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(16) }}>{car.plate}</Text>
                      </View>
                      <View style={{ backgroundColor: cfg.color + "20", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                        <Text style={{ color: cfg.color, fontSize: rs(10), fontWeight: "800" }}>{cfg.label}</Text>
                      </View>
                    </View>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginTop: rp(4) }}>
                      {car.guest_name || "—"} · Driver: {car.driverName}{(car.key_tag_number || car.key_tag) ? ` · #${car.key_tag_number || car.key_tag}` : ""}
                    </Text>
                    {car.minutesInStatus != null && (
                      <Text style={{ color: theme.colors.textMuted, fontSize: rs(11), marginTop: rp(4) }}>
                        {car.minutesInStatus} min in current status
                      </Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : tab === "employees" ? (
          <View style={{ flex: 1, paddingBottom: rp(100)  + tabBarHeight}}>
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
                <Text style={{ color: theme.colors.textSecondary, marginTop: rp(8), fontWeight: "700" }}>No drivers</Text>
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
                    <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12) }}>{d.employee_id}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(4) }}>
                      <View style={{ width: rp(8), height: rp(8), borderRadius: rp(99), marginRight: rp(6), backgroundColor: d.available ? theme.colors.success : "#F43F5E" }} />
                      <Text style={{ fontSize: rs(11), fontWeight: "700", color: d.available ? theme.colors.success : "#F43F5E" }}>
                        {d.available ? "Available" : `In ${d.conflict_event_name || "another event"}`}
                      </Text>
                      {d.is_verified === false && (
                        <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(4), marginLeft: rp(6) }}>
                          <Text style={{ color: "#D97706", fontSize: rs(9), fontWeight: "bold" }}>UNVERIFIED</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: "row", marginTop: rp(10), gap: rp(10) }}>
                  <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                    <Text style={{ color: theme.colors.success, fontSize: rs(11), fontWeight: "700" }}>Checked in: {d.cars_checked_in || 0}</Text>
                  </View>
                  <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                    <Text style={{ color: "#0EA5E9", fontSize: rs(11), fontWeight: "700" }}>Retrieved: {d.cars_retrieved || 0}</Text>
                  </View>
                </View>
                {d.assigned || (d.available && d.is_verified !== false) ? (
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
                    <Text style={{ color: theme.colors.textMuted, fontSize: rs(11) }}>
                      {d.is_verified === false && !d.assigned ? "Unverified" : `In ${d.conflict_event_name || "another event"}`}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : tab === "insights" ? (
          <View style={{ flex: 1, paddingBottom: rp(100)  + tabBarHeight}}>
            {(() => {
              const total = slots.length;
              const occupied = slots.filter(s => s.is_occupied).length;
              const free = total - occupied;
              const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
              const barColor = pct >= 90 ? theme.colors.danger : pct >= 70 ? "#F59E0B" : theme.colors.success;
              return (
                <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(20), marginBottom: rp(16), ...cardShadow }}>
                  <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(3), marginBottom: rp(12) }}>CAPACITY OVERVIEW</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: rp(12) }}>
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: rs(28), fontWeight: "900", color: "#111827" }}>{occupied}</Text>
                      <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, fontWeight: "700" }}>OCCUPIED</Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: rs(28), fontWeight: "900", color: theme.colors.success }}>{free}</Text>
                      <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, fontWeight: "700" }}>FREE</Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: rs(28), fontWeight: "900", color: ACCENT_COLOR }}>{total}</Text>
                      <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, fontWeight: "700" }}>TOTAL</Text>
                    </View>
                  </View>
                  <View style={{ height: rp(10), backgroundColor: "#F3F4F6", borderRadius: rp(99), overflow: "hidden" }}>
                    <View style={{ height: rp(10), width: `${pct}%`, backgroundColor: barColor, borderRadius: rp(99) }} />
                  </View>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginTop: rp(8), textAlign: "right" }}>{pct}% full</Text>
                </View>
              );
            })()}

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
                        <Text style={{ fontSize: rs(11), color: selectedZone === z ? "rgba(255,255,255,0.8)" : theme.colors.textMuted, marginTop: rp(2) }}>{zOcc}/{zSlots.length} occupied</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              );
            })()}

            {(() => {
              const zoneSlots = slots.filter(s => s.zone_name === selectedZone);
              return (
                <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(16), marginBottom: rp(16), ...cardShadow }}>
                  <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(3), marginBottom: rp(16) }}>ZONE {selectedZone} — SLOT MAP</Text>
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
                        <Ionicons name={s.is_occupied ? "car" : "car-outline"} size={16} color={s.is_occupied ? theme.colors.danger : theme.colors.success} />
                        <Text style={{ fontSize: rs(11), fontWeight: "800", color: s.is_occupied ? theme.colors.danger : theme.colors.success, marginTop: rp(2) }}>{s.slot_number}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            <TouchableOpacity onPress={fetchStats} style={{ backgroundColor: "#fff", borderRadius: rp(16), paddingVertical: rp(10), alignItems: "center", marginBottom: rp(16), borderWidth: rp(1), borderColor: "#E5E7EB" }}>
              <Text style={{ color: ACCENT_COLOR, fontWeight: "800", letterSpacing: rs(1) }}>↻ Refresh Stats</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: rp(16) }}>
              {[

                { label: "DELIVERED", value: stats?.total_delivered ?? 0, color: theme.colors.textSecondary, icon: "checkmark-circle" },
                { label: "INCIDENTS", value: stats?.total_incidents ?? 0, color: (stats?.total_incidents > 0 ? theme.colors.danger : theme.colors.success), icon: "warning" },
                { label: "PEAK HOUR", value: stats?.peak_hour ?? "—", color: "#4F46E5", icon: "trending-up" },
                { label: "AVG RATING", value: stats?.avg_rating ?? 0, color: "#F59E0B", icon: "star" },
                { label: "AVG RETRIEVAL", value: stats?.avg_retrieval_minutes ? `${stats.avg_retrieval_minutes} min` : "0 min", color: "#0891B2", icon: "timer" },
                { label: "TOP DRIVER", value: stats?.top_driver ?? "—", color: theme.colors.primary, icon: "trophy" },
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
                  <Text style={{ fontSize: rs(10), color: theme.colors.textSecondary, fontWeight: "800", marginTop: rp(2) }}>{s.label}</Text>
                  {s.sub && <Text style={{ fontSize: rs(9), color: theme.colors.textMuted, marginTop: rp(1) }}>{s.sub}</Text>}
                </View>
              ))}
            </View>
          </View>
        ) : tab === "incidents" ? (
          <View style={{ flex: 1, paddingBottom: rp(100)  + tabBarHeight}}>
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
                  <Ionicons name="checkmark-circle" size={40} color={theme.colors.success} />
                </View>
                <Text style={{ fontSize: rs(18), fontWeight: "900", color: "#111827" }}>
                  All Good!
                </Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: rp(4), fontWeight: "600" }}>
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
                      <Text style={{ color: theme.colors.textSecondary, fontSize: rs(11), fontWeight: "700" }}>{(i.incident_type || "UNKNOWN").replace(/_/g, " ").replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase())}</Text>
                    </View>
                    <Text style={{ color: theme.colors.textMuted, fontSize: rs(11), fontWeight: "700" }}>
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
                        <Ionicons name="checkmark-done-circle" size={14} color={theme.colors.textSecondary} />
                        <Text style={{ color: theme.colors.textSecondary, fontSize: rs(11), marginLeft: rp(4) }}>
                          Resolved by {i.resolved_by || "Unknown"} on {i.resolved_at ? new Date(i.resolved_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: 'Asia/Kolkata' }) : "Unknown"}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: rp(1), borderTopColor: "#F3F4F6", paddingTop: rp(12) }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="person-outline" size={14} color={theme.colors.textSecondary} />
                      <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginLeft: rp(6), fontWeight: "600" }}>
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
          </View>
        ) : tab === "feedback" ? (
          <View style={{ flex: 1, paddingBottom: rp(100)  + tabBarHeight}}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rp(16) }}>
              <Text style={{ fontSize: rs(16), fontWeight: "900", color: "#111827", letterSpacing: rs(1) }}>GUEST FEEDBACK</Text>
              {loadingFeedback && <ActivityIndicator size="small" color={ACCENT_COLOR} />}
            </View>
            {!loadingFeedback && feedback.length === 0 ? (
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: rp(60), backgroundColor: "#fff", borderRadius: rp(16), ...cardShadow }}>
                <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
                <Text style={{ fontSize: rs(14), fontWeight: "800", color: theme.colors.textSecondary, marginTop: rp(12) }}>NO FEEDBACK YET</Text>
              </View>
            ) : (
              feedback.map(item => (
                <View key={item.id} style={{ backgroundColor: "#fff", borderRadius: rp(16), padding: rp(16), marginBottom: rp(12), ...cardShadow }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: rp(8) }}>
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(4) }}>
                        <Text style={{ backgroundColor: "#F3F4F6", paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(4), fontSize: rs(10), fontWeight: "900", color: "#4B5563", marginRight: rp(8) }}>{item.plate}</Text>
                        <Text style={{ fontSize: rs(14), fontWeight: "800", color: "#111827" }}>{item.guest_name}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Ionicons key={star} name="star" size={12} color={star <= item.stars ? "#FBBF24" : "#E5E7EB"} />
                        ))}
                        <Text style={{ fontSize: rs(10), color: theme.colors.textMuted, fontWeight: "600", marginLeft: rp(8) }}>
                          {new Date(item.created_at).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    {item.driver_name && (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: rs(9), fontWeight: "800", color: theme.colors.textMuted, letterSpacing: rs(1) }}>DRIVER</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(6), marginTop: rp(2) }}>
                          <Ionicons name="car-outline" size={12} color={theme.colors.textSecondary} style={{ marginRight: rp(4) }} />
                          <Text style={{ fontSize: rs(11), fontWeight: "700", color: "#4B5563" }}>{item.driver_name}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  {item.issues && (
                    <View style={{ marginBottom: rp(8), gap: rp(6) }}>
                      {FEEDBACK_QUESTIONS.map(q => {
                        const answer = item.issues[q.key];
                        if (answer === undefined) return null;
                        return (
                          <View key={q.key} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F9FAFB", paddingHorizontal: rp(10), paddingVertical: rp(8), borderRadius: rp(10) }}>
                            <Text style={{ fontSize: rs(11), color: "#4B5563", flex: 1, marginRight: rp(8) }}>{q.label}</Text>
                            <Text style={{
                              backgroundColor: answer ? "#FEF2F2" : "#ECFDF5",
                              color: answer ? theme.colors.danger : theme.colors.success,
                              paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(20),
                              fontSize: rs(10), fontWeight: "800"
                            }}>
                              {answer ? "Yes" : "No"}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  {item.comment ? (
                    <View style={{ backgroundColor: "#F9FAFB", padding: rp(12), borderRadius: rp(12) }}>
                      <Text style={{ fontSize: rs(12), color: "#4B5563", fontStyle: "italic", fontWeight: "500" }}>"{item.comment}"</Text>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>

        ) : null}
      </ScrollView>


      <Modal visible={showCarModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), padding: rp(20), paddingBottom: rp(20) + (insets?.bottom || 0), maxHeight: "85%" }}>
              <View style={{ alignItems: "center", marginBottom: rp(12) }}><View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} /></View>
              <ScrollView>
                {selectedCar && (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "baseline", gap: rp(8) }}>
                          <Text style={{ fontSize: rs(28), fontWeight: "900", color: ACCENT_COLOR }}>{selectedCar.plate}</Text>
                        </View>
                        <Text style={{ color: theme.colors.textSecondary, marginTop: rp(4) }}>{selectedCar.color} {selectedCar.make}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6), gap: rp(8), flexWrap: "wrap" }}>
                          {selectedCar.zone && selectedCar.slot && (
                            <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                              <Text style={{ color: "#4B5563", fontSize: rs(10), fontWeight: "800" }}>
                                {selectedCar.zone}-{selectedCar.slot}{(selectedCar.key_tag_number || selectedCar.key_tag) ? ` · #${selectedCar.key_tag_number || selectedCar.key_tag}` : ""}
                              </Text>
                            </View>
                          )}
                          {!selectedCar.zone && !selectedCar.slot && (selectedCar.key_tag_number || selectedCar.key_tag) && (
                            <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                              <Text style={{ color: "#4B5563", fontSize: rs(10), fontWeight: "800" }}>
                                Key Tag #{selectedCar.key_tag_number || selectedCar.key_tag}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={{ paddingHorizontal: rp(12), paddingVertical: rp(4), borderRadius: rp(99), backgroundColor: STATUS_CONFIG[selectedCar.status]?.color }}>
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: rs(11) }}>{STATUS_CONFIG[selectedCar.status]?.label}</Text>
                      </View>
                    </View>

                    {["PARKED", "RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED", "AWAITING_REPARK"].includes(selectedCar.status) && (
                      <View style={{ marginTop: rp(16), gap: rp(10) }}>
                        {selectedCar.status === "PARKED" && (
                          <TouchableOpacity
                            onPress={() => sendRetrievalRequest(selectedCar)}
                            disabled={sendingRetrieval === selectedCar.id}
                            style={{ backgroundColor: ACCENT_COLOR, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", flexDirection: "row", justifyContent: "center" }}
                          >
                            <Ionicons name="car-sport-outline" size={18} color="#fff" />
                            <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>
                              {sendingRetrieval === selectedCar.id ? "SENDING..." : "SEND RETRIEVAL REQUEST"}
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => setShowSelfPickupOtpField(true)}
                          disabled={markingSelfPickup === selectedCar.id}
                          style={{ backgroundColor: theme.colors.warningLight, borderWidth: 1.5, borderColor: theme.colors.warning, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", flexDirection: "row", justifyContent: "center" }}
                        >
                          <Ionicons name="walk-outline" size={18} color={theme.colors.warning} />
                          <Text style={{ color: theme.colors.warning, fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>
                            {markingSelfPickup === selectedCar.id ? "MARKING..." : "SELF PICKUP"}
                          </Text>
                        </TouchableOpacity>

                        {showSelfPickupOtpField && (
                          <View style={{ backgroundColor: "#F9FAFB", borderRadius: rp(20), padding: rp(16), marginTop: rp(12) }}>
                            <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8) }}>
                              GUEST'S SELF-PICKUP CODE
                            </Text>
                            <TextInput
                              value={selfPickupOtpInput}
                              onChangeText={setSelfPickupOtpInput}
                              placeholder="Enter code (leave blank if none given)"
                              keyboardType="number-pad"
                              maxLength={6}
                              style={{ backgroundColor: "#fff", borderRadius: rp(12), borderWidth: 1, borderColor: theme.colors.border, paddingVertical: rp(10), paddingHorizontal: rp(14), fontSize: rs(18), fontWeight: "800", textAlign: "center", letterSpacing: rs(4) }}
                            />
                            <TouchableOpacity
                              onPress={() => doMarkSelfPickup(selectedCar, selfPickupOtpInput)}
                              disabled={markingSelfPickup === selectedCar.id}
                              style={{ backgroundColor: theme.colors.accent, borderRadius: rp(12), paddingVertical: rp(12), alignItems: "center", marginTop: rp(10) }}
                            >
                              {markingSelfPickup === selectedCar.id ? (
                                <ActivityIndicator color="#fff" size="small" />
                              ) : (
                                <Text style={{ color: "#fff", fontWeight: "700", letterSpacing: rs(1) }}>Verify OTP</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    {selectedCar.status === "ARRIVED_AT_GATE" && (
                      <View style={{ backgroundColor: "#F9FAFB", borderRadius: rp(20), padding: rp(16), marginTop: rp(16) }}>
                        <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8) }}>DELIVERY CODE</Text>
                        {!deliveryOtp ? (
                          <TouchableOpacity
                            onPress={fetchDeliveryOtp}
                            disabled={loadingOtp}
                            style={{ backgroundColor: ACCENT_COLOR, borderRadius: rp(12), paddingVertical: rp(12), alignItems: "center", flexDirection: "row", justifyContent: "center" }}
                          >
                            {loadingOtp ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Text style={{ color: "#fff", fontWeight: "700", letterSpacing: rs(1) }}>Show Code</Text>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={{ alignItems: "center", paddingVertical: rp(8) }}>
                            <Text style={{ fontSize: rs(32), fontWeight: "900", color: ACCENT_COLOR, letterSpacing: rs(4), textAlign: "center" }}>{deliveryOtp}</Text>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), textAlign: "center", marginTop: rp(6) }}>Give this code to the driver to complete delivery.</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {["CHECKED_IN", "RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED"].includes(selectedCar.status) && !showAssignPicker && (
                      <TouchableOpacity
                        onPress={openAssignPicker}
                        style={{ backgroundColor: ACCENT_COLOR, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(20), flexDirection: "row", justifyContent: "center" }}
                      >
                        <Ionicons name="person-add-outline" size={18} color="#fff" />
                        <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>
                          {(selectedCar.status === "RETRIEVAL_REQUESTED" || selectedCar.status === "ACCEPTED" || selectedCar.status === "BEING_FETCHED")
                            ? (selectedCar.retrieval_driver_id ? "REASSIGN DRIVER" : "ASSIGN DRIVER")
                            : (selectedCar.check_in_driver_id ? "REASSIGN DRIVER" : "ASSIGN DRIVER")}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {showAssignPicker && (
                      <View style={{ marginTop: rp(16), backgroundColor: "#F9FAFB", borderRadius: rp(20), padding: rp(16) }}>
                        {assignSuggestion && (
                          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(10), gap: rp(6) }}>
                            <Ionicons name="star" size={14} color={theme.colors.success} />
                            <Text style={{ color: theme.colors.success, fontWeight: "800", fontSize: rs(12) }}>Suggested: {assignSuggestion.name}</Text>
                          </View>
                        )}
                        {drivers.filter(d => d.assigned && d.duty_status === "available").length === 0 ? (
                          <Text style={{ color: theme.colors.textMuted, fontSize: rs(13), textAlign: "center", paddingVertical: rp(12) }}>No available drivers right now</Text>
                        ) : (
                          drivers.filter(d => d.assigned && d.duty_status === "available").map(d => (
                            <TouchableOpacity
                              key={d.id}
                              disabled={assigningDriver}
                              onPress={() => handleAssignDriver(d.id, d.name)}
                              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: rp(12), borderBottomWidth: rp(1), borderBottomColor: "#E5E7EB" }}
                            >
                              <Text style={{ fontWeight: "700", color: "#111827" }}>{d.name}</Text>
                              {assignSuggestion?.id === d.id && <Ionicons name="star" size={14} color={theme.colors.success} />}
                            </TouchableOpacity>
                          ))
                        )}
                        <TouchableOpacity onPress={() => setShowAssignPicker(false)} style={{ paddingVertical: rp(10), alignItems: "center" }}>
                          <Text style={{ color: theme.colors.textSecondary, fontWeight: "700" }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => { setShowCarModal(false); router.push({ pathname: "/(supervisor)/(tabs)/car-log", params: { car_id: selectedCar.id } }); }}
                      style={{ backgroundColor: "#fff", borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(12), flexDirection: "row", justifyContent: "center" }}
                    >
                      <Ionicons name="time-outline" size={18} color={theme.colors.textPrimary} />
                      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>VIEW FULL LOG</Text>
                    </TouchableOpacity>
                    {selectedCar.retrieval_token && (
                        <TouchableOpacity
                          onPress={() => {
                            setShowCarModal(false);
                            router.push({
                              pathname: "/(supervisor)/(tabs)/qr-display",
                              params: {
                                token: selectedCar.retrieval_token,
                                checkinCode: selectedCar.checkin_code,
                                plate: selectedCar.plate,
                                carId: selectedCar.id,
                                keyTagNumber: selectedCar.key_tag_number,
                                returnTo: "/(supervisor)/(tabs)/event-detail"
                              }
                            });
                          }}
                          style={{ backgroundColor: "#fff", borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: rp(12) }}
                        >
                          <Ionicons name="qr-code-outline" size={18} color={theme.colors.textPrimary} />
                          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>VIEW QR</Text>
                        </TouchableOpacity>
                      )}
                    <TouchableOpacity onPress={() => { setShowCarModal(false); setShowAssignPicker(false); }} style={{ paddingVertical: rp(10), alignItems: "center", marginBottom: rp(12) }}>
                      <Text style={{ color: theme.colors.textSecondary, fontWeight: "700" }}>Close</Text>
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
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), padding: rp(20), paddingBottom: rp(20) + (insets?.bottom || 0), maxHeight: "92%" }}>
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
                    <View style={{ backgroundColor: "#F9FAFB", borderRadius: rp(14), borderWidth: rp(1), borderColor: incidentErrors.car ? theme.colors.danger : "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: rp(12), marginBottom: incidentErrors.car ? rp(6) : rp(6) }}>
                      <Ionicons name="search" size={16} color={ACCENT_COLOR} />
                      <TextInput value={incidentCarSearch} onChangeText={(text) => { setIncidentCarSearch(text); if (incidentErrors.car) setIncidentErrors(prev => ({ ...prev, car: undefined })); }} placeholder="Search plate or card code..." style={{ flex: 1, paddingVertical: rp(13), paddingLeft: rp(8), color: "#111827", fontWeight: "700" }} />
                    </View>
                    {incidentErrors.car && <Text style={[modalErrorText, { marginTop: rp(4), marginBottom: rp(12) }]}>* {incidentErrors.car}</Text>}
                    {incidentCarSearch.length > 1 && (
                      <View style={{ backgroundColor: "#fff", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", marginBottom: rp(12), overflow: "hidden" }}>
                        {cars.filter(c => 
                          c.plate?.toLowerCase().includes(incidentCarSearch.toLowerCase()) || 
                          c.card_code?.toString().includes(incidentCarSearch.trim())
                        ).slice(0, 5).map(c => (
                          <TouchableOpacity key={c.id} onPress={() => { setIncidentCar(c); setIncidentCarSearch(c.plate); if (incidentErrors.car) setIncidentErrors(prev => ({ ...prev, car: undefined })); }} style={{ padding: rp(14), borderBottomWidth: rp(1), borderBottomColor: "#F3F4F6", flexDirection: "row", alignItems: "center" }}>
                            <Text style={{ fontWeight: "900", color: "#111827" }}>{c.plate}</Text>
                            {c.card_code && <Text style={{ color: "#6B7280", marginLeft: 8 }}>({c.card_code})</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
                {incidentCar && (
                  <View style={{ backgroundColor: "#D1FAE5", borderRadius: rp(12), padding: rp(12), marginBottom: rp(16), flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                      <Text style={{ color: theme.colors.success, fontWeight: "800", marginLeft: rp(8) }}>{incidentCar.plate} selected</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setIncidentCar(null); setIncidentCarSearch(""); }}>
                      <Ionicons name="close-circle" size={20} color={theme.colors.success} />
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
                <Text style={{ fontSize: rs(12), fontWeight: "700", color: theme.colors.primary, marginBottom: rp(8) }}>
                  Incident Type <Text style={{ color: theme.colors.danger }}>*</Text>
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: incidentErrors.type ? rp(6) : rp(12) }}>
                  <View style={{ flexDirection: "row", gap: rp(8), paddingRight: rp(16) }}>
                    {INCIDENT_TYPES.map(t => (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => { setIncidentType(t.key); if (incidentErrors.type) setIncidentErrors(prev => ({ ...prev, type: undefined })); }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: rp(4),
                          paddingHorizontal: rp(12),
                          paddingVertical: rp(8),
                          borderRadius: rp(20),
                          borderWidth: 1.5,
                          borderColor: incidentErrors.type ? theme.colors.danger : (incidentType === t.key ? theme.colors.primary : "#E5E7EB"),
                          backgroundColor: incidentType === t.key ? theme.colors.primary : "#F9FAFB",
                        }}
                      >
                        <Text style={{
                          fontSize: rs(11),
                          fontWeight: "700",
                          color: incidentType === t.key ? "#FFFFFF" : theme.colors.textSecondary,
                        }}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {incidentErrors.type && <Text style={[modalErrorText, { marginBottom: rp(12) }]}>* {incidentErrors.type}</Text>}
                <Text style={modalLabel}>DESCRIPTION *</Text>
                <TextInput value={incidentDesc} onChangeText={(text) => { setIncidentDesc(text); if (incidentErrors.description) setIncidentErrors(prev => ({ ...prev, description: undefined })); }} placeholder="Describe what happened..." multiline numberOfLines={4} style={[modalInput, incidentErrors.description && modalInputError, { height: rp(100), textAlignVertical: "top" }]} />
                {incidentErrors.description && <Text style={modalErrorText}>* {incidentErrors.description}</Text>}
                <View style={{ position: "relative" }}>
                  <TouchableOpacity onPress={pickIncidentPhoto} style={{ borderWidth: rp(1.5), borderColor: incidentPhoto ? theme.colors.success : "#E5E7EB", borderStyle: "dashed", borderRadius: rp(14), padding: rp(16), alignItems: "center", marginBottom: rp(20) }}>
                    <Text style={{ color: incidentPhoto ? theme.colors.success : theme.colors.textMuted, fontWeight: "700" }}>{incidentPhoto ? "Photo Added ✓" : "Add Photo (Optional)"}</Text>
                  </TouchableOpacity>
                  {incidentPhoto && (
                    <TouchableOpacity onPress={() => setIncidentPhoto(null)} style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}>
                      <Ionicons name="close-circle" size={20} color={theme.colors.success} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={submitIncident} disabled={submittingIncident} style={{ backgroundColor: theme.colors.primary, borderRadius: rp(18), paddingVertical: rp(18), alignItems: "center", marginBottom: rp(24) }}>
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
            <View style={{ backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 24 + (insets?.bottom || 0), maxHeight: "80%" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ fontSize: rs(18), fontWeight: "700", color: theme.colors.primary }}>
                  🚨 SOS Alerts {sosCount > 0 ? `(${sosCount} active)` : ""}
                </Text>
                <TouchableOpacity onPress={() => {
                  if (sosCount > 0) {
                    confirmDialog.info("Resolve SOS", "Please resolve active SOS alerts first");
                  } else {
                    setShowSOSPanel(false);
                  }
                }}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {sosAlerts.length === 0 ? (
                  <Text style={{ color: theme.colors.textSecondary, textAlign: "center", marginTop: 32 }}>
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
                          <Text style={{ fontWeight: "700", color: alert.status === "ACTIVE" ? "#DC2626" : theme.colors.textSecondary, fontSize: rs(14) }}>
                            {alert.alert_type.replace(/_/g, " ")}
                          </Text>
                          {alert.status === "RESOLVED" && (
                            <Text style={{ color: theme.colors.success, fontSize: rs(12), fontWeight: "600" }}>Resolved ✓</Text>
                          )}
                        </View>
                        <Text style={{ color: "#374151", fontSize: rs(13) }}>Driver: {alert.driver_name}</Text>
                        {alert.car_number ? <Text style={{ color: "#374151", fontSize: rs(13) }}>Car: {alert.car_number}</Text> : null}
                        {alert.note ? <Text style={{ color: theme.colors.textSecondary, fontSize: rs(13), marginTop: 4 }}>{alert.note}</Text> : null}
                        {alert.photo_url ? (
                          <Image
                            source={{ uri: alert.photo_url }}
                            style={{ width: "100%", height: rp(160), borderRadius: 12, marginTop: 8 }}
                            resizeMode="cover"
                          />
                        ) : null}
                        <Text style={{ color: theme.colors.textMuted, fontSize: rs(11), marginTop: 6 }}>{fmtDateTime(alert.created_at)}</Text>
                        {alert.status === "ACTIVE" && (
                          <TouchableOpacity
                            onPress={() => resolveSOSAlert(alert.id)}
                            disabled={resolvingSOSId === alert.id}
                            style={{
                              marginTop: 10,
                              backgroundColor: theme.colors.success,
                              borderRadius: 8,
                              padding: 10,
                              alignItems: "center",
                            }}
                          >
                            {resolvingSOSId === alert.id
                              ? <ActivityIndicator color="white" size="small" />
                              : <Text style={{ color: "white", fontWeight: "600", fontSize: rs(13) }}>Mark Resolved</Text>
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

      {/* FORCED SOS MODAL */}
      <Modal visible={!!forcedSOSAlert} transparent={false} animationType="fade" onRequestClose={() => { }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#111827", padding: rp(24) }}>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <View style={{ alignItems: "center", marginBottom: rp(32) }}>
              <Text style={{ fontSize: rs(64), marginBottom: rp(12) }}>🚨</Text>
              <Text style={{ fontSize: rs(28), fontWeight: "900", color: theme.colors.danger, textAlign: "center", letterSpacing: rs(2) }}>SOS EMERGENCY</Text>
            </View>

            <View style={{ backgroundColor: "#1F2937", borderRadius: rp(24), padding: rp(24), borderWidth: rp(2), borderColor: theme.colors.danger }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(16), borderBottomWidth: rp(1), borderBottomColor: "#374151", paddingBottom: rp(16)}}>
                <Text style={{ color: "#FCA5A5", fontSize: rs(16), fontWeight: "800" }}>{forcedSOSAlert?.alert_type?.replace(/_/g, " ")}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: rs(12), fontWeight: "600" }}>{fmtDateTime(forcedSOSAlert?.created_at)}</Text>
              </View>

              <View style={{ gap: rp(12), marginBottom: rp(24) }}>
                <Text style={{ color: "#E5E7EB", fontSize: rs(16), fontWeight: "600" }}>Driver: <Text style={{ color: "#fff", fontWeight: "800" }}>{forcedSOSAlert?.driver_name}</Text></Text>
                {forcedSOSAlert?.car_number ? (
                  <Text style={{ color: "#E5E7EB", fontSize: rs(16), fontWeight: "600" }}>Car: <Text style={{ color: "#fff", fontWeight: "800" }}>{forcedSOSAlert?.car_number}</Text></Text>
                ) : null}
                {forcedSOSAlert?.note ? (
                  <View style={{ backgroundColor: "#374151", padding: rp(12), borderRadius: rp(12), marginTop: rp(8) }}>
                    <Text style={{ color: "#D1D5DB", fontSize: rs(14) }}>{forcedSOSAlert.note}</Text>
                  </View>
                ) : null}
              </View>

              {forcedSOSAlert?.photo_url ? (
                <Image
                  source={{ uri: forcedSOSAlert.photo_url }}
                  style={{ width: "100%", height: rp(250), borderRadius: rp(16), marginBottom: rp(24) }}
                  resizeMode="cover"
                />
              ) : null}

              <TouchableOpacity
                disabled={resolvingForcedSOS}
                onPress={async () => {
                  setResolvingForcedSOS(true);
                  try {
                    await api.patch(`/sos/${forcedSOSAlert.id}/resolve`);
                    setForcedSOSAlert(null);
                    fetchSOSAlerts();
                  } catch {
                    confirmDialog.info("Couldn't resolve alert", "Something went wrong resolving the alert. Check your connection and try again.");
                  } finally {
                    setResolvingForcedSOS(false);
                  }
                }}
                style={{ backgroundColor: "#10B981", borderRadius: rp(16), paddingVertical: rp(18), alignItems: "center" }}
              >
                {resolvingForcedSOS ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(16), letterSpacing: rs(2) }}>MARK RESOLVED</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* RESOLVE INCIDENT MODAL */}
      <Modal visible={showResolveModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), maxHeight: "92%", paddingBottom: (insets?.bottom || 0)}}>
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
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: rp(20), paddingBottom: rp(32)}}>
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

      {/* {showEventQRModal && (
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
              <Text style={{ color: theme.colors.textMuted, fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )} */}
    </View>
  );
}
const iconBtn = { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(10) };
const modalLabel = { fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8) };
const modalInput = { backgroundColor: "#F9FAFB", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", padding: rp(14), color: "#111827", marginBottom: rp(16), fontSize: rs(14) };
const modalInputError = { borderColor: "#EF4444" };
const modalErrorText = { color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) };
const exportBtn = { flex: 1, borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center", borderWidth: rp(1), flexDirection: "row", justifyContent: "center" };
