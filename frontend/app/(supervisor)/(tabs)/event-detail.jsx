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
  PRE_REGISTERED: { color: theme.colors.primary, label: "Pre-Registered" },
  REGISTERED: { color: theme.colors.warning, label: "Registered" },
  CHECKED_IN: { color: theme.colors.info, label: "Checked In" },
  PARKED: { color: theme.colors.success, label: "Parked" },
  RETRIEVAL_REQUESTED: { color: theme.colors.warning, label: "Requested" },
  ACCEPTED: { color: theme.colors.warning, label: "Accepted" },
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

  const activateEventManually = () => {
    confirmDialog.confirm("Activate event", "Are you sure you want to manually activate this event early?", async () => {
      try {
        await api.post(`/events/${currentEventId}/activate`);
        fetchEvent();
      } catch (err) {
        confirmDialog.info("Error", err.response?.data?.detail || "Could not activate event");
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
  const [reportEmail, setReportEmail] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
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


  useFocusEffect(
    useCallback(() => {
      if (currentEventId) {
        Promise.all([fetchEvent(), fetchCars(), fetchDrivers(), fetchStats(), fetchSlots(), fetchIncidents(), fetchSOSAlerts()]).catch(() => { });
      }
    }, [currentEventId, fetchEvent, fetchCars, fetchDrivers, fetchStats, fetchSlots, fetchIncidents, fetchSOSAlerts])
  );

  const fetchDebounceTimer = useRef(null);

  useEffect(() => {
    if (!currentEventId) return;
    connectWS(`/event/${currentEventId}`, (msg) => {
      if (msg.type === "car_update") {
        if (fetchDebounceTimer.current) clearTimeout(fetchDebounceTimer.current);
        fetchDebounceTimer.current = setTimeout(() => {
          fetchCars();
          fetchStats();
        }, 300);
      }
      if (msg.type === "slot_update") fetchSlots();
      if (msg.type === "driver_status_update") fetchDrivers();
      if (msg.type === "event_activated") fetchEvent();
    });
    connectWS(`/sos/${currentEventId}`, (msg) => {
      if (msg.type === "sos_alert" || msg.type === "sos_resolved") fetchSOSAlerts();
    });
    return () => {
      if (fetchDebounceTimer.current) clearTimeout(fetchDebounceTimer.current);
      disconnectWS(`/event/${currentEventId}`);
      disconnectWS(`/sos/${currentEventId}`);
    };
  }, [currentEventId, fetchCars, fetchStats, fetchDrivers, fetchSlots]);

  const filteredCars = useMemo(() => {
    return cars.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesPlate = c.plate?.toLowerCase().includes(q);
        const matchesCode = c.status !== "DELIVERED" && c.checkin_code?.includes(search.trim());
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
      const res = await api.get(`/events/${currentEventId}/report.csv`, { responseType: "text" });
      const filename = `${(event?.name || "event").replace(/\s+/g, "_")}_report.csv`;
      const path = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, res.data, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: `${event?.name || "Event"} — Event Report` });
    } catch {
      confirmDialog.info("Couldn't generate CSV", "Something went wrong creating the file. Please try again.");
    } finally {
      setExportingCSV(false);
    }
  };

  const exportPDF = async () => {
    setExportingPDF(true);
    try {
      const res = await api.get(`/events/${currentEventId}/report.html`, { responseType: "text" });
      const { uri } = await Print.printToFileAsync({ html: res.data });
      const filename = `${(event?.name || "event").replace(/\s+/g, "_")}_report.pdf`;
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
    <View style={{ flex: 1, backgroundColor: theme.colors.primaryLight }} testID="supervisor-event-detail">
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
                <Ionicons name="chevron-back" size={22} color={theme.colors.surface} />
              </TouchableOpacity>

              <View style={{ flex: 1, marginHorizontal: rp(12) }}>
                {/* Eyebrow */}
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: rs(12), fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: rp(2) }}>
                  {event?.venue || "InstaPark"} · {event?.date || "Today"}
                </Text>
                {/* Title */}
                <Heading level="display" style={{ color: theme.colors.surface, fontSize: rs(24), marginBottom: rp(8) }} numberOfLines={1}>
                  {event?.name || "Loading..."}
                </Heading>
                {/* Pills Row */}
                <View style={{ flexDirection: "row", gap: rp(8), flexWrap: "wrap" }}>
                  {event?.status && (
                    <View style={{ backgroundColor: event.status === "active" ? "rgba(16,185,129,0.25)" : event.status === "upcoming" ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.18)", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(6) }}>
                      <Text style={{ color: theme.colors.surface, fontSize: rs(10), fontWeight: "900", letterSpacing: rs(1) }}>
                        {event.status === "closed" ? "CLOSED" : event.status.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {event?.start_time && (
                    <View style={{ backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(6) }}>
                      <Text style={{ color: theme.colors.surface, fontSize: rs(10), fontWeight: "700" }}>
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
                  <Ionicons name="warning" size={20} color={sosCount > 0 ? theme.colors.danger : "rgba(255,255,255,0.5)"} />
                  {sosCount > 0 && (
                    <View style={{
                      position: "absolute", top: -rp(4), right: -rp(4),
                      backgroundColor: theme.colors.danger,
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
                  <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.surface} />
                </TouchableOpacity>
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
            <View style={{ position: 'absolute', top: rp(80), right: rp(20), backgroundColor: theme.colors.surface, borderRadius: rp(16), paddingVertical: rp(8), zIndex: 1000, ...cardShadow }}>
              {!isClosed && (
                <>
                  <TouchableOpacity
                    style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => { setShowMenu(false); router.push({ pathname: "/(supervisor)/(tabs)/edit-event", params: { eventId: currentEventId } }); }}
                  >
                    <Ionicons name="create-outline" size={20} color={ACCENT_COLOR} />
                    <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Edit Event</Text>
                  </TouchableOpacity>
                  <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
                  <TouchableOpacity
                    style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => { setShowMenu(false); setShowEventQRModal(true); }}
                  >
                    <Ionicons name="qr-code-outline" size={20} color={ACCENT_COLOR} />
                    <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Event Guest QR</Text>
                  </TouchableOpacity>
                  <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
                  <TouchableOpacity
                    style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => { setShowMenu(false); setShowIncidentModal(true); }}
                  >
                    <Ionicons name="warning-outline" size={20} color={ACCENT_COLOR} />
                    <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Report Incident</Text>
                  </TouchableOpacity>
                  <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
                </>
              )}
              {isClosed && (
                <>
                  <TouchableOpacity
                    style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => { setShowMenu(false); reopenEvent(); }}
                  >
                    <Ionicons name="play" size={20} color={theme.colors.success} />
                    <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Reactivate Event</Text>
                  </TouchableOpacity>
                  <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
                </>
              )}
              {event?.status === "active" && (
                <>
                  <TouchableOpacity
                    style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => { setShowMenu(false); closeEvent(); }}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                    <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Close Event</Text>
                  </TouchableOpacity>
                  <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
                </>
              )}
              <TouchableOpacity
                style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                onPress={() => { setShowMenu(false); exportCSV(); }}
              >
                <Ionicons name="document-text-outline" size={20} color={ACCENT_COLOR} />
                <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Export CSV</Text>
              </TouchableOpacity>
              <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
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

      {event?.status === "upcoming" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: rp(20), marginTop: rp(40) }}>
          <Ionicons name="time-outline" size={rp(64)} color={theme.colors.textMuted} style={{ marginBottom: rp(16) }} />
          <Text style={{ fontSize: rs(18), fontWeight: "800", color: theme.colors.textPrimary, marginBottom: rp(8) }}>Event Not Yet Active</Text>
          <Text style={{ fontSize: rs(14), color: theme.colors.textSecondary, textAlign: "center", marginBottom: rp(32), lineHeight: rs(20) }}>This event is scheduled for the future. It will activate automatically 30 minutes before the start time.</Text>
          <TouchableOpacity
            onPress={activateEventManually}
            style={{ backgroundColor: ACCENT_COLOR, paddingVertical: rp(16), paddingHorizontal: rp(32), borderRadius: rp(99), flexDirection: "row", alignItems: "center", ...cardShadow }}>
            <Ionicons name="flash-outline" size={20} color={theme.colors.surface} />
            <Text style={{ color: theme.colors.surface, fontWeight: "900", fontSize: rs(14), marginLeft: rp(8), letterSpacing: rs(0.5) }}>ACTIVATE NOW</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
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
                    backgroundColor: tab === t ? ACCENT_COLOR : theme.colors.surface,
                    borderWidth: rp(1),
                    borderColor: tab === t ? ACCENT_COLOR : theme.colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{
                      fontSize: rs(11),
                      fontWeight: "800",
                      color: tab === t ? theme.colors.surface : theme.colors.textSecondary,
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
            contentContainerStyle={{ paddingHorizontal: rp(16), paddingBottom: rp(120) + tabBarHeight }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchEvent(); await fetchCars(); setRefreshing(false); }} tintColor={ACCENT_COLOR} />}
          >
            {tab === "cars" ? (
              <>
                {/* Add Car Button */}
                {(!isClosed && event?.is_checkin_open !== false) && (
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/(supervisor)/(tabs)/scan", params: { cameFromDetail: "true" } })}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.textPrimary, borderRadius: rp(16), paddingVertical: rp(16), marginBottom: rp(16) }}
                  >
                    <Ionicons name="add" size={20} color={theme.colors.surface} />
                    <Text style={{ color: theme.colors.surface, fontWeight: "900", letterSpacing: rs(1), marginLeft: rp(8) }}>CHECK IN CAR</Text>
                  </TouchableOpacity>
                )}

                {/* Search Input */}
                <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), paddingHorizontal: rp(16), flexDirection: "row", alignItems: "center", marginBottom: rp(12), ...cardShadow }}>
                  <Ionicons name="search" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search plate or card code..."
                    placeholderTextColor={theme.colors.textMuted}
                    style={{ flex: 1, paddingVertical: rp(14), marginLeft: rp(12), color: theme.colors.textPrimary, fontSize: rs(14), fontWeight: "600" }}
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
                        backgroundColor: statusFilter === f ? ACCENT_COLOR : theme.colors.surface,
                        borderWidth: rp(1),
                        borderColor: statusFilter === f ? ACCENT_COLOR : theme.colors.border,
                      }}
                    >
                      <Text style={{ fontSize: rs(11), fontWeight: "800", color: statusFilter === f ? theme.colors.surface : theme.colors.textSecondary, letterSpacing: rs(1) }}>
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
                        backgroundColor: theme.colors.surface,
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
                          <Text style={{ fontWeight: "900", color: theme.colors.textPrimary, fontSize: rs(18), letterSpacing: 0.5 }}>{car.plate}</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6), gap: rp(8), flexWrap: "wrap" }}>
                          {car.zone && car.slot && (
                            <View style={{ backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                              <Text style={{ color: theme.colors.textSecondary, fontSize: rs(10), fontWeight: "800" }}>
                                {car.zone}-{car.slot}{(car.key_tag_number || car.key_tag) ? ` · #${car.key_tag_number || car.key_tag}` : ""}{car.card_code ? ` · Code ${car.card_code}` : ""}
                              </Text>
                            </View>
                          )}
                          {!car.zone && !car.slot && (car.key_tag_number || car.key_tag) && (
                            <View style={{ backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                              <Text style={{ color: theme.colors.textSecondary, fontSize: rs(10), fontWeight: "800" }}>
                                Key Tag #{car.key_tag_number || car.key_tag}{car.card_code ? ` • Code ${car.card_code}` : ""}
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
                        <Ionicons name="chevron-forward" size={16} color={theme.colors.border} />
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
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.textPrimary, borderRadius: rp(16), paddingVertical: rp(14), marginBottom: rp(16) }}
                >
                  <Ionicons name="share-social-outline" size={18} color={theme.colors.surface} />
                  <Text style={{ color: theme.colors.surface, fontWeight: "900", letterSpacing: rs(1), marginLeft: rp(8) }}>
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
                        style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), padding: rp(14), marginBottom: rp(10), borderLeftWidth: rp(4), borderLeftColor: cfg.color, ...cardShadow }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View style={{ flexDirection: "row", alignItems: "baseline", gap: rp(6) }}>
                            <Text style={{ fontWeight: "900", color: theme.colors.textPrimary, fontSize: rs(16) }}>{car.plate}</Text>
                          </View>
                          <View style={{ backgroundColor: cfg.color + "20", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                            <Text style={{ color: cfg.color, fontSize: rs(10), fontWeight: "800" }}>{cfg.label}</Text>
                          </View>
                        </View>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginTop: rp(4) }}>
                          {car.guest_name || "—"} · Driver: {car.driverName}{(car.key_tag_number || car.key_tag) ? ` · #${car.key_tag_number || car.key_tag}` : ""}{car.card_code ? ` · Code ${car.card_code}` : ""}
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
              <View style={{ flex: 1, paddingBottom: rp(100) + tabBarHeight }}>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginBottom: rp(16), gap: rp(8) }}>
                  <TouchableOpacity
                    onPress={assignAll}
                    disabled={assigningAll || drivers.filter(d => (d.available || d.assigned) && !d.assigned).length === 0}
                    style={{
                      backgroundColor: assigningAll ? theme.colors.surfaceAlt : ACCENT_COLOR,
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
                        <Ionicons name="checkmark-done" size={14} color={theme.colors.surface} />
                        <Text style={{ color: theme.colors.surface, fontWeight: "900", fontSize: rs(12), marginLeft: rp(6), letterSpacing: rs(1) }}>ASSIGN ALL</Text>
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
                  <View key={d.id} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(24), padding: rp(16), marginBottom: rp(12), ...cardShadow }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={{ backgroundColor: ACCENT_COLOR, borderRadius: rp(99), width: rp(48), height: rp(48), alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: theme.colors.surface, fontWeight: "900", fontSize: rs(18) }}>{d.name?.[0]?.toUpperCase()}</Text>
                      </View>
                      <TouchableOpacity
                        style={{ flex: 1, marginLeft: rp(12) }}
                        onPress={() => router.push({ pathname: "/(admin)/(tabs)/driver-stats", params: { driverId: d.id, driverName: d.name } })}
                      >
                        <Text style={{ fontWeight: "900", color: theme.colors.textPrimary, fontSize: rs(15) }}>{d.name}</Text>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12) }}>{d.employee_id}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(4) }}>
                          <View style={{ width: rp(8), height: rp(8), borderRadius: rp(99), marginRight: rp(6), backgroundColor: d.available ? theme.colors.success : theme.colors.danger }} />
                          <Text style={{ fontSize: rs(11), fontWeight: "700", color: d.available ? theme.colors.success : theme.colors.danger }}>
                            {d.available ? "Available" : `In ${d.conflict_event_name || "another event"}`}
                          </Text>
                          {d.is_verified === false && (
                            <View style={{ backgroundColor: theme.colors.warningLight, paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(4), marginLeft: rp(6) }}>
                              <Text style={{ color: theme.colors.warning, fontSize: rs(9), fontWeight: "bold" }}>UNVERIFIED</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: "row", marginTop: rp(10), gap: rp(10) }}>
                      <View style={{ backgroundColor: theme.colors.successLight, paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                        <Text style={{ color: theme.colors.success, fontSize: rs(11), fontWeight: "700" }}>Checked in: {d.cars_checked_in || 0}</Text>
                      </View>
                      <View style={{ backgroundColor: theme.colors.infoLight, paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                        <Text style={{ color: theme.colors.info, fontSize: rs(11), fontWeight: "700" }}>Retrieved: {d.cars_retrieved || 0}</Text>
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
                          borderColor: theme.colors.danger,
                          opacity: assigningId === d.id ? 0.7 : 1,
                        }}
                      >
                        {assigningId === d.id ? (
                          <ActivityIndicator size="small" color={d.assigned ? theme.colors.danger : theme.colors.surface} />
                        ) : (
                          <Text style={{ fontWeight: "900", letterSpacing: rs(1.5), color: d.assigned ? theme.colors.danger : theme.colors.surface, fontSize: rs(13) }}>
                            {d.assigned ? "UNASSIGN" : "ASSIGN"}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={{ marginTop: rp(12), backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center" }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: rs(11) }}>
                          {d.is_verified === false && !d.assigned ? "Unverified" : `In ${d.conflict_event_name || "another event"}`}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : tab === "insights" ? (
              <View style={{ flex: 1, paddingBottom: rp(100) + tabBarHeight }}>

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
                              backgroundColor: selectedZone === z ? ACCENT_COLOR : theme.colors.surface,
                              borderRadius: rp(16),
                              paddingHorizontal: rp(16),
                              paddingVertical: rp(10),
                              marginRight: rp(10),
                              ...cardShadow,
                            }}
                          >
                            <Text style={{ fontWeight: "800", fontSize: rs(13), color: selectedZone === z ? theme.colors.surface : theme.colors.textPrimary }}>Zone {z}</Text>
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
                    <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(24), padding: rp(16), marginBottom: rp(16), ...cardShadow }}>
                      <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(3), marginBottom: rp(16) }}>ZONE {selectedZone} — SLOT MAP</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(8) }}>
                        {zoneSlots.map(s => (
                          <View
                            key={s.id}
                            style={{
                              width: rp(56),
                              height: rp(56),
                              borderRadius: rp(14),
                              backgroundColor: s.is_occupied ? theme.colors.dangerLight : theme.colors.successLight,
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

                <TouchableOpacity onPress={fetchStats} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), paddingVertical: rp(10), alignItems: "center", marginBottom: rp(16), borderWidth: rp(1), borderColor: theme.colors.border }}>
                  <Text style={{ color: ACCENT_COLOR, fontWeight: "800", letterSpacing: rs(1) }}>↻ Refresh Stats</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: rp(16) }}>
                  {[

                    { label: "CARS", value: stats?.total_cars ?? 0, color: theme.colors.primary, icon: "car" },
                    { label: "PARKED", value: stats?.still_parked ?? 0, color: theme.colors.primary, icon: "location" },
                    { label: "SLOTS", value: `${slots ? slots.filter(s => s.is_occupied).length : 0}/${slots ? slots.length : 0}`, color: ACCENT_COLOR, icon: "grid" },
                    { label: "DELIVERED", value: stats?.total_delivered ?? 0, color: theme.colors.textSecondary, icon: "checkmark-circle" },
                    { label: "INCIDENTS", value: stats?.total_incidents ?? 0, color: (stats?.total_incidents > 0 ? theme.colors.danger : theme.colors.success), icon: "warning" },
                    { label: "PEAK HOUR", value: stats?.peak_hour ?? "—", color: theme.colors.primary, icon: "trending-up" },
                    { label: "AVG RATING", value: stats?.avg_rating ?? 0, color: theme.colors.warning, icon: "star" },
                    { label: "AVG RETRIEVAL", value: stats?.avg_retrieval_minutes ? `${stats.avg_retrieval_minutes} min` : "0 min", color: theme.colors.info, icon: "timer" },
                    { label: "TOP DRIVER", value: stats?.top_driver ?? "—", color: theme.colors.primary, icon: "trophy" },
                  ].map((s, idx) => (
                    <View
                      key={idx}
                      style={{
                        width: "48%",
                        backgroundColor: theme.colors.surface,
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
                      <Text style={{ fontSize: rs(20), fontWeight: "900", color: theme.colors.textPrimary }}>{s.value}</Text>
                      <Text style={{ fontSize: rs(10), color: theme.colors.textSecondary, fontWeight: "800", marginTop: rp(2) }}>{s.label}</Text>
                      {s.sub && <Text style={{ fontSize: rs(9), color: theme.colors.textMuted, marginTop: rp(1) }}>{s.sub}</Text>}
                    </View>
                  ))}
                </View>

                {/* {event?.event_type !== "hotel_daily" && (
              <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(24), padding: rp(24), marginBottom: rp(16), ...cardShadow }}>
                <Text style={{ fontSize: rs(16), fontWeight: "900", color: theme.colors.primary, marginBottom: rp(16) }}>Event Host</Text>

                <Text style={{ fontSize: rs(10), fontWeight: "800", color: theme.colors.textMuted, marginBottom: rp(4), letterSpacing: rs(1) }}>HOST NAME</Text>
                <TextInput
                  value={event?.host_name || ""}
                  onChangeText={txt => setEvent(prev => ({ ...prev, host_name: txt }))}
                  placeholder="e.g. John Doe"
                  placeholderTextColor=theme.colors.textMuted
                  editable={!isClosed}
                  style={{ backgroundColor: isClosed ? theme.colors.surfaceAlt : theme.colors.surfaceAlt, borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(12), padding: rp(12), color: isClosed ? theme.colors.textMuted : theme.colors.textPrimary, marginBottom: rp(16) }}
                />

                <Text style={{ fontSize: rs(10), fontWeight: "800", color: theme.colors.textMuted, marginBottom: rp(4), letterSpacing: rs(1) }}>HOST EMAIL</Text>
                <View style={{ flexDirection: "row", gap: rp(8) }}>
                  <TextInput
                    value={event?.host_email || ""}
                    onChangeText={txt => setEvent(prev => ({ ...prev, host_email: txt }))}
                    placeholder="john@example.com"
                    placeholderTextColor=theme.colors.textMuted
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isClosed}
                    style={{ flex: 1, backgroundColor: isClosed ? theme.colors.surfaceAlt : theme.colors.surfaceAlt, borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(12), padding: rp(12), color: isClosed ? theme.colors.textMuted : theme.colors.textPrimary }}
                  />
                  {!isClosed && (
                    <TouchableOpacity
                      onPress={async () => {
                        if (!event?.host_email) {
                          confirmDialog.info("Required", "Please enter host email");
                          return;
                        }
                        try {
                          await api.patch(`/events/${currentEventId}/host`, {
                            host_name: event.host_name,
                            host_email: event.host_email
                          });
                          confirmDialog.info("Success", "Host updated and portal email sent");
                          fetchStats(); // supervisor file calls fetchStats/cars independently
                        } catch (err) {
                          confirmDialog.info("Couldn't update host", "Something went wrong updating the host. Check your connection and try again.");
                        }
                      }}
                      style={{ backgroundColor: "#1A3C6E", paddingHorizontal: rp(16), justifyContent: "center", borderRadius: rp(12) }}
                    >
                      <Text style={{ color: theme.colors.surface, fontWeight: "800", fontSize: rs(12) }}>
                        {event?.host_email_sent ? "Resend Portal" : "Send Portal"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {isClosed && (
                  <Text style={{ color: theme.colors.danger, fontSize: rs(11), marginTop: rp(8), fontWeight: "600" }}>
                    Cannot send portal email — event is closed
                  </Text>
                )}

                {event?.host_email_sent && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(12), gap: rp(6) }}>
                    <Ionicons name="checkmark-circle" size={16} color=theme.colors.success />
                    <Text style={{ fontSize: rs(12), fontWeight: "800", color: theme.colors.success }}>Portal email sent</Text>
                  </View>
                )}
              </View>
            )} */}

                <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(24), padding: rp(24), marginBottom: rp(16), ...cardShadow }}>
                  <Text style={{ fontSize: rs(16), fontWeight: "900", color: theme.colors.primary, marginBottom: rp(4) }}>Send Report by Email</Text>
                  <Text style={{ fontSize: rs(12), color: theme.colors.textMuted, marginBottom: rp(16) }}>
                    Manually send the full event report (PDF/CSV) to any email address right now.
                  </Text>
                  <View style={{ flexDirection: "row", gap: rp(8) }}>
                    <TextInput
                      value={reportEmail}
                      onChangeText={setReportEmail}
                      placeholder="recipient@example.com"
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt, borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(12), padding: rp(12), color: theme.colors.textPrimary }}
                    />
                    <TouchableOpacity
                      onPress={async () => {
                        if (!reportEmail) {
                          confirmDialog.info("Required", "Please enter an email address");
                          return;
                        }
                        setSendingReport(true);
                        try {
                          await api.post(`/events/${currentEventId}/send-report`, {
                            email: reportEmail
                          });
                          setReportEmail("");
                          confirmDialog.info("Success", "Report queued for sending!");
                        } catch (err) {
                          confirmDialog.info("Error", err?.response?.data?.detail || "Couldn't send report.");
                        } finally {
                          setSendingReport(false);
                        }
                      }}
                      disabled={sendingReport}
                      style={{ backgroundColor: sendingReport ? theme.colors.textMuted : theme.colors.success, paddingHorizontal: rp(16), justifyContent: "center", borderRadius: rp(12) }}
                    >
                      {sendingReport ? (
                        <ActivityIndicator color={theme.colors.surface} size="small" />
                      ) : (
                        <Text style={{ color: theme.colors.surface, fontWeight: "800", fontSize: rs(12) }}>Send</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

              </View>
            ) : tab === "incidents" ? (
              <View style={{ flex: 1, paddingBottom: rp(100) + tabBarHeight }}>
                {incidents.length === 0 ? (
                  <View style={{ alignItems: "center", marginTop: rp(60) }}>
                    <View
                      style={{
                        width: rp(80),
                        height: rp(80),
                        borderRadius: rp(40),
                        backgroundColor: theme.colors.successLight,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: rp(16),
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={40} color={theme.colors.success} />
                    </View>
                    <Text style={{ fontSize: rs(18), fontWeight: "900", color: theme.colors.textPrimary }}>
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
                        backgroundColor: theme.colors.surface,
                        borderRadius: rp(24),
                        padding: rp(16),
                        marginBottom: rp(12),
                        ...cardShadow,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: rp(12) }}>
                        <View style={{ flexDirection: "column", gap: rp(4) }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8) }}>
                            <View style={{ backgroundColor: theme.colors.textPrimary, paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(8) }}>
                              <Text style={{ color: theme.colors.surface, fontWeight: "900", fontSize: rs(13) }}>{i.plate}</Text>
                            </View>
                            <View style={{ paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(6), backgroundColor: i.status === "OPEN" ? theme.colors.dangerLight : i.status === "IN_REVIEW" ? theme.colors.warningLight : i.status === "RESOLVED" ? theme.colors.successLight : theme.colors.surfaceAlt }}>
                              <Text style={{ color: i.status === "OPEN" ? "#991B1B" : i.status === "IN_REVIEW" ? "#92400E" : i.status === "RESOLVED" ? "#065F46" : theme.colors.textSecondary, fontSize: rs(10), fontWeight: "800" }}>{i.status}</Text>
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
                      <Text style={{ color: theme.colors.textSecondary, fontSize: rs(14), lineHeight: rp(20), marginBottom: rp(12) }}>
                        {i.description}
                      </Text>

                      {(i.status === "RESOLVED" || i.status === "DISMISSED") && i.remark && (
                        <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(12), padding: rp(12), marginBottom: rp(12) }}>
                          <Text style={{ color: theme.colors.textSecondary, fontSize: rs(13), lineHeight: 18 }}>{i.remark}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6) }}>
                            <Ionicons name="checkmark-done-circle" size={14} color={theme.colors.textSecondary} />
                            <Text style={{ color: theme.colors.textSecondary, fontSize: rs(11), marginLeft: rp(4) }}>
                              Resolved by {i.resolved_by || "Unknown"} on {i.resolved_at ? new Date(i.resolved_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: 'Asia/Kolkata' }) : "Unknown"}
                            </Text>
                          </View>
                        </View>
                      )}

                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: rp(1), borderTopColor: theme.colors.surfaceAlt, paddingTop: rp(12) }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Ionicons name="person-outline" size={14} color={theme.colors.textSecondary} />
                          <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginLeft: rp(6), fontWeight: "600" }}>
                            Driver: {i.driver_name || "—"}
                          </Text>
                        </View>
                        {(i.status === "OPEN" || i.status === "IN_REVIEW") && (
                          <TouchableOpacity
                            onPress={() => { setResolvingIncident(i); setResolveStatus(i.status === "OPEN" ? "IN_REVIEW" : i.status); setResolveRemark(""); setShowResolveModal(true); }}
                            style={{ backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(10), paddingVertical: rp(6), borderRadius: rp(12) }}
                          >
                            <Text style={{ color: theme.colors.textPrimary, fontWeight: "700", fontSize: rs(12) }}>Update Status</Text>
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
              <View style={{ flex: 1, paddingBottom: rp(100) + tabBarHeight }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rp(16) }}>
                  <Text style={{ fontSize: rs(16), fontWeight: "900", color: theme.colors.textPrimary, letterSpacing: rs(1) }}>GUEST FEEDBACK</Text>
                  {loadingFeedback && <ActivityIndicator size="small" color={ACCENT_COLOR} />}
                </View>
                {!loadingFeedback && feedback.length === 0 ? (
                  <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: rp(60), backgroundColor: theme.colors.surface, borderRadius: rp(16), ...cardShadow }}>
                    <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.border} />
                    <Text style={{ fontSize: rs(14), fontWeight: "800", color: theme.colors.textSecondary, marginTop: rp(12) }}>NO FEEDBACK YET</Text>
                  </View>
                ) : (
                  feedback.map(item => (
                    <View key={item.id} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), padding: rp(16), marginBottom: rp(12), ...cardShadow }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: rp(8) }}>
                        <View>
                          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(4) }}>
                            <Text style={{ backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(4), fontSize: rs(10), fontWeight: "900", color: theme.colors.textSecondary, marginRight: rp(8) }}>{item.plate}</Text>
                            <Text style={{ fontSize: rs(14), fontWeight: "800", color: theme.colors.textPrimary }}>{item.guest_name}</Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            {[1, 2, 3, 4, 5].map(star => (
                              <Ionicons key={star} name="star" size={12} color={star <= item.stars ? theme.colors.warning : theme.colors.border} />
                            ))}
                            <Text style={{ fontSize: rs(10), color: theme.colors.textMuted, fontWeight: "600", marginLeft: rp(8) }}>
                              {new Date(item.created_at).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                        {item.driver_name && (
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={{ fontSize: rs(9), fontWeight: "800", color: theme.colors.textMuted, letterSpacing: rs(1) }}>DRIVER</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(6), marginTop: rp(2) }}>
                              <Ionicons name="car-outline" size={12} color={theme.colors.textSecondary} style={{ marginRight: rp(4) }} />
                              <Text style={{ fontSize: rs(11), fontWeight: "700", color: theme.colors.textSecondary }}>{item.driver_name}</Text>
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
                              <View key={q.key} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(10), paddingVertical: rp(8), borderRadius: rp(10) }}>
                                <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, flex: 1, marginRight: rp(8) }}>{q.label}</Text>
                                <Text style={{
                                  backgroundColor: answer ? "#FEF2F2" : theme.colors.successLight,
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
                        <View style={{ backgroundColor: theme.colors.surfaceAlt, padding: rp(12), borderRadius: rp(12) }}>
                          <Text style={{ fontSize: rs(12), color: theme.colors.textSecondary, fontStyle: "italic", fontWeight: "500" }}>"{item.comment}"</Text>
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </View>

            ) : null}
          </ScrollView>
        </>
      )}


      <Modal visible={showCarModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), padding: rp(20), paddingBottom: rp(20) + (insets?.bottom || 0), maxHeight: "85%" }}>
              <View style={{ alignItems: "center", marginBottom: rp(12) }}><View style={{ backgroundColor: theme.colors.border, width: rp(48), height: rp(4), borderRadius: rp(99) }} /></View>
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
                            <View style={{ backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                              <Text style={{ color: theme.colors.textSecondary, fontSize: rs(10), fontWeight: "800" }}>
                                {selectedCar.zone}-{selectedCar.slot}{(selectedCar.key_tag_number || selectedCar.key_tag) ? ` · #${selectedCar.key_tag_number || selectedCar.key_tag}` : ""}{selectedCar.card_code ? ` · Code ${selectedCar.card_code}` : ""}
                              </Text>
                            </View>
                          )}
                          {!selectedCar.zone && !selectedCar.slot && (selectedCar.key_tag_number || selectedCar.key_tag) && (
                            <View style={{ backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                              <Text style={{ color: theme.colors.textSecondary, fontSize: rs(10), fontWeight: "800" }}>
                                Key Tag #{selectedCar.key_tag_number || selectedCar.key_tag}{selectedCar.card_code ? ` • Code ${selectedCar.card_code}` : ""}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={{ paddingHorizontal: rp(12), paddingVertical: rp(4), borderRadius: rp(99), backgroundColor: STATUS_CONFIG[selectedCar.status]?.color }}>
                        <Text style={{ color: theme.colors.surface, fontWeight: "800", fontSize: rs(11) }}>{STATUS_CONFIG[selectedCar.status]?.label}</Text>
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
                            <Ionicons name="car-sport-outline" size={18} color={theme.colors.surface} />
                            <Text style={{ color: theme.colors.surface, fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>
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
                          <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(20), padding: rp(16), marginTop: rp(12) }}>
                            <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8) }}>
                              GUEST'S SELF-PICKUP CODE
                            </Text>
                            <TextInput
                              value={selfPickupOtpInput}
                              onChangeText={setSelfPickupOtpInput}
                              placeholder="Enter code (leave blank if none given)"
                              keyboardType="number-pad"
                              maxLength={6}
                              style={{ backgroundColor: theme.colors.surface, borderRadius: rp(12), borderWidth: 1, borderColor: theme.colors.border, paddingVertical: rp(10), paddingHorizontal: rp(14), fontSize: rs(18), fontWeight: "800", textAlign: "center", letterSpacing: rs(4) }}
                            />
                            <TouchableOpacity
                              onPress={() => doMarkSelfPickup(selectedCar, selfPickupOtpInput)}
                              disabled={markingSelfPickup === selectedCar.id}
                              style={{ backgroundColor: theme.colors.accent, borderRadius: rp(12), paddingVertical: rp(12), alignItems: "center", marginTop: rp(10) }}
                            >
                              {markingSelfPickup === selectedCar.id ? (
                                <ActivityIndicator color={theme.colors.surface} size="small" />
                              ) : (
                                <Text style={{ color: theme.colors.surface, fontWeight: "700", letterSpacing: rs(1) }}>Verify OTP</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    {selectedCar.status === "ARRIVED_AT_GATE" && (
                      <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(20), padding: rp(16), marginTop: rp(16) }}>
                        <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8) }}>DELIVERY CODE</Text>
                        {!deliveryOtp ? (
                          <TouchableOpacity
                            onPress={fetchDeliveryOtp}
                            disabled={loadingOtp}
                            style={{ backgroundColor: ACCENT_COLOR, borderRadius: rp(12), paddingVertical: rp(12), alignItems: "center", flexDirection: "row", justifyContent: "center" }}
                          >
                            {loadingOtp ? (
                              <ActivityIndicator color={theme.colors.surface} size="small" />
                            ) : (
                              <Text style={{ color: theme.colors.surface, fontWeight: "700", letterSpacing: rs(1) }}>Show Code</Text>
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
                        <Ionicons name="person-add-outline" size={18} color={theme.colors.surface} />
                        <Text style={{ color: theme.colors.surface, fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>
                          {(selectedCar.status === "RETRIEVAL_REQUESTED" || selectedCar.status === "ACCEPTED" || selectedCar.status === "BEING_FETCHED")
                            ? (selectedCar.retrieval_driver_id ? "REASSIGN DRIVER" : "ASSIGN DRIVER")
                            : (selectedCar.check_in_driver_id ? "REASSIGN DRIVER" : "ASSIGN DRIVER")}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {showAssignPicker && (
                      <View style={{ marginTop: rp(16), backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(20), padding: rp(16) }}>
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
                              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: rp(12), borderBottomWidth: rp(1), borderBottomColor: theme.colors.border }}
                            >
                              <Text style={{ fontWeight: "700", color: theme.colors.textPrimary }}>{d.name}</Text>
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
                      style={{ backgroundColor: theme.colors.surface, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(12), flexDirection: "row", justifyContent: "center" }}
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
                        style={{ backgroundColor: theme.colors.surface, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: rp(12) }}
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
            <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), padding: rp(20), paddingBottom: rp(20) + (insets?.bottom || 0), maxHeight: "92%" }}>
              <View style={{ alignItems: "center", marginBottom: rp(14) }}><View style={{ backgroundColor: theme.colors.border, width: rp(48), height: rp(4), borderRadius: rp(99) }} /></View>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(16) }}>
                <View style={{ backgroundColor: theme.colors.warningLight, borderRadius: rp(99), padding: rp(8), marginRight: rp(10) }}><Ionicons name="warning" size={20} color={theme.colors.warning} /></View>
                <Text style={{ fontSize: rs(18), fontWeight: "900", color: theme.colors.textPrimary, flex: 1 }}>Report Incident</Text>
                <TouchableOpacity onPress={() => { setShowIncidentModal(false); setIncidentErrors({}); }}><Ionicons name="close-circle" size={26} color={theme.colors.border} /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={modalLabel}>SELECT CAR *</Text>
                {!incidentCar && (
                  <>
                    <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(14), borderWidth: rp(1), borderColor: incidentErrors.car ? theme.colors.danger : theme.colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: rp(12), marginBottom: incidentErrors.car ? rp(6) : rp(6) }}>
                      <Ionicons name="search" size={16} color={ACCENT_COLOR} />
                      <TextInput value={incidentCarSearch} onChangeText={(text) => { setIncidentCarSearch(text); if (incidentErrors.car) setIncidentErrors(prev => ({ ...prev, car: undefined })); }} placeholder="Search plate or card code..." style={{ flex: 1, paddingVertical: rp(13), paddingLeft: rp(8), color: theme.colors.textPrimary, fontWeight: "700" }} />
                    </View>
                    {incidentErrors.car && <Text style={[modalErrorText, { marginTop: rp(4), marginBottom: rp(12) }]}>* {incidentErrors.car}</Text>}
                    {incidentCarSearch.length > 1 && (
                      <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(14), borderWidth: rp(1), borderColor: theme.colors.border, marginBottom: rp(12), overflow: "hidden" }}>
                        {cars.filter(c =>
                          c.plate?.toLowerCase().includes(incidentCarSearch.toLowerCase()) ||
                          c.card_code?.toString().includes(incidentCarSearch.trim())
                        ).slice(0, 5).map(c => (
                          <TouchableOpacity key={c.id} onPress={() => { setIncidentCar(c); setIncidentCarSearch(c.plate); if (incidentErrors.car) setIncidentErrors(prev => ({ ...prev, car: undefined })); }} style={{ padding: rp(14), borderBottomWidth: rp(1), borderBottomColor: theme.colors.surfaceAlt, flexDirection: "row", alignItems: "center" }}>
                            <Text style={{ fontWeight: "900", color: theme.colors.textPrimary }}>{c.plate}</Text>
                            {c.card_code && <Text style={{ color: theme.colors.textMuted, marginLeft: 8 }}>({c.card_code})</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
                {incidentCar && (
                  <View style={{ backgroundColor: theme.colors.successLight, borderRadius: rp(12), padding: rp(12), marginBottom: rp(16), flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
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
                              ? ACCENT_COLOR : theme.colors.surface,
                          borderColor:
                            (incidentDriver?.id ?? null) === d.id
                              ? ACCENT_COLOR : theme.colors.border,
                        }}
                      >
                        <Text style={{
                          fontWeight: "800",
                          fontSize: rs(13),
                          color:
                            (incidentDriver?.id ?? null) === d.id
                              ? theme.colors.surface : theme.colors.textSecondary,
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
                          borderColor: incidentErrors.type ? theme.colors.danger : (incidentType === t.key ? theme.colors.primary : theme.colors.border),
                          backgroundColor: incidentType === t.key ? theme.colors.primary : theme.colors.surfaceAlt,
                        }}
                      >
                        <Text style={{
                          fontSize: rs(11),
                          fontWeight: "700",
                          color: incidentType === t.key ? theme.colors.surface : theme.colors.textSecondary,
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
                  <TouchableOpacity onPress={pickIncidentPhoto} style={{ borderWidth: rp(1.5), borderColor: incidentPhoto ? theme.colors.success : theme.colors.border, borderStyle: "dashed", borderRadius: rp(14), padding: rp(16), alignItems: "center", marginBottom: rp(20) }}>
                    <Text style={{ color: incidentPhoto ? theme.colors.success : theme.colors.textMuted, fontWeight: "700" }}>{incidentPhoto ? "Photo Added ✓" : "Add Photo (Optional)"}</Text>
                  </TouchableOpacity>
                  {incidentPhoto && (
                    <TouchableOpacity onPress={() => setIncidentPhoto(null)} style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}>
                      <Ionicons name="close-circle" size={20} color={theme.colors.success} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={submitIncident} disabled={submittingIncident} style={{ backgroundColor: theme.colors.primary, borderRadius: rp(18), paddingVertical: rp(18), alignItems: "center", marginBottom: rp(24) }}>
                  {submittingIncident ? <ActivityIndicator color={theme.colors.surface} /> : <Text style={{ color: theme.colors.surface, fontWeight: "900" }}>SUBMIT INCIDENT</Text>}
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
                        borderColor: alert.status === "ACTIVE" ? "#FCA5A5" : theme.colors.border,
                        backgroundColor: alert.status === "ACTIVE" ? "#FEF2F2" : theme.colors.surfaceAlt,
                        padding: 14,
                        marginBottom: 10,
                      }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <Text style={{ fontWeight: "700", color: alert.status === "ACTIVE" ? theme.colors.danger : theme.colors.textSecondary, fontSize: rs(14) }}>
                            {alert.alert_type.replace(/_/g, " ")}
                          </Text>
                          {alert.status === "RESOLVED" && (
                            <Text style={{ color: theme.colors.success, fontSize: rs(12), fontWeight: "600" }}>Resolved ✓</Text>
                          )}
                        </View>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: rs(13) }}>Driver: {alert.driver_name}</Text>
                        {alert.car_number ? <Text style={{ color: theme.colors.textSecondary, fontSize: rs(13) }}>Car: {alert.car_number}</Text> : null}
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
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.textPrimary, padding: rp(24) }}>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <View style={{ alignItems: "center", marginBottom: rp(32) }}>
              <Text style={{ fontSize: rs(64), marginBottom: rp(12) }}>🚨</Text>
              <Text style={{ fontSize: rs(28), fontWeight: "900", color: theme.colors.danger, textAlign: "center", letterSpacing: rs(2) }}>SOS EMERGENCY</Text>
            </View>

            <View style={{ backgroundColor: theme.colors.textPrimary, borderRadius: rp(24), padding: rp(24), borderWidth: rp(2), borderColor: theme.colors.danger }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(16), borderBottomWidth: rp(1), borderBottomColor: theme.colors.textSecondary, paddingBottom: rp(16) }}>
                <Text style={{ color: "#FCA5A5", fontSize: rs(16), fontWeight: "800" }}>{forcedSOSAlert?.alert_type?.replace(/_/g, " ")}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: rs(12), fontWeight: "600" }}>{fmtDateTime(forcedSOSAlert?.created_at)}</Text>
              </View>

              <View style={{ gap: rp(12), marginBottom: rp(24) }}>
                <Text style={{ color: theme.colors.border, fontSize: rs(16), fontWeight: "600" }}>Driver: <Text style={{ color: theme.colors.surface, fontWeight: "800" }}>{forcedSOSAlert?.driver_name}</Text></Text>
                {forcedSOSAlert?.car_number ? (
                  <Text style={{ color: theme.colors.border, fontSize: rs(16), fontWeight: "600" }}>Car: <Text style={{ color: theme.colors.surface, fontWeight: "800" }}>{forcedSOSAlert?.car_number}</Text></Text>
                ) : null}
                {forcedSOSAlert?.note ? (
                  <View style={{ backgroundColor: theme.colors.textSecondary, padding: rp(12), borderRadius: rp(12), marginTop: rp(8) }}>
                    <Text style={{ color: theme.colors.border, fontSize: rs(14) }}>{forcedSOSAlert.note}</Text>
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
                style={{ backgroundColor: theme.colors.success, borderRadius: rp(16), paddingVertical: rp(18), alignItems: "center" }}
              >
                {resolvingForcedSOS ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={{ color: theme.colors.surface, fontWeight: "900", fontSize: rs(16), letterSpacing: rs(2) }}>MARK RESOLVED</Text>
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
            <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), maxHeight: "92%", paddingBottom: (insets?.bottom || 0) }}>
              <View style={{ alignItems: "center", marginBottom: rp(14) }}>
                <View style={{ backgroundColor: theme.colors.border, width: rp(48), height: rp(4), borderRadius: rp(99) }} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(16), paddingHorizontal: rp(20) }}>
                <View style={{ backgroundColor: theme.colors.infoLight, borderRadius: rp(99), padding: rp(8), marginRight: rp(10) }}>
                  <Ionicons name="shield-checkmark" size={20} color={ACCENT_COLOR} />
                </View>
                <Text style={{ fontSize: rs(18), fontWeight: "900", color: theme.colors.textPrimary, flex: 1 }}>Update Status</Text>
                <TouchableOpacity onPress={() => { setShowResolveModal(false); setResolveErrors({}); }}>
                  <Ionicons name="close-circle" size={26} color={theme.colors.border} />
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
                        backgroundColor: resolveStatus === statusVal ? ACCENT_COLOR : theme.colors.surface,
                        borderColor: resolveStatus === statusVal ? ACCENT_COLOR : theme.colors.border
                      }}
                    >
                      <Text style={{ fontWeight: "800", fontSize: rs(13), color: resolveStatus === statusVal ? theme.colors.surface : theme.colors.textSecondary }}>
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
                  {submittingResolve ? <ActivityIndicator color={theme.colors.surface} /> : <Text style={{ color: theme.colors.surface, fontWeight: "900", fontSize: rs(14), letterSpacing: rs(1) }}>UPDATE INCIDENT</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* {showEventQRModal && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(24), padding: rp(28), alignItems: "center", width: "85%" }}>
            <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.info, letterSpacing: rs(3), marginBottom: rp(12) }}>EVENT GUEST QR</Text>
            <Text style={{ fontSize: rs(20), fontWeight: "900", color: theme.colors.textPrimary, textAlign: "center", marginBottom: rp(20) }}>{event?.name}</Text>
            <View style={{ padding: rp(14), backgroundColor: theme.colors.primaryLight, borderRadius: rp(20), marginBottom: rp(20) }}>
              {eventQrToken ? (
                <QRCode value={`${process.env.EXPO_PUBLIC_GUEST_URL}/pre-register/event/${eventQrToken}`} size={220} color=theme.colors.info />
              ) : (
                <View style={{ width: rp(220), height: rp(220), justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator color=theme.colors.info size="large" />
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
const modalInput = { backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(14), borderWidth: rp(1), borderColor: theme.colors.border, padding: rp(14), color: theme.colors.textPrimary, marginBottom: rp(16), fontSize: rs(14) };
const modalInputError = { borderColor: theme.colors.danger };
const modalErrorText = { color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) };
const exportBtn = { flex: 1, borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center", borderWidth: rp(1), flexDirection: "row", justifyContent: "center" };
