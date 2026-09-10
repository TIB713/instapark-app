import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirmDialog } from "../../../lib/confirmDialog";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { rs, rp } from '../../../utils/responsive';
import { theme } from '../../../utils/theme';
import { Screen, TopBar, Btn, Card, StatusPill } from "../../../components/valet/ui";
import SectionHead from "../../../components/admin/SectionHead";
import StatCard from "../../../components/admin/StatCard";
import { Hero } from "../../../components/admin/Hero";
import { fmtDuration } from '../../../utils/time';
import { buildQueueRows } from "../../../lib/liveQueue";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Share,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const FEEDBACK_QUESTIONS = [
  { key: 'extra_money_asked', label: 'Did the driver ask for extra money?' },
  { key: 'misbehaved', label: 'Was the driver rude or misbehaving?' },
  { key: 'late_arrival', label: 'Did the driver arrive late to retrieve your car?' },
  { key: 'vehicle_damaged', label: 'Was your vehicle damaged?' },
  { key: 'unauthorized_personal_use', label: 'Did you notice the driver using your vehicle without permission?' },
];

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

import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCode from "react-native-qrcode-svg";
import { formatDistanceToNow } from "date-fns";
import { useEventCars } from "../../../hooks/useEventCars";
import { useEventFeedback } from "../../../hooks/useEventFeedback";
import { useEventIncidents } from "../../../hooks/useEventIncidents";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import { connectWS, disconnectWS } from "../../../lib/websocket";
import { pickImageHelper } from "../../../utils/imagePicker";

import { scrollToFirstError } from "../../../lib/scrollToFirstError";

const STATUS_CONFIG = {
  PRE_REGISTERED: { fontFamily: theme.fontFamily.regular, color: theme.colors.primary, label: "Pre-Registered" },
  REGISTERED: { fontFamily: theme.fontFamily.regular, color: theme.colors.warning, label: "Registered" },
  CHECKED_IN: { fontFamily: theme.fontFamily.regular, color: theme.colors.info, label: "Checked In" },
  PARKED: { fontFamily: theme.fontFamily.regular, color: theme.colors.success, label: "Parked" },
  RETRIEVAL_REQUESTED: { fontFamily: theme.fontFamily.regular, color: theme.colors.warning, label: "Requested" },
  ACCEPTED: { fontFamily: theme.fontFamily.regular, color: theme.colors.warning, label: "Accepted" },
  BEING_FETCHED: { fontFamily: theme.fontFamily.regular, color: theme.colors.warning, label: "Fetching" },
  DELIVERED: { fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, label: "Delivered" },
};

const FILTERS = ["ALL", "PRE_REGISTERED", "REGISTERED", "CHECKED_IN", "PARKED", "RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED", "DELIVERED"];

const generateTempPassword = () => Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "1!";

const cardShadow = {
  shadowColor: theme.colors.primary,
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function EventDetail() {
  const insets = useSafeAreaInsets();

  const router = useRouter();

  const { currentEventId, user } = useAppStore();
  const scrollViewRef = useRef(null);
  const fieldRefs = useRef({});

  const [event, setEvent] = useState(null);
  const isClosed = event?.status === "closed";
  const [tab, setTab] = useState("cars");

  const {
    cars, drivers, setDrivers, stats, search, setSearch, statusFilter, setStatusFilter, selectedCar, showCarModal, setShowCarModal, carPhotos, showAssignPicker, setShowAssignPicker, assignSuggestion, assigningDriver, assigningId, setAssigningId, assigningAll, setAssigningAll, slots, fetchCars, fetchDrivers, fetchStats, fetchSlots, handleAssignDriver, assignAll, doToggleAssign, doAssignAll, openCar, openAssignPicker, toggleAssign, removeCar
  } = useEventCars(currentEventId, fetchEvent);

  const { feedback, loadingFeedback } = useEventFeedback(currentEventId, tab);

  const {
    showIncidentModal, setShowIncidentModal, incidentCar, setIncidentCar, incidentDriver, setIncidentDriver, incidentType, setIncidentType, incidentDesc, setIncidentDesc, incidentPhoto, setIncidentPhoto, submittingIncident, incidentCarSearch, setIncidentCarSearch, showResolveModal, setShowResolveModal, setResolvingIncident, resolveStatus, setResolveStatus, resolveRemark, setResolveRemark, submittingResolve, incidents, fetchIncidents, submitResolve, submitIncident
  } = useEventIncidents(currentEventId, fetchStats, fetchEvent);




  const [guestCount, setGuestCount] = useState(null);


  const [refreshing, setRefreshing] = useState(false);



  const [selectedZone, setSelectedZone] = useState(null);


  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const [specialEventHotel, setSpecialEventHotel] = useState(null);
  const [specialEventQRToken, setSpecialEventQRToken] = useState(null);
  const [showSpecialEventQRModal, setShowSpecialEventQRModal] = useState(false);

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
  const [showMenu, setShowMenu] = useState(false);

  const [supervisors, setSupervisors] = useState([]);
  const [assigningSupervisorId, setAssigningSupervisorId] = useState(null);


  const [employeeTab, setEmployeeTab] = useState("supervisors");

  useEffect(() => {
    const backAction = () => {
      if (showCarModal) { setShowCarModal(false); return true; }
      if (showIncidentModal) { setShowIncidentModal(false); return true; }
      if (showSpecialEventQRModal) { setShowSpecialEventQRModal(false); return true; }
      router.back(); return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [showCarModal, showIncidentModal, showSpecialEventQRModal]);

  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}`);
      setEvent(data);
      if ((data.event_type === "hotel_special" || data.event_type === "hotel_daily") && data.hotel_id) {
        try {
          const [hotelRes, qrRes] = await Promise.all([
            api.get(`/hotels/${data.hotel_id}`),
            data.event_type === "hotel_special" ? api.get(`/hotels/${data.hotel_id}/events/${data.id}/qr-token`) : Promise.resolve({ data: {} })
          ]);
          setSpecialEventHotel(hotelRes.data);
          if (data.event_type === "hotel_special") {
            setSpecialEventQRToken(qrRes.data.event_qr_token);
          }
        } catch (err) {
          console.error("Error fetching hotel info/QR for special event:", err);
        }
      } else if (data.event_type === "regular") {
        try {
          const { data: qrData } = await api.get(`/events/${data.id}/qr-token`);
          setSpecialEventQRToken(qrData.event_qr_token);
        } catch (err) {
          console.error("Error fetching QR for event:", err);
        }
      }
    } catch { }
  }, [currentEventId]);




  const fetchSupervisors = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/supervisors`);
      setSupervisors(data || []);
    } catch { }
  }, [currentEventId]);

  const fetchGuestCount = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/guest-count`);
      setGuestCount(data.guest_count || 0);
    } catch { }
  }, [currentEventId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchEvent(), fetchCars(), fetchStats(), fetchSlots()]);
    setRefreshing(false);
  }, [fetchEvent, fetchCars, fetchStats, fetchSlots]);





  const pickSupPhoto = () => {
    pickImageHelper({
      quality: 0.75,
      onSelect: (uri) => {
        setSupPhoto(uri);
      }
    });
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


  useFocusEffect(
    useCallback(() => {
      if (currentEventId) {
        Promise.all([fetchEvent(), fetchCars(), fetchDrivers(), fetchSupervisors(), fetchStats(), fetchGuestCount(), fetchSlots(), fetchIncidents()]).catch(() => { });
      }
    }, [currentEventId, fetchEvent, fetchCars, fetchDrivers, fetchSupervisors, fetchStats, fetchGuestCount, fetchSlots, fetchIncidents])
  );

  useEffect(() => {
    if (!currentEventId) return;
    // WebSocket connections
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







  const exportCSV = async () => {
    setExportingCSV(true);
    try {
      const { data } = await api.get(
        `/events/${currentEventId}/report`
      );
      const headers = [
        "Plate", "Make", "Color", "Status", "Zone", "Slot",
        "Key Tag", "Check-in Driver", "Retrieval Driver",
        "Duration (min)", "Retrieval Time (min)",
        // "Platform Rating",
        "Notes",
        "Pre-registered", "Walk-in", "Peak Hour", "Incidents", "Delivered", "Still Parked"
      ].join(",");
      const rows = data.cars.map(c =>
        [
          c.plate, c.make, c.color, c.status,
          c.zone || "", c.slot || "", c.key_tag || "",
          c.check_in_driver || "", c.retrieval_driver || "",
          c.duration_minutes || "", c.retrieval_minutes || "",
          // c.rating || "",
          `"${(c.notes || "").replace(/"/g, "'")}"`,
          data.summary.pre_registered || 0,
          data.summary.walk_in || 0,
          data.summary.peak_hour || "—",
          data.summary.total_incidents || 0,
          data.summary.delivered || 0,
          data.summary.still_parked || 0,
        ].join(",")
      );
      const csv = [headers, ...rows].join("\n");
      const filename = `${data.event.name.replace(/\s+/g, "_")
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
      confirmDialog.info("Couldn't generate CSV", "Something went wrong creating the file. Please try again.");
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
        <td>${c.duration_minutes != null
          ? fmtDuration(c.duration_minutes) : "—"}</td>
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
        <td style="color:${d.incidents > 0 ? theme.colors.danger : theme.colors.textSecondary
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
            .toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</td>
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
        .header{background:#3F0163;color:white;
          padding:24px 28px;}
        .header h1{font-size:22px;font-weight:900;}
        .header p{opacity:0.8;margin-top:3px;font-size:12px;}
        .section{padding:20px 28px;
          border-bottom:1px solid #f3f4f6;}
        .section h2{font-size:11px;font-weight:800;
          color:#3F0163;letter-spacing:3px;
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
          Generated ${new Date().toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}
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
            <div class="stat-val">${s.pre_registered || 0}</div>
            <div class="stat-lbl">Pre-Registered</div>
          </div>
          <div class="stat">
            <div class="stat-val">${s.walk_in || 0}</div>
            <div class="stat-lbl">Walk-in</div>
          </div>
          <div class="stat">
            <div class="stat-val">${s.delivered}</div>
            <div class="stat-lbl">Delivered</div>
          </div>
          <div class="stat">
            <div class="stat-val">${s.still_parked || 0}</div>
            <div class="stat-lbl">Still Parked</div>
          </div>
          <div class="stat">
            <div class="stat-val">
              ${s.avg_retrieval_minutes}m
            </div>
            <div class="stat-lbl">Avg Retrieval</div>
          </div>
          <div class="stat">
            <div class="stat-val">
              ${s.platform_avg_rating > 0
          ? s.platform_avg_rating + "★" : "—"}
            </div>
            <div class="stat-lbl">Platform Rating</div>
          </div>

          <div class="stat">
            <div class="stat-val" style="color:${s.total_incidents > 0 ? theme.colors.danger : theme.colors.success}">${s.total_incidents}</div>
            <div class="stat-lbl">Incidents</div>
          </div>
          <div class="stat">
            <div class="stat-val">${s.peak_hour || "—"}</div>
            <div class="stat-lbl">Peak Hour</div>
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
          <th>Duration</th><!--<th>Rating</th>--><th>Notes</th>
        </tr></thead>
        <tbody>${carRows}</tbody></table>
      </div>
      <div class="footer">
        InstaPark — Smart Valet Operations · ${e.name}
      </div>
    </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const filename = `${e.name.replace(/\s+/g, "_")
        }_report.pdf`;
      const dest = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      await Sharing.shareAsync(dest, {
        mimeType: "application/pdf",
        dialogTitle: `${e.name} — Event Report`,
      });
    } catch {
      confirmDialog.info("Couldn't generate PDF", "Something went wrong creating the file. Please try again.");
    } finally {
      setExportingPDF(false);
    }
  };

  const closeEvent = () => {
    confirmDialog.destructiveConfirm("Close event", "Are you sure? This cannot be undone.", async () => {
      try {
        await api.post(`/events/${currentEventId}/close`);
        router.back();
      } catch (e) {
        confirmDialog.info("Couldn't close event", "Something went wrong closing the event. Check your connection and try again.");
      }
    }, "Close");
  };

  const reopenEvent = () => {
    confirmDialog.confirm("Reactivate event", "Are you sure you want to reopen this event?", async () => {
      try {
        await api.post(`/events/${currentEventId}/reopen`);
        fetchEvent();
      } catch (e) {
        confirmDialog.info("Couldn't reactivate event", "Something went wrong reopening the event. Check your connection and try again.");
      }
    }, "Reactivate");
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



  const toggleAssignSupervisor = async (s) => {
    confirmDialog.confirm(
      s.assigned ? "Remove supervisor" : "Assign supervisor",
      s.assigned ? `Remove supervisor ${s.name} from this event?` : `Assign supervisor ${s.name} to this event?`,
      () => doToggleAssignSupervisor(s)
    );
  };

  const doToggleAssignSupervisor = async (s) => {
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
      confirmDialog.info("Operation failed", msg || "Something went wrong. Please try again.");
    } finally {
      setAssigningSupervisorId(null);
    }
  };


  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }} testID="event-detail-screen">
      <Hero
        eyebrow={event?.venue ? `${event.venue} · ${event.date || "Today"}` : "Event"}
        title={event?.name || "Loading..."}
        onBack={() => router.back()}
        rightAction={{
          icon: "ellipsis-vertical",
          onPress: () => setShowMenu(!showMenu)
        }}
        badges={[
          event?.status ? { label: event.status === "closed" ? "CLOSED" : event.status.toUpperCase(), tone: event.status === "active" ? "primary" : "warning" } : null,
          guestCount != null ? { label: `${guestCount} GUESTS INVITED`, tone: "primary" } : null,
          event?.event_type === "hotel_daily" ? { label: "🏨 Auto Daily", tone: "warning" } : null,
          event?.event_type === "hotel_special" ? { label: "🏨 Special", tone: "warning" } : null,
        ].filter(Boolean)}
      />

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
            onPress={() => setShowMenu(false)}
          />
          <View
            style={{
              position: 'absolute',
              top: rp(80),
              right: rp(20),
              backgroundColor: theme.colors.surface,
              borderRadius: rp(16),
              paddingVertical: rp(8),
              zIndex: 1000,
              ...cardShadow
            }}
          >
            {/* Menu Items for Active Event */}
            {!isClosed && (
              <>
                <TouchableOpacity
                  style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => {
                    setShowMenu(false);
                    router.push({ pathname: "/(admin)/(tabs)/edit-event", params: { eventId: currentEventId } });
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                  <Text style={{ fontFamily: theme.fontFamily.semibold, marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Edit Event</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
                <TouchableOpacity
                  style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => {
                    setShowMenu(false);
                    setShowIncidentModal(true);
                  }}
                >
                  <Ionicons name="warning-outline" size={20} color={theme.colors.primary} />
                  <Text style={{ fontFamily: theme.fontFamily.semibold, marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Report Incident</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
              </>
            )}

            {isClosed && user?.role && ["owner", "admin", "superadmin"].includes(user.role) && (
              <>
                <TouchableOpacity
                  style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => {
                    setShowMenu(false);
                    reopenEvent();
                  }}
                >
                  <Ionicons name="play-circle" size={20} color={theme.colors.success} />
                  <Text style={{ fontFamily: theme.fontFamily.semibold, marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Reactivate Event</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
              </>
            )}

            {event?.status === "upcoming" && user?.role && ["owner", "admin", "superadmin"].includes(user.role) && (
              <>
                <TouchableOpacity
                  style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => {
                    setShowMenu(false);
                    activateEventManually();
                  }}
                >
                  <Ionicons name="flash" size={20} color={theme.colors.warning} />
                  <Text style={{ fontFamily: theme.fontFamily.semibold, marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Activate Manually</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
              </>
            )}

            {event?.status === "active" && (
              <>
                <TouchableOpacity
                  style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => {
                    setShowMenu(false);
                    closeEvent();
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                  <Text style={{ fontFamily: theme.fontFamily.semibold, marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Close Event</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
              </>
            )}

            {/* Shared Menu Items */}
            <TouchableOpacity
              style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
              onPress={() => {
                setShowMenu(false);
                exportCSV();
              }}
            >
              <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
              <Text style={{ fontFamily: theme.fontFamily.semibold, marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Export CSV</Text>
            </TouchableOpacity>
            <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
            <TouchableOpacity
              style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
              onPress={() => {
                setShowMenu(false);
                exportPDF();
              }}
            >
              <Ionicons name="document-outline" size={20} color={theme.colors.primary} />
              <Text style={{ fontFamily: theme.fontFamily.semibold, marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Export PDF</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Tab bar */}
      <View
        style={{
          flexDirection: "row",
          marginTop: rp(16),
          marginHorizontal: rp(16),
          gap: rp(6),
        }}
      >
        {(isClosed
          ? [
            ["cars", "Cars"],
            ["incidents", "Incidents"],
            ["feedback", "Feedback"],
            ["insights", "Insights"],
          ]
          : [
            ["cars", "Cars"],
            ["employees", "Team"],
            ["livequeue", "Queue"],
            ["insights", "Insights"],
            ["incidents", "Incidents"],
            ["feedback", "Feedback"],
          ]
        ).map(([k, l]) => (
          <TouchableOpacity
            key={k}
            onPress={() => setTab(k)}
            testID={`tab-${k}`}
            style={{
              flex: 1,
              paddingVertical: rp(8),
              paddingHorizontal: rp(4),
              borderRadius: rp(99),
              backgroundColor: tab === k ? theme.colors.primary : theme.colors.surface,
              borderWidth: rp(1),
              borderColor: tab === k ? theme.colors.primary : theme.colors.border,
              alignItems: "center",
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                fontFamily: theme.fontFamily.bold, fontWeight: "800",
                fontSize: rs(11),
                color: tab === k ? theme.colors.surface : theme.colors.textSecondary,
              }}
            >
              {l}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "cars" && (
        <ScrollView ref={scrollViewRef}
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: rp(16),
              paddingHorizontal: rp(14),
              flexDirection: "row",
              alignItems: "center",
              marginBottom: rp(12),
              borderWidth: rp(1),
              borderColor: theme.colors.border,
            }}
          >
            <Ionicons name="search" size={18} color={theme.colors.primary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search plate..."
              placeholderTextColor={theme.colors.textMuted}
              style={{ fontFamily: theme.fontFamily.regular, flex: 1, paddingVertical: rp(12), marginLeft: rp(8), color: theme.colors.textPrimary }}
              testID="car-search"
            />
          </View>
          <ScrollView ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: rp(8), paddingBottom: rp(8) }}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setStatusFilter(f)}
                style={{
                  paddingHorizontal: rp(14),
                  paddingVertical: rp(8),
                  borderRadius: rp(99),
                  backgroundColor: statusFilter === f ? theme.colors.primary : theme.colors.surface,
                  borderWidth: rp(1),
                  borderColor: statusFilter === f ? theme.colors.primary : theme.colors.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.fontFamily.bold, fontSize: rs(11),
                    fontWeight: "800",
                    color: statusFilter === f ? theme.colors.surface : theme.colors.textSecondary,
                    letterSpacing: rs(1),
                  }}
                >
                  {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label || f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={{ fontFamily: theme.fontFamily.semibold, color: theme.colors.textSecondary, fontSize: rs(11), marginVertical: rp(8), fontWeight: "600" }}>
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
                  backgroundColor: theme.colors.surface,
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
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "900", color: theme.colors.textPrimary, fontSize: rs(18) }}>{car.plate}</Text>
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(12), marginTop: rp(2) }}>{car.color} {car.make}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6), flexWrap: "wrap", gap: rp(6) }}>
                    {car.zone && car.slot && (
                      <View style={{ backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                        <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textPrimary, fontSize: rs(10), fontWeight: "700" }}>
                          {car.zone}-{car.slot}
                        </Text>
                      </View>
                    )}
                    {car.carried_forward && (
                      <View style={{ backgroundColor: theme.colors.warningLight, paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99), borderWidth: 1, borderColor: theme.colors.warningLight }}>
                        <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.warning, fontSize: rs(9), fontWeight: "800", letterSpacing: rs(0.5) }}>
                          OVERNIGHT
                        </Text>
                      </View>
                    )}
                    <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(11) }}>
                      {car.check_in_time
                        ? (car.carried_forward
                          ? new Date(car.check_in_time).toLocaleString("en-IN", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                          : new Date(car.check_in_time).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }))
                        : "Just now"}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(99), backgroundColor: cfg.color }}>
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "800", fontSize: rs(10), letterSpacing: rs(0.5) }}>{cfg.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} style={{ marginTop: rp(8) }} />
                </View>
              </TouchableOpacity>
            );
          })}
          {filteredCars.length === 0 && (
            <View style={{ alignItems: "center", marginTop: rp(40) }}>
              <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(48) }}>🚗</Text>
              <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, marginTop: rp(8), fontWeight: "700" }}>No cars yet</Text>
            </View>
          )}
          <View style={{ height: rp(40) }} />
        </ScrollView>
      )}

      {tab === "livequeue" && (
        <View style={{ paddingHorizontal: rp(16), paddingTop: rp(16) }}>
          <TouchableOpacity
            onPress={handleShareLiveQueue}
            disabled={sharingQueue}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.accent, borderRadius: rp(16), paddingVertical: rp(14), marginBottom: rp(16) }}
          >
            <Ionicons name="share-social-outline" size={18} color={theme.colors.surface} />
            <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900", letterSpacing: rs(1), marginLeft: rp(8) }}>
              {sharingQueue ? "PREPARING LINK..." : "SHARE LIVE QUEUE LINK"}
            </Text>
          </TouchableOpacity>

          {queueRows.length === 0 ? (
            <Text style={{ fontFamily: theme.fontFamily.regular, textAlign: "center", color: theme.colors.textSecondary, paddingVertical: rp(32) }}>
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
                    <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "900", color: theme.colors.textPrimary, fontSize: rs(16) }}>{car.plate}</Text>
                    <View style={{ backgroundColor: cfg.color + "20", paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8) }}>
                      <Text style={{ fontFamily: theme.fontFamily.bold, color: cfg.color, fontSize: rs(10), fontWeight: "800" }}>{cfg.label}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(12), marginTop: rp(4) }}>
                    {car.guest_name || "—"} · Driver: {car.driverName}
                  </Text>
                  {car.minutesInStatus != null && (
                    <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(11), marginTop: rp(4) }}>
                      {car.minutesInStatus} min in current status
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {tab === "incidents" && (
        <ScrollView ref={scrollViewRef}
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
        >
          {incidents.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: rp(60) }}>
              <View style={{ backgroundColor: theme.colors.successLight, width: rp(80), height: rp(80), borderRadius: rp(40), alignItems: "center", justifyContent: "center", marginBottom: rp(16) }}>
                <Ionicons name="checkmark" size={40} color={theme.colors.success} />
              </View>
              <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textPrimary, fontWeight: "900", fontSize: rs(18) }}>No incidents reported</Text>
              <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, marginTop: rp(4) }}>Everything is running smoothly</Text>
            </View>
          ) : (
            incidents.map((i) => (
              <View key={i.id} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(24), padding: rp(18), marginBottom: rp(12), ...cardShadow }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flexDirection: "column", gap: rp(4) }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8) }}>
                      <View style={{ backgroundColor: theme.colors.textPrimary, paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(8) }}>
                        <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900", fontSize: rs(14) }}>{i.plate}</Text>
                      </View>
                      <View style={{ paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(6), backgroundColor: i.status === "OPEN" ? theme.colors.dangerLight : i.status === "IN_REVIEW" ? theme.colors.warningLight : i.status === "RESOLVED" ? theme.colors.successLight : theme.colors.surfaceAlt }}>
                        <Text style={{ fontFamily: theme.fontFamily.bold, color: i.status === "OPEN" ? theme.colors.danger : i.status === "IN_REVIEW" ? theme.colors.warning : i.status === "RESOLVED" ? theme.colors.success : theme.colors.textSecondary, fontSize: rs(10), fontWeight: "800" }}>{i.status}</Text>
                      </View>
                    </View>
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, fontSize: rs(11), fontWeight: "700" }}>{(i.incident_type || "UNKNOWN").replace(/_/g, " ").replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase())}</Text>
                  </View>
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(11) }}>
                    {new Date(i.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: 'Asia/Kolkata' })}
                  </Text>
                </View>

                <View style={{ marginTop: rp(12) }}>
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textPrimary, fontSize: rs(14), lineHeight: 20 }}>{i.description}</Text>
                </View>

                {(i.status === "RESOLVED" || i.status === "DISMISSED") && i.remark && (
                  <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(12), padding: rp(12), marginTop: rp(12) }}>
                    <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textPrimary, fontSize: rs(13), lineHeight: 18 }}>{i.remark}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6) }}>
                      <Ionicons name="checkmark-done-circle" size={14} color={theme.colors.textSecondary} />
                      <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(11), marginLeft: rp(4) }}>
                        Resolved by {i.resolved_by || "Unknown"} on {i.resolved_at ? new Date(i.resolved_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: 'Asia/Kolkata' }) : "Unknown"}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: rp(12), paddingTop: rp(12), borderTopWidth: rp(1), borderTopColor: theme.colors.surfaceAlt }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="person-circle-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(12), marginLeft: rp(6) }}>
                      Reported by: <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "700" }}>{i.driver_name || "Unknown Driver"}</Text>
                    </Text>
                  </View>
                  {(i.status === "OPEN" || i.status === "IN_REVIEW") && (
                    <TouchableOpacity
                      onPress={() => { setResolvingIncident(i); setResolveStatus(i.status === "OPEN" ? "IN_REVIEW" : i.status); setResolveRemark(""); setShowResolveModal(true); }}
                      style={{ backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(10), paddingVertical: rp(6), borderRadius: rp(12) }}
                    >
                      <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textPrimary, fontWeight: "700", fontSize: rs(12) }}>Update Status</Text>
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

      {tab === "employees" && !isClosed && (
        <ScrollView ref={scrollViewRef}
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
        >
          {/* Internal tab toggle bar */}
          <View
            style={{
              flexDirection: "row",
              marginBottom: rp(16),
              gap: rp(6),
            }}
          >
            <TouchableOpacity
              onPress={() => setEmployeeTab("supervisors")}
              style={{
                flex: 1,
                paddingVertical: rp(8),
                paddingHorizontal: rp(4),
                borderRadius: rp(99),
                backgroundColor: employeeTab === "supervisors" ? theme.colors.primary : theme.colors.surface,
                borderWidth: rp(1),
                borderColor: employeeTab === "supervisors" ? theme.colors.primary : theme.colors.border,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: rp(6),
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fontFamily.bold, fontWeight: "800",
                  fontSize: rs(11),
                  color: employeeTab === "supervisors" ? theme.colors.surface : theme.colors.textSecondary,
                }}
              >
                Supervisors
              </Text>
              <View style={{ backgroundColor: employeeTab === "supervisors" ? "rgba(255,255,255,0.2)" : theme.colors.primaryLight, paddingHorizontal: rp(6), paddingVertical: rp(1), borderRadius: rp(99) }}>
                <Text style={{ fontFamily: theme.fontFamily.bold, color: employeeTab === "supervisors" ? theme.colors.surface : theme.colors.primary, fontWeight: "800", fontSize: rs(10) }}>{supervisors.filter(s => s.assigned).length}/{supervisors.length}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setEmployeeTab("drivers")}
              style={{
                flex: 1,
                paddingVertical: rp(8),
                paddingHorizontal: rp(4),
                borderRadius: rp(99),
                backgroundColor: employeeTab === "drivers" ? theme.colors.primary : theme.colors.surface,
                borderWidth: rp(1),
                borderColor: employeeTab === "drivers" ? theme.colors.primary : theme.colors.border,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: rp(6),
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fontFamily.bold, fontWeight: "800",
                  fontSize: rs(11),
                  color: employeeTab === "drivers" ? theme.colors.surface : theme.colors.textSecondary,
                }}
              >
                Drivers
              </Text>
              <View style={{ backgroundColor: employeeTab === "drivers" ? "rgba(255,255,255,0.2)" : theme.colors.primaryLight, paddingHorizontal: rp(6), paddingVertical: rp(1), borderRadius: rp(99) }}>
                <Text style={{ fontFamily: theme.fontFamily.bold, color: employeeTab === "drivers" ? theme.colors.surface : theme.colors.primary, fontWeight: "800", fontSize: rs(10) }}>{drivers.filter(d => d.assigned).length}/{drivers.length}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {employeeTab === "supervisors" && (
            <>
              {/* SUPERVISORS CONTENT */}

              {supervisors.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: rp(40) }}>
                  <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(48) }}>🛡️</Text>
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, marginTop: rp(8), fontWeight: "700" }}>No supervisors</Text>
                </View>
              )}

              {supervisors.map((s) => (
                <View
                  key={s.id}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: rp(24),
                    padding: rp(16),
                    marginBottom: rp(12),
                    ...cardShadow,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        backgroundColor: theme.colors.accent,
                        borderRadius: rp(99),
                        width: rp(48),
                        height: rp(48),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900", fontSize: rs(18) }}>
                        {s.name?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ flex: 1, marginLeft: rp(12) }}
                      onPress={() =>
                        router.push({
                          pathname: "/(admin)/(tabs)/supervisor-detail",
                          params: { supervisorId: s.id, supervisorName: s.name },
                        })
                      }
                    >
                      <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "900", color: theme.colors.textPrimary, fontSize: rs(15) }}>{s.name}</Text>
                      <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(12) }}>{s.email}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(4) }}>
                        <View
                          style={{
                            width: rp(8),
                            height: rp(8),
                            borderRadius: rp(99),
                            marginRight: rp(6),
                            backgroundColor: s.available ? theme.colors.success : theme.colors.danger,
                          }}
                        />
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(11), fontWeight: "700", color: s.available ? theme.colors.success : theme.colors.danger }}>
                          {s.available ? "Available" : `In ${s.conflict_event_name || "another event"}`}
                        </Text>
                        {s.is_verified === false && (
                          <View style={{ backgroundColor: theme.colors.warningLight, paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(4), marginLeft: rp(6) }}>
                            <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.warning, fontSize: rs(9), fontWeight: "bold" }}>UNVERIFIED</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>

                  {s.assigned || (s.available && s.is_verified !== false) ? (
                    <TouchableOpacity
                      onPress={() => toggleAssignSupervisor(s)}
                      disabled={assigningSupervisorId === s.id}
                      activeOpacity={0.7}
                      style={{
                        marginTop: rp(12),
                        borderRadius: rp(14),
                        paddingVertical: rp(12),
                        alignItems: "center",
                        backgroundColor: s.assigned ? "transparent" : theme.colors.accent,
                        borderWidth: s.assigned ? 1.5 : 0,
                        borderColor: theme.colors.danger,
                        opacity: assigningSupervisorId === s.id ? 0.7 : 1,
                      }}
                    >
                      {assigningSupervisorId === s.id ? (
                        <ActivityIndicator size="small" color={s.assigned ? theme.colors.danger : theme.colors.surface} />
                      ) : (
                        <Text
                          style={{
                            fontFamily: theme.fontFamily.bold, fontWeight: "900",
                            letterSpacing: rs(1.5),
                            color: s.assigned ? theme.colors.danger : theme.colors.surface,
                            fontSize: rs(13),
                          }}
                        >
                          {s.assigned ? "UNASSIGN" : "ASSIGN"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: rp(12), backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center" }}>
                      <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(11) }}>
                        {s.is_verified === false && !s.assigned ? "Unverified" : `In ${s.conflict_event_name || "another event"}`}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}

          {employeeTab === "drivers" && (
            <>
              {/* DRIVERS CONTENT */}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginBottom: rp(16), gap: rp(8) }}>
                <TouchableOpacity
                  onPress={assignAll}
                  disabled={assigningAll || drivers.filter(d => (d.available || d.assigned) && !d.assigned).length === 0}
                  style={{
                    backgroundColor: assigningAll ? theme.colors.primaryLight : theme.colors.primary,
                    borderRadius: rp(12),
                    paddingVertical: rp(7),
                    paddingHorizontal: rp(14),
                    flexDirection: "row",
                    alignItems: "center",
                    opacity: drivers.filter(d => (d.available || d.assigned) && !d.assigned).length === 0 ? 0.5 : 1,
                  }}
                >
                  {assigningAll ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={14} color={theme.colors.surface} />
                      <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900", fontSize: rs(12), marginLeft: rp(6), letterSpacing: rs(1) }}>ASSIGN ALL</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {drivers.length === 0 && (
                <View style={{ alignItems: "center", marginTop: rp(40) }}>
                  <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(48) }}>👥</Text>
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, marginTop: rp(8), fontWeight: "700" }}>No drivers</Text>
                </View>
              )}

              {drivers.map((d) => (
                <View
                  key={d.id}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: rp(24),
                    padding: rp(16),
                    marginBottom: rp(12),
                    ...cardShadow,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        backgroundColor: theme.colors.primary,
                        borderRadius: rp(99),
                        width: rp(48),
                        height: rp(48),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900", fontSize: rs(18) }}>
                        {d.name?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ flex: 1, marginLeft: rp(12) }}
                      onPress={() =>
                        router.push({
                          pathname: "/(admin)/(tabs)/driver-stats",
                          params: { driverId: d.id, driverName: d.name },
                        })
                      }
                    >
                      <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "900", color: theme.colors.textPrimary, fontSize: rs(15) }}>{d.name}</Text>
                      <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(12) }}>{d.employee_id}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(4) }}>
                        <View
                          style={{
                            width: rp(8),
                            height: rp(8),
                            borderRadius: rp(99),
                            marginRight: rp(6),
                            backgroundColor: d.available ? theme.colors.success : theme.colors.danger,
                          }}
                        />
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(11), fontWeight: "700", color: d.available ? theme.colors.success : theme.colors.danger }}>
                          {d.available ? "Available" : `In ${d.conflict_event_name || "another event"}`}
                        </Text>
                        {d.is_verified === false && (
                          <View style={{ backgroundColor: theme.colors.warningLight, paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(4), marginLeft: rp(6) }}>
                            <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.warning, fontSize: rs(9), fontWeight: "bold" }}>UNVERIFIED</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: "row", marginTop: rp(10), gap: rp(10) }}>
                    <View style={{ backgroundColor: theme.colors.successLight, paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                      <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.success, fontSize: rs(11), fontWeight: "700" }}>
                        Checked in: {d.cars_checked_in || 0}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: theme.colors.infoLight, paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                      <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.info, fontSize: rs(11), fontWeight: "700" }}>
                        Retrieved: {d.cars_retrieved || 0}
                      </Text>
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
                        backgroundColor: d.assigned ? "transparent" : theme.colors.primary,
                        borderWidth: d.assigned ? 1.5 : 0,
                        borderColor: theme.colors.danger,
                        opacity: assigningId === d.id ? 0.7 : 1,
                      }}
                    >
                      {assigningId === d.id ? (
                        <ActivityIndicator size="small" color={d.assigned ? theme.colors.danger : theme.colors.surface} />
                      ) : (
                        <Text
                          style={{
                            fontFamily: theme.fontFamily.bold, fontWeight: "900",
                            letterSpacing: rs(1.5),
                            color: d.assigned ? theme.colors.danger : theme.colors.surface,
                            fontSize: rs(13),
                          }}
                        >
                          {d.assigned ? "UNASSIGN" : "ASSIGN"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: rp(12), backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center" }}>
                      <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(11) }}>
                        {d.is_verified === false && !d.assigned ? "Unverified" : `In ${d.conflict_event_name || "another event"}`}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
          <View style={{ height: rp(40) }} />
        </ScrollView>
      )}

      {tab === "insights" && (
        <ScrollView ref={scrollViewRef}
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
        >
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
                      key={typeof z === "object" ? JSON.stringify(z) : z}
                      onPress={() => setSelectedZone(z)}
                      style={{
                        backgroundColor: selectedZone === z ? theme.colors.primary : theme.colors.surface,
                        borderRadius: rp(16),
                        paddingHorizontal: rp(16),
                        paddingVertical: rp(10),
                        marginRight: rp(10),
                        ...cardShadow,
                      }}
                    >
                      <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "800", fontSize: rs(13), color: selectedZone === z ? theme.colors.surface : theme.colors.textPrimary }}>
                        {typeof z === "object" ? z.zone_name || z.name || z.label || JSON.stringify(z) : `Zone ${z}`}
                      </Text>
                      <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(11), color: selectedZone === z ? "rgba(255,255,255,0.8)" : theme.colors.textMuted, marginTop: rp(2) }}>
                        {zOcc}/{zSlots.length} occupied
                      </Text>
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
                <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(3), marginBottom: rp(16) }}>ZONE {selectedZone} — SLOT MAP</Text>
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
                        borderColor: s.is_occupied ? theme.colors.dangerLight : theme.colors.successLight,
                      }}
                    >
                      <Ionicons name={s.is_occupied ? "car" : "car-outline"} size={16} color={s.is_occupied ? theme.colors.danger : theme.colors.success} />
                      <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(11), fontWeight: "800", color: s.is_occupied ? theme.colors.danger : theme.colors.success, marginTop: rp(2) }}>{s.slot_number}</Text>
                    </View>
                  ))}
                </View>
                {zoneSlots.length === 0 && (
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, textAlign: "center", paddingVertical: rp(24) }}>
                    No slots in this zone
                  </Text>
                )}
              </View>
            );
          })()}

          <TouchableOpacity onPress={fetchStats} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), paddingVertical: rp(10), alignItems: "center", marginBottom: rp(16), borderWidth: rp(1), borderColor: theme.colors.border }}>
            <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.primary, fontWeight: "800", letterSpacing: rs(1) }}>↻ Refresh Stats</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: rp(16) }}>
            {[
              { label: "CARS", value: stats?.total_cars ?? 0, color: theme.colors.primary, icon: "car" },
              { label: "PARKED", value: stats?.still_parked ?? 0, color: theme.colors.primary, icon: "location" },
              { label: "SLOTS", value: `${slots ? slots.filter(s => s.is_occupied).length : 0}/${slots ? slots.length : 0}`, color: theme.colors.primary, icon: "grid" },
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
                <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(20), fontWeight: "900", color: theme.colors.textPrimary }}>{s.value}</Text>
                <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(10), color: theme.colors.textSecondary, fontWeight: "800", marginTop: rp(2) }}>{s.label}</Text>
                {s.sub && <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(9), color: theme.colors.textMuted, marginTop: rp(1) }}>{s.sub}</Text>}
              </View>
            ))}
          </View>

          {/* {event?.event_type !== "hotel_daily" && (
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(24), padding: rp(24), marginBottom: rp(16), ...cardShadow }}>
              <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(16), fontWeight: "900", color: theme.colors.textPrimary, marginBottom: rp(16) }}>Event Host</Text>

              <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(10), fontWeight: "800", color: theme.colors.textMuted, marginBottom: rp(4), letterSpacing: rs(1) }}>HOST NAME</Text>
              <TextInput
                value={event?.host_name || ""}
                onChangeText={txt => setEvent(prev => ({ ...prev, host_name: txt }))}
                placeholder="e.g. John Doe"
                placeholderTextColor={theme.colors.textMuted}
                editable={!isClosed}
                style={{ backgroundColor: isClosed ? theme.colors.surfaceAlt : theme.colors.surfaceAlt, borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(12), padding: rp(12), color: isClosed ? theme.colors.textMuted : theme.colors.textPrimary, marginBottom: rp(16) }}
              />

              <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(10), fontWeight: "800", color: theme.colors.textMuted, marginBottom: rp(4), letterSpacing: rs(1) }}>HOST EMAIL</Text>
              <View style={{ flexDirection: "row", gap: rp(8) }}>
                <TextInput
                  value={event?.host_email || ""}
                  onChangeText={txt => setEvent(prev => ({ ...prev, host_email: txt }))}
                  placeholder="john@example.com"
                  placeholderTextColor={theme.colors.textMuted}
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
                        fetchEvent();
                      } catch (err) {
                        confirmDialog.info("Couldn't update host", "Something went wrong updating the host. Check your connection and try again.");
                      }
                    }}
                    style={{ backgroundColor: theme.colors.primary, paddingHorizontal: rp(16), justifyContent: "center", borderRadius: rp(12) }}
                  >
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "800", fontSize: rs(12) }}>
                      {event?.host_email_sent ? "Resend Portal" : "Send Portal"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {isClosed && (
                <Text style={{ fontFamily: theme.fontFamily.semibold, color: theme.colors.danger, fontSize: rs(11), marginTop: rp(8), fontWeight: "600" }}>
                  Cannot send portal email — event is closed
                </Text>
              )}

              {event?.host_email_sent && (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(12), gap: rp(6) }}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(12), fontWeight: "800", color: theme.colors.success }}>Portal email sent</Text>
                </View>
              )}
            </View>
          )} */}

          <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(24), padding: rp(24), marginBottom: rp(16), ...cardShadow }}>
            <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(16), fontWeight: "900", color: theme.colors.textPrimary, marginBottom: rp(4) }}>Send Report by Email</Text>
            <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(12), color: theme.colors.textSecondary, marginBottom: rp(16) }}>
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
                style={{ fontFamily: theme.fontFamily.regular, flex: 1, backgroundColor: theme.colors.surfaceAlt, borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(12), padding: rp(12), color: theme.colors.textPrimary }}
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
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "800", fontSize: rs(12) }}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: rp(40) }} />
        </ScrollView>
      )}

      {tab === "feedback" && (
        <View style={{ flex: 1, paddingBottom: rp(100) }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rp(16) }}>
            <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(16), fontWeight: "900", color: theme.colors.textPrimary, letterSpacing: rs(1) }}>GUEST FEEDBACK</Text>
            {loadingFeedback && <ActivityIndicator size="small" color={theme.colors.primary} />}
          </View>
          {!loadingFeedback && feedback.length === 0 ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: rp(60), backgroundColor: theme.colors.surface, borderRadius: rp(16), ...cardShadow }}>
              <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.border} />
              <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(14), fontWeight: "800", color: theme.colors.textSecondary, marginTop: rp(12) }}>NO FEEDBACK YET</Text>
            </View>
          ) : (
            feedback.map(item => (
              <View key={item.id} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), padding: rp(16), marginBottom: rp(12), ...cardShadow }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: rp(8) }}>
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(4) }}>
                      <Text style={{ fontFamily: theme.fontFamily.bold, backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(4), fontSize: rs(10), fontWeight: "900", color: theme.colors.textSecondary, marginRight: rp(8) }}>{item.plate}</Text>
                      <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(14), fontWeight: "800", color: theme.colors.textPrimary }}>{item.guest_name}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Ionicons key={star} name="star" size={12} color={star <= item.stars ? theme.colors.warning : theme.colors.border} />
                      ))}
                      <Text style={{ fontFamily: theme.fontFamily.semibold, fontSize: rs(10), color: theme.colors.textMuted, fontWeight: "600", marginLeft: rp(8) }}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  {item.driver_name && (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(9), fontWeight: "800", color: theme.colors.textMuted, letterSpacing: rs(1) }}>DRIVER</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(6), marginTop: rp(2) }}>
                        <Ionicons name="car-outline" size={12} color={theme.colors.textSecondary} style={{ marginRight: rp(4) }} />
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(11), fontWeight: "700", color: theme.colors.textSecondary }}>{item.driver_name}</Text>
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
                          <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(11), color: theme.colors.textSecondary, flex: 1, marginRight: rp(8) }}>{q.label}</Text>
                          <Text style={{
                            fontFamily: theme.fontFamily.bold, backgroundColor: answer ? theme.colors.dangerLight : theme.colors.successLight,
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
                    <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(12), color: theme.colors.textSecondary, fontStyle: "italic", fontWeight: "500" }}>"{item.comment}"</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      )}



      {/* {showSpecialEventQRModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 }}> setShowSpecialEventQRModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            padding: rp(24),
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: rp(32),
              padding: rp(32),
              alignItems: "center",
              width: "100%",
              shadowColor: theme.colors.textPrimary,
              shadowOpacity: 0.2,
              shadowRadius: rp(24),
              shadowOffset: { width: 0, height: rp(12) },
              elevation: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                marginBottom: rp(20),
              }}
            >
              <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(11), fontWeight: "800", color: theme.colors.accent, letterSpacing: rs(3) }}>
                {event?.event_type === "hotel_daily" ? "HOTEL DAILY VALET QR" : event?.event_type === "hotel_special" ? "SPECIAL EVENT GUEST QR" : "EVENT GUEST QR"}
              </Text>
              <TouchableOpacity onPress={() => setShowSpecialEventQRModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text
              style={{
                fontFamily: theme.fontFamily.bold, fontSize: rs(22),
                fontWeight: "900",
                color: theme.colors.textPrimary,
                textAlign: "center",
              }}
            >
              {event?.name}
            </Text>
            {specialEventHotel?.name ? (
              <Text
                style={{
                  fontFamily: theme.fontFamily.bold, fontSize: rs(14),
                  fontWeight: "700",
                  color: theme.colors.textSecondary,
                  textAlign: "center",
                  marginTop: rp(4),
                  marginBottom: rp(24),
                }}
              >
                {specialEventHotel.name}
              </Text>
            ) : (
              <View style={{ marginBottom: rp(24) }} />
            )}

            <View
              style={{
                padding: rp(14),
                backgroundColor: theme.colors.surfaceAlt,
                borderRadius: rp(20),
                marginBottom: rp(20),
              }}
            >
              {event?.event_type === "hotel_daily" ? (
                specialEventHotel?.hotel_qr_token ? (
                  <QRCode
                    value={`${process.env.EXPO_PUBLIC_GUEST_URL}/hotel-register/${specialEventHotel.hotel_qr_token}`}
                    size={220}
                    color={theme.colors.accent}
                  />
                ) : (
                  <View style={{ width: rp(220), height: rp(220), justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator color={theme.colors.accent} size="large" />
                  </View>
                )
              ) : specialEventQRToken ? (
                <QRCode
                  value={`${process.env.EXPO_PUBLIC_GUEST_URL}/pre-register/event/${specialEventQRToken}`}
                  size={220}
                  color={theme.colors.accent}
                />
              ) : (
                <View style={{ width: rp(220), height: rp(220), justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator color={theme.colors.accent} size="large" />
                </View>
              )}
            </View>

            <Text
              style={{
                fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted,
                fontSize: rs(11),
                marginTop: rp(0),
                marginBottom: rp(24),
                textAlign: "center",
              }}
            >
              {event?.event_type === "hotel_daily" ? "Guests scan this to pre-register for today's valet" : "Guest scans this to pre-register their vehicle"}
            </Text>

            <TouchableOpacity
              onPress={() => {
                const url = event?.event_type === "hotel_daily"
                  ? `${process.env.EXPO_PUBLIC_GUEST_URL}/hotel-register/${specialEventHotel?.hotel_qr_token}`
                  : `${process.env.EXPO_PUBLIC_GUEST_URL}/pre-register/event/${specialEventQRToken}`;
                Share.share({
                  message: `Pre-register for ${event?.name} at ${specialEventHotel?.name}: ${url}`,
                });
              }}
              style={{
                backgroundColor: theme.colors.accent,
                borderRadius: rp(16),
                paddingVertical: rp(14),
                width: "100%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: rp(8),
              }}
            >
              <Ionicons name="share-outline" size={20} color={theme.colors.surface} />
              <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900", letterSpacing: rs(2) }}>SHARE LINK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowSpecialEventQRModal(false)}
              style={{ paddingVertical: rp(12), marginTop: rp(8), alignItems: "center", width: "100%" }}
            >
              <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      )} */}

      {showCarModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 }}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
              <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: rp(20), paddingBottom: rp(20) + (insets?.bottom || 0), maxHeight: "85%" }}>
                <View style={{ alignItems: "center", marginBottom: rp(12) }}>
                  <View style={{ backgroundColor: theme.colors.border, width: rp(48), height: rp(4), borderRadius: rp(99) }} />
                </View>
                <ScrollView ref={scrollViewRef}>
                  {selectedCar && (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(28), fontWeight: "900", color: theme.colors.primary }}>{selectedCar.plate}</Text>
                          <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, marginTop: rp(4) }}>{selectedCar.color} {selectedCar.make}</Text>
                          <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(13), marginTop: rp(4) }}>
                            {selectedCar.zone ? `Zone ${selectedCar.zone} · Slot ${selectedCar.slot}` : "Not parked"}
                          </Text>
                        </View>
                        <View style={{ paddingHorizontal: rp(12), paddingVertical: rp(4), borderRadius: rp(99), backgroundColor: STATUS_CONFIG[selectedCar.status]?.color }}>
                          <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "800", fontSize: rs(11) }}>
                            {STATUS_CONFIG[selectedCar.status]?.label}
                          </Text>
                        </View>
                      </View>
                      {selectedCar.notes ? (
                        <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, marginTop: rp(12), fontStyle: "italic" }}>"{selectedCar.notes}"</Text>
                      ) : null}

                      <Text style={[modalLabel, { fontFamily: theme.fontFamily.regular, marginTop: rp(16) }]}>CHECK-IN PHOTOS</Text>
                      {carPhotos.filter((p) => p.type === "checkin").length === 0 ? (
                        <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(13) }}>No photos available</Text>
                      ) : (
                        <ScrollView ref={scrollViewRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(8) }}>
                          {carPhotos.filter((p) => p.type === "checkin").map((p, i) => (
                            <Image key={i} source={{ uri: p.url }} style={{ width: rp(120), height: rp(120), borderRadius: rp(14) }} />
                          ))}
                        </ScrollView>
                      )}

                      {carPhotos.find((p) => p.type === "handover") && (
                        <>
                          <Text style={[modalLabel, { fontFamily: theme.fontFamily.regular, marginTop: rp(16) }]}>HANDOVER PHOTO</Text>
                          <Image
                            source={{ uri: carPhotos.find((p) => p.type === "handover").url }}
                            style={{ width: "100%", height: rp(200), borderRadius: rp(14) }}
                          />
                        </>
                      )}

                      {["CHECKED_IN", "RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED"].includes(selectedCar.status) && !showAssignPicker && (
                        <TouchableOpacity
                          onPress={openAssignPicker}
                          style={{ backgroundColor: theme.colors.accent, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(20), flexDirection: "row", justifyContent: "center" }}
                        >
                          <Ionicons name="person-add-outline" size={18} color={theme.colors.surface} />
                          <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>
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
                              <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.success, fontWeight: "800", fontSize: rs(12) }}>Suggested: {assignSuggestion.name}</Text>
                            </View>
                          )}
                          {drivers.filter(d => d.assigned).length === 0 ? (
                            <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(13), textAlign: "center", paddingVertical: rp(12) }}>No drivers rostered on this event</Text>
                          ) : (
                            drivers.filter(d => d.assigned).map(d => (
                              <TouchableOpacity
                                key={d.id}
                                disabled={assigningDriver}
                                onPress={() => handleAssignDriver(d.id, d.duty_status === "busy", d.current_car_plate, d.name)}
                                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: rp(12), borderBottomWidth: rp(1), borderBottomColor: theme.colors.border }}
                              >
                                <View>
                                  <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "700", color: theme.colors.textPrimary }}>{d.name}</Text>
                                  {d.duty_status === "busy" && d.current_car_plate && (
                                    <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(11) }}>Busy with {d.current_car_plate}</Text>
                                  )}
                                </View>
                                {assignSuggestion?.id === d.id && <Ionicons name="star" size={14} color={theme.colors.success} />}
                              </TouchableOpacity>
                            ))
                          )}
                          <TouchableOpacity onPress={() => setShowAssignPicker(false)} style={{ paddingVertical: rp(10), alignItems: "center" }}>
                            <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, fontWeight: "700" }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <TouchableOpacity
                        onPress={() => {
                          setShowCarModal(false);
                          router.push({
                            pathname: "/(admin)/(tabs)/car-log",
                            params: { car_id: selectedCar.id }
                          });
                        }}
                        style={{
                          backgroundColor: theme.colors.textPrimary, borderRadius: rp(16),
                          paddingVertical: rp(14), alignItems: "center",
                          marginTop: rp(12), flexDirection: "row",
                          justifyContent: "center"
                        }}
                      >
                        <Ionicons name="time-outline" size={18} color={theme.colors.surface} />
                        <Text style={{
                          fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900",
                          letterSpacing: rs(2), marginLeft: rp(8)
                        }}>VIEW FULL LOG</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setShowCarModal(false);
                          router.push({ pathname: "/(admin)/(tabs)/qr-display", params: { token: selectedCar.qr_token, plate: selectedCar.plate } });
                        }}
                        style={{ backgroundColor: theme.colors.primary, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(20) }}
                      >
                        <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900", letterSpacing: rs(2) }}>VIEW QR</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeCar(selectedCar)}
                        style={{ borderWidth: rp(1.5), borderColor: theme.colors.danger, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(8), marginBottom: rp(16) }}
                      >
                        <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.danger, fontWeight: "900", letterSpacing: rs(2) }}>REMOVE VEHICLE</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowCarModal(false)} style={{ paddingVertical: rp(10), alignItems: "center", marginBottom: rp(12) }}>
                        <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, fontWeight: "700" }}>Close</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}





      {showIncidentModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 }}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
              <View style={{
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: 36, borderTopRightRadius: 36,
                padding: rp(20), maxHeight: "92%"
              }}>

                {/* Handle */}
                <View style={{ alignItems: "center", marginBottom: rp(14) }}>
                  <View style={{
                    backgroundColor: theme.colors.border, width: rp(48),
                    height: rp(4), borderRadius: rp(99)
                  }} />
                </View>

                {/* Header */}
                <View style={{
                  flexDirection: "row", alignItems: "center",
                  marginBottom: rp(16)
                }}>
                  <View style={{
                    backgroundColor: theme.colors.warningLight,
                    borderRadius: rp(99), padding: rp(8), marginRight: rp(10)
                  }}>
                    <Ionicons name="warning" size={20} color={theme.colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontFamily: theme.fontFamily.bold, fontSize: rs(18), fontWeight: "900",
                      color: theme.colors.textPrimary
                    }}>Report Incident</Text>
                    <Text style={{
                      fontFamily: theme.fontFamily.regular, fontSize: rs(12), color: theme.colors.textMuted,
                      marginTop: rp(2)
                    }}>
                      {event?.name || "Current Event"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowIncidentModal(false)}
                  >
                    <Ionicons name="close-circle" size={26}
                      color={theme.colors.border} />
                  </TouchableOpacity>
                </View>

                <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>

                  {/* Car search */}
                  <Text style={{
                    fontFamily: theme.fontFamily.bold, fontSize: rs(11), fontWeight: "800",
                    color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8)
                  }}>
                    SELECT CAR *
                  </Text>
                  {!incidentCar ? (
                    <>
                      <View style={{
                        backgroundColor: theme.colors.surfaceAlt,
                        borderRadius: rp(14), borderWidth: rp(1),
                        borderColor: theme.colors.border, flexDirection: "row",
                        alignItems: "center", paddingHorizontal: rp(12),
                        marginBottom: rp(6)
                      }}>
                        <Ionicons name="search" size={16} color={theme.colors.primary} />
                        <TextInput
                          value={incidentCarSearch}
                          onChangeText={setIncidentCarSearch}
                          placeholder="Search plate number..."
                          placeholderTextColor={theme.colors.textMuted}
                          autoCapitalize="characters"
                          style={{
                            fontFamily: theme.fontFamily.bold, flex: 1, paddingVertical: rp(13),
                            paddingLeft: rp(8), color: theme.colors.textPrimary, fontWeight: "700"
                          }}
                        />
                        {incidentCarSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setIncidentCarSearch("")}>
                            <Ionicons name="close-circle" size={18} color={theme.colors.border} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {incidentCarSearch.length > 1 && (
                        <View style={{
                          backgroundColor: theme.colors.surface,
                          borderRadius: rp(14), borderWidth: rp(1),
                          borderColor: theme.colors.border, marginBottom: rp(12),
                          overflow: "hidden"
                        }}>
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
                                style={{
                                  padding: rp(14), borderBottomWidth: rp(1),
                                  borderBottomColor: theme.colors.surfaceAlt,
                                  flexDirection: "row",
                                  alignItems: "center"
                                }}
                              >
                                <View style={{
                                  backgroundColor: theme.colors.surfaceAlt,
                                  borderRadius: rp(8), padding: rp(6),
                                  marginRight: rp(10)
                                }}>
                                  <Ionicons name="car-outline" size={16}
                                    color={theme.colors.textPrimary} />
                                </View>
                                <View>
                                  <Text style={{
                                    fontFamily: theme.fontFamily.bold, fontWeight: "900",
                                    color: theme.colors.textPrimary
                                  }}>{c.plate}</Text>
                                  <Text style={{
                                    fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary,
                                    fontSize: rs(12)
                                  }}>
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
                              <View style={{ padding: rp(16), alignItems: "center" }}>
                                <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(13) }}>
                                  No cars found
                                </Text>
                              </View>
                            )}
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={{
                      backgroundColor: theme.colors.successLight,
                      borderRadius: rp(12), padding: rp(12), marginBottom: rp(16),
                      flexDirection: "row", alignItems: "center"
                    }}>
                      <Ionicons name="checkmark-circle" size={18}
                        color={theme.colors.success} />
                      <Text style={{
                        fontFamily: theme.fontFamily.bold, color: theme.colors.success, fontWeight: "800",
                        marginLeft: rp(8), flex: 1
                      }}>
                        {incidentCar.plate} · {incidentCar.color} {incidentCar.make}
                      </Text>
                      <TouchableOpacity onPress={() => {
                        setIncidentCar(null);
                        setIncidentType(""); setIncidentCarSearch("");
                      }}>
                        <Ionicons name="close-circle" size={20} color={theme.colors.success} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Driver select */}
                  <Text style={{
                    fontFamily: theme.fontFamily.bold, fontSize: rs(11), fontWeight: "800",
                    color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8)
                  }}>
                    DRIVER INVOLVED (OPTIONAL)
                  </Text>
                  <ScrollView ref={scrollViewRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: rp(8), marginBottom: rp(16) }}
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
                          paddingHorizontal: rp(14),
                          paddingVertical: rp(10),
                          borderRadius: rp(99),
                          borderWidth: rp(1.5),
                          backgroundColor:
                            (incidentDriver?.id ?? null) === d.id
                              ? theme.colors.primary : theme.colors.surface,
                          borderColor:
                            (incidentDriver?.id ?? null) === d.id
                              ? theme.colors.primary : theme.colors.border,
                        }}
                      >
                        <Text style={{
                          fontFamily: theme.fontFamily.bold, fontWeight: "800",
                          fontSize: rs(13),
                          color:
                            (incidentDriver?.id ?? null) === d.id
                              ? theme.colors.surface : theme.colors.textPrimary,
                        }}>
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Incident Type Picker */}
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8) }}>
                    INCIDENT TYPE *
                  </Text>
                  <ScrollView ref={scrollViewRef} horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: rp(16) }}>
                    <View style={{ flexDirection: "row", gap: rp(8), paddingRight: rp(16) }}>
                      {INCIDENT_TYPES.map(t => (
                        <TouchableOpacity
                          key={t.key}
                          onPress={() => setIncidentType(t.key)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: rp(4),
                            paddingHorizontal: rp(12),
                            paddingVertical: rp(8),
                            borderRadius: rp(20),
                            borderWidth: 1.5,
                            borderColor: incidentType === t.key ? theme.colors.primary : theme.colors.border,
                            backgroundColor: incidentType === t.key ? theme.colors.primary : theme.colors.surfaceAlt,
                          }}
                        >
                          <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(14) }}>{t.icon}</Text>
                          <Text style={{
                            fontFamily: theme.fontFamily.bold, fontSize: rs(11),
                            fontWeight: "700",
                            color: incidentType === t.key ? theme.colors.surface : theme.colors.textSecondary,
                          }}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Description */}
                  <Text style={{
                    fontFamily: theme.fontFamily.bold, fontSize: rs(11), fontWeight: "800",
                    color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8)
                  }}>
                    DESCRIPTION *
                  </Text>
                  <TextInput
                    value={incidentDesc}
                    onChangeText={setIncidentDesc}
                    placeholder="Describe what happened..."
                    placeholderTextColor={theme.colors.textMuted}
                    multiline
                    numberOfLines={4}
                    style={{
                      fontFamily: theme.fontFamily.regular, backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(14),
                      borderWidth: rp(1), borderColor: theme.colors.border, padding: rp(14),
                      color: theme.colors.textPrimary, textAlignVertical: "top",
                      minHeight: 110, marginBottom: rp(16), fontSize: rs(14),
                      lineHeight: 22
                    }}
                  />

                  {/* Photo */}
                  <TouchableOpacity
                    onPress={pickIncidentPhoto}
                    style={{
                      borderWidth: rp(1.5),
                      borderColor: incidentPhoto ? theme.colors.success : theme.colors.border,
                      borderStyle: incidentPhoto ? "solid" : "dashed",
                      borderRadius: rp(14), padding: rp(16), alignItems: "center",
                      marginBottom: rp(20),
                      backgroundColor: incidentPhoto
                        ? theme.colors.successLight : theme.colors.surfaceAlt
                    }}
                  >
                    <Ionicons
                      name={incidentPhoto
                        ? "checkmark-circle" : "camera-outline"}
                      size={26}
                      color={incidentPhoto ? theme.colors.success : theme.colors.textMuted}
                    />
                    <Text style={{
                      fontFamily: theme.fontFamily.bold, color: incidentPhoto ? theme.colors.success : theme.colors.textMuted,
                      marginTop: rp(6), fontWeight: "700", fontSize: rs(13)
                    }}>
                      {incidentPhoto
                        ? "Photo Added ✓ (tap to retake)"
                        : "Add Photo (Optional)"}
                    </Text>
                    {incidentPhoto && (
                      <TouchableOpacity onPress={() => setIncidentPhoto(null)} style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}>
                        <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>

                  {/* Submit */}
                  <TouchableOpacity
                    onPress={submitIncident}
                    disabled={submittingIncident}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor:
                        submittingIncident ? theme.colors.border : theme.colors.warning,
                      borderRadius: rp(18), paddingVertical: rp(18),
                      alignItems: "center", marginBottom: rp(24),
                      shadowColor: theme.colors.warning, shadowOpacity: 0.35,
                      shadowRadius: rp(12),
                      shadowOffset: { width: 0, height: rp(6) },
                      elevation: 6
                    }}
                  >
                    {submittingIncident ? (
                      <ActivityIndicator color={theme.colors.surface} />
                    ) : (
                      <Text style={{
                        fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900",
                        letterSpacing: rs(2), fontSize: rs(14)
                      }}>
                        SUBMIT INCIDENT REPORT
                      </Text>
                    )}
                  </TouchableOpacity>

                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* RESOLVE INCIDENT MODAL */}
      {showResolveModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), maxHeight: "92%", paddingBottom: (insets?.bottom || 0) }}>
                <View style={{ alignItems: "center", marginBottom: rp(14) }}>
                  <View style={{ backgroundColor: theme.colors.border, width: rp(48), height: rp(4), borderRadius: rp(99) }} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(16), paddingHorizontal: rp(20) }}>
                  <View style={{ backgroundColor: theme.colors.infoLight, borderRadius: rp(99), padding: rp(8), marginRight: rp(10) }}>
                    <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
                  </View>
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(18), fontWeight: "900", color: theme.colors.textPrimary, flex: 1 }}>Update Status</Text>
                  <TouchableOpacity onPress={() => setShowResolveModal(false)}>
                    <Ionicons name="close-circle" size={26} color={theme.colors.border} />
                  </TouchableOpacity>
                </View>
                <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: rp(20), paddingBottom: rp(32) }}>
                  <Text style={modalLabel}>STATUS</Text>
                  <View style={{ flexDirection: "row", gap: rp(8), marginBottom: rp(16), flexWrap: "wrap" }}>
                    {["IN_REVIEW", "RESOLVED", "DISMISSED"].map(statusVal => (
                      <TouchableOpacity
                        key={statusVal}
                        onPress={() => setResolveStatus(statusVal)}
                        style={{
                          paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(12), borderWidth: rp(1),
                          backgroundColor: resolveStatus === statusVal ? theme.colors.primary : theme.colors.surface,
                          borderColor: resolveStatus === statusVal ? theme.colors.primary : theme.colors.border
                        }}
                      >
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "800", fontSize: rs(13), color: resolveStatus === statusVal ? theme.colors.surface : theme.colors.textPrimary }}>
                          {statusVal === "IN_REVIEW" ? "Mark In Review" : statusVal === "RESOLVED" ? "Resolve" : "Dismiss"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={modalLabel}>HOW WAS THIS RESOLVED?</Text>
                  <TextInput
                    value={resolveRemark}
                    onChangeText={setResolveRemark}
                    placeholder="Details about the resolution..."
                    multiline
                    style={[modalInput, { fontFamily: theme.fontFamily.regular, minHeight: rp(100), textAlignVertical: "top" }]}
                  />
                  <TouchableOpacity
                    onPress={submitResolve}
                    disabled={submittingResolve}
                    style={{
                      backgroundColor: theme.colors.primary,
                      paddingVertical: rp(16),
                      borderRadius: rp(16),
                      alignItems: "center",
                      marginTop: rp(8)
                    }}
                  >
                    {submittingResolve ? <ActivityIndicator color={theme.colors.surface} /> : <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: "900", fontSize: rs(14), letterSpacing: rs(1) }}>UPDATE INCIDENT</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      )}
    </View>
  );
}

const iconBtn = {
  backgroundColor: "rgba(255,255,255,0.15)",
  borderRadius: rp(99),
  padding: rp(8),
};

const modalLabel = {
  fontFamily: theme.fontFamily.bold, fontSize: rs(11),
  fontWeight: "800",
  color: theme.colors.textSecondary,
  letterSpacing: rs(3),
  marginBottom: rp(8),
};

const modalInputError = { borderColor: theme.colors.danger };
const modalErrorText = { fontFamily: theme.fontFamily.semibold, color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) };
const modalInput = {
  fontFamily: theme.fontFamily.bold, backgroundColor: theme.colors.surfaceAlt,
  borderRadius: rp(14),
  borderWidth: rp(1),
  borderColor: theme.colors.border,
  padding: rp(14),
  color: theme.colors.textPrimary,
  marginBottom: rp(16),
  fontSize: rs(15),
  fontWeight: "700",
};
