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
  BackHandler,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { connectWS, disconnectWS } from "../../lib/websocket";
import { pickImageHelper } from "../../utils/imagePicker";

const STATUS_CONFIG = {
  PRE_REGISTERED: { color: "#8B5CF6", label: "Pre-Registered" },
  CHECKED_IN: { color: "#0EA5E9", label: "Checked In" },
  PARKED: { color: "#059669", label: "Parked" },
  RETRIEVAL_REQUESTED: { color: "#F59E0B", label: "Requested" },
  BEING_FETCHED: { color: "#F97316", label: "Fetching" },
  DELIVERED: { color: "#9CA3AF", label: "Delivered" },
};

const FILTERS = ["ALL", "PRE_REGISTERED", "CHECKED_IN", "PARKED", "RETRIEVAL_REQUESTED", "BEING_FETCHED", "DELIVERED"];

const generateTempPassword = () => Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "1!";

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function EventDetail() {
  const router = useRouter();

  useEffect(() => {
    const backAction = () => {
      if (showCarModal) { setShowCarModal(false); return true; }
      if (showAddDriverModal) { setShowAddDriverModal(false); return true; }
      if (showAddSupervisorModal) { setShowAddSupervisorModal(false); return true; }
      if (showIncidentModal) { setShowIncidentModal(false); return true; }
      if (showSpecialEventQRModal) { setShowSpecialEventQRModal(false); return true; }
      router.back(); return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [showCarModal, showAddDriverModal, showAddSupervisorModal, showIncidentModal, showSpecialEventQRModal]);

  const { currentEventId } = useAppStore();
  const [event, setEvent] = useState(null);
  const isClosed = event?.status === "closed";
  const [tab, setTab] = useState("cars");
  const [slotTab, setSlotTab] = useState("parking");
  const [cars, setCars] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [stats, setStats] = useState(null);
  const [guestCount, setGuestCount] = useState(null);
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
  const [incidentDesc, setIncidentDesc] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [incidentPhoto, setIncidentPhoto] = useState(null);
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [incidentCarSearch, setIncidentCarSearch] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingIncident, setResolvingIncident] = useState(null);
  const [resolveStatus, setResolveStatus] = useState("IN_REVIEW");
  const [resolveRemark, setResolveRemark] = useState("");
  const [submittingResolve, setSubmittingResolve] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [specialEventHotel, setSpecialEventHotel] = useState(null);
  const [specialEventQRToken, setSpecialEventQRToken] = useState(null);
  const [showSpecialEventQRModal, setShowSpecialEventQRModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [supervisors, setSupervisors] = useState([]);
  const [assigningSupervisorId, setAssigningSupervisorId] = useState(null);
  const [showAddSupervisorModal, setShowAddSupervisorModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [supName, setSupName] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supPassword, setSupPassword] = useState("");
  const [supPanNumber, setSupPanNumber] = useState("");
  const [supBankAccountNumber, setSupBankAccountNumber] = useState("");
  const [supBankIfsc, setSupBankIfsc] = useState("");
  const [supAadharNumber, setSupAadharNumber] = useState("");
  const [supAadharPhotoUri, setSupAadharPhotoUri] = useState(null);
  const [supPhoto, setSupPhoto] = useState(null);
  const [supGender, setSupGender] = useState("");
  const [supIfscChecking, setSupIfscChecking] = useState(false);
  const [supIfscInfo, setSupIfscInfo] = useState(null);
  const [savingSupervisor, setSavingSupervisor] = useState(false);

  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [driverErrors, setDriverErrors] = useState({});
  const [drvName, setDrvName] = useState("");
  const [drvEmail, setDrvEmail] = useState("");
  const [drvPhone, setDrvPhone] = useState("");
  const [drvPin, setDrvPin] = useState("");
  const [drvPhoto, setDrvPhoto] = useState(null);
  const [drvPhotoUri, setDrvPhotoUri] = useState(null);
  const [drvLicenseNumber, setDrvLicenseNumber] = useState("");
  const [drvLicensePhoto, setDrvLicensePhoto] = useState(null);
  const [drvLicensePhotoUri, setDrvLicensePhotoUri] = useState(null);
  const [drvPan, setDrvPan] = useState("");
  const [drvBankAccount, setDrvBankAccount] = useState("");
  const [drvBankIfsc, setDrvBankIfsc] = useState("");
  const [drvAadharNumber, setDrvAadharNumber] = useState("");
  const [drvAadharPhotoUri, setDrvAadharPhotoUri] = useState(null);
  const [drvGender, setDrvGender] = useState("");
  const [drvIfscChecking, setDrvIfscChecking] = useState(false);
  const [drvIfscInfo, setDrvIfscInfo] = useState(null);
  const [savingDriver, setSavingDriver] = useState(false);

  const [employeeTab, setEmployeeTab] = useState("supervisors");

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

  const fetchSlots = useCallback(async () => {
    try {
      const { data } = await api.get(`/slots/event/${currentEventId}`);
      setSlots(data || []);
    } catch { }
  }, [currentEventId]);

  const fetchCars = useCallback(async () => {
    try {
      const { data } = await api.get(`/cars/event/${currentEventId}`);
      setCars(data || []);
    } catch { }
  }, [currentEventId]);

  const fetchDrivers = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/drivers`);
      setDrivers(data || []);
    } catch { }
  }, [currentEventId]);

  const fetchSupervisors = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/supervisors`);
      setSupervisors(data || []);
    } catch { }
  }, [currentEventId]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/stats`);
      setStats(data);
    } catch { }
  }, [currentEventId]);

  const fetchGuestCount = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/guest-count`);
      setGuestCount(data.guest_count || 0);
    } catch { }
  }, [currentEventId]);

  const fetchIncidents = useCallback(async () => {
    try {
      const { data } = await api.get(`/incidents/event/${currentEventId}`);
      setIncidents(data || []);
    } catch { }
  }, [currentEventId]);

  const fetchKeys = useCallback(async () => {
    try {
      const { data } = await api.get(
        `/events/${currentEventId}/keys`
      );
      setKeys(data.keys || []);
      setKeyStats(data);
    } catch { }
  }, [currentEventId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchEvent(), fetchCars(), fetchStats(), fetchSlots()]);
    setRefreshing(false);
  }, [fetchEvent, fetchCars, fetchStats, fetchSlots]);

  const submitResolve = async () => {
    if ((resolveStatus === "RESOLVED" || resolveStatus === "DISMISSED") && !resolveRemark.trim()) {
      Alert.alert("Required", "Please provide a remark when resolving or dismissing.");
      return;
    }
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
    if (!incidentCar) {
      Alert.alert("Required", "Please select a car");
      return;
    }
    if (!incidentType) {
      Alert.alert("Required", "Please select an incident type");
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
        incident_type: incidentType,
        description: incidentDesc.trim(),
        photo_url: photoUrl,
      });
      setShowIncidentModal(false);
      setIncidentCar(null);
      setIncidentType("");
      setIncidentDriver(null);
      setIncidentDesc("");
      setIncidentType("");
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
    Promise.all([fetchEvent(), fetchCars(), fetchDrivers(), fetchSupervisors(), fetchStats(), fetchGuestCount(), fetchSlots(), fetchIncidents(), fetchKeys()]);
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

  const handleAssignDriver = async (driverId, isBusy, busyPlate, driverName) => {
    const doAssign = async () => {
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

    const message = isBusy
      ? `This driver is currently busy${busyPlate ? ` with car ${busyPlate}` : ""}. Assign this car to them anyway?`
      : `Assign ${driverName} to ${selectedCar?.plate}?`;

    Alert.alert(
      isBusy ? "Driver is busy" : "Confirm Assignment",
      message,
      [
        { text: "Cancel", style: "cancel" },
        { text: isBusy ? "Assign Anyway" : "Confirm", onPress: doAssign },
      ]
    );
  };

  const exportCSV = async () => {
    setExportingCSV(true);
    try {
      const { data } = await api.get(
        `/events/${currentEventId}/report`
      );
      const headers = [
        "Plate", "Make", "Color", "Status", "Zone", "Slot",
        "Key Tag", "Check-in Driver", "Retrieval Driver",
        "Duration (min)", "Retrieval Time (min)", "Platform Rating", "Driver Rating", "Notes",
        "Pre-registered", "Walk-in", "Peak Hour", "Incidents", "Delivered", "Still Parked"
      ].join(",");
      const rows = data.cars.map(c =>
        [
          c.plate, c.make, c.color, c.status,
          c.zone || "", c.slot || "", c.key_tag || "",
          c.check_in_driver || "", c.retrieval_driver || "",
          c.duration_minutes || "", c.retrieval_minutes || "",
          c.rating || "", c.driver_rating || "",
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
        <td>${d.avg_rating != null ? d.avg_rating + "★" : "—"}</td>
        <td style="color:${d.incidents > 0 ? "#EF4444" : "#6B7280"
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
            <div class="stat-val">
              ${s.driver_avg_rating > 0
          ? s.driver_avg_rating + "★" : "—"}
            </div>
            <div class="stat-lbl">Driver Rating</div>
          </div>
          <div class="stat">
            <div class="stat-val" style="color:${s.total_incidents > 0 ? "#EF4444" : "#059669"}">${s.total_incidents}</div>
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
          <th>Retrievals</th><th>Avg Rating</th><th>Incidents</th>
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
      const filename = `${e.name.replace(/\s+/g, "_")
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
    // Optimistic update - update UI immediately
    setDrivers(prev => prev.map(drv => drv.id === d.id ? { ...drv, assigned: !drv.assigned } : drv));
    try {
      if (d.assigned) {
        await api.delete(`/events/${currentEventId}/drivers/${d.id}`);
      } else {
        await api.post(`/events/${currentEventId}/drivers/${d.id}`);
      }
    } catch (e) {
      // Revert optimistic update on failure
      setDrivers(prev => prev.map(drv => drv.id === d.id ? { ...drv, assigned: d.assigned } : drv));
      Alert.alert("Error", e.response?.data?.detail || "Failed to update assignment");
    } finally {
      setAssigningId(null);
    }
  };

  const toggleAssignSupervisor = async (s) => {
    Alert.alert(
      s.assigned ? "Remove Supervisor" : "Assign Supervisor",
      s.assigned ? `Remove supervisor ${s.name} from this event?` : `Assign supervisor ${s.name} to this event?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => doToggleAssignSupervisor(s) }
      ]
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
      Alert.alert("Error", msg);
    } finally {
      setAssigningSupervisorId(null);
    }
  };

  const resetSupForm = () => {
    setSupName(""); setSupEmail(""); setSupPhone(""); setSupPassword("");
    setSupPanNumber(""); setSupBankAccountNumber(""); setSupBankIfsc(""); setSupAadharNumber(""); setSupAadharPhotoUri(null); setSupPhoto(null);
    setSupGender("male"); setSupIfscChecking(false); setSupIfscInfo(null); setErrors({});
  };

  const validateSupervisor = () => {
    const errs = {};
    if (!supName.trim()) errs.name = "Name is required";
    if (!supEmail.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supEmail.trim())) errs.email = "Please enter a valid email address";
    if (!supGender) errs.gender = "Please select gender";
    if (supPhone.trim() && !/^\d{10}$/.test(supPhone.trim().replace(/\D/g, ""))) errs.phone = "Please enter a valid 10-digit phone number";
    if (supPanNumber.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(supPanNumber.trim().toUpperCase())) errs.pan = "Expected format: ABCDE1234F";
    if (supBankAccountNumber.trim() && !/^\d{9,18}$/.test(supBankAccountNumber.trim())) errs.bankAccount = "Must be 9-18 digits";
    if (supBankIfsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(supBankIfsc.trim().toUpperCase())) errs.bankIfsc = "Expected format: ABCD0123456";
    else if (supBankIfsc.trim().length === 11 && supIfscInfo === "error") errs.bankIfsc = "This IFSC code was not found. Please check and try again.";
    if (!supAadharNumber.trim()) errs.aadharNumber = "Aadhar Number is required";
    else if (!/^\d{12}$/.test(supAadharNumber.trim())) errs.aadharNumber = "Aadhar number must be exactly 12 digits";
    if (!supAadharPhotoUri) errs.aadharPhoto = "Aadhar Photo is required";
    return errs;
  };

  const validateDriver = () => {
    const errs = {};
    if (!drvName.trim()) errs.name = "Name is required";
    if (!drvEmail.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(drvEmail.trim())) errs.email = "Please enter a valid email address";
    if (!drvPin.trim()) errs.pin = "PIN is required";
    else if (drvPin.length !== 4 || !/^\d{4}$/.test(drvPin)) errs.pin = "PIN must be exactly 4 digits";
    if (!drvGender) errs.gender = "Please select gender";
    if (!drvPhone.trim()) errs.phone = "Phone is required";
    else if (!/^\d{10}$/.test(drvPhone.trim().replace(/\D/g, ""))) errs.phone = "Please enter a valid 10-digit phone number";
    if (drvPan.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(drvPan.trim().toUpperCase())) errs.pan = "Expected format: ABCDE1234F";
    if (drvBankAccount.trim() && !/^\d{9,18}$/.test(drvBankAccount.trim())) errs.bankAccount = "Must be 9-18 digits";
    if (drvBankIfsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(drvBankIfsc.trim().toUpperCase())) errs.bankIfsc = "Expected format: ABCD0123456";
    else if (drvBankIfsc.trim().length === 11 && drvIfscInfo === "error") errs.bankIfsc = "This IFSC code was not found. Please check and try again.";
    if (!drvLicenseNumber.trim()) errs.licenseNumber = "Driving License Number is required";
    else if (!/^[A-Z0-9]{10,16}$/.test(drvLicenseNumber.trim().toUpperCase())) errs.licenseNumber = "Must be 10-16 alphanumeric characters";
    if (!drvLicensePhotoUri) errs.licensePhoto = "License Photo is required";
    if (!drvAadharNumber.trim()) errs.aadharNumber = "Aadhar Number is required";
    else if (!/^\d{12}$/.test(drvAadharNumber.trim())) errs.aadharNumber = "Aadhar number must be exactly 12 digits";
    if (!drvAadharPhotoUri) errs.aadharPhoto = "Aadhar Photo is required";
    return errs;
  };

  const saveSupervisor = async () => {
    const errs = validateSupervisor();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    let phoneToSave;
    if (supPhone.trim()) {
      const normalizeIndianPhone = (p) => p.replace(/^(\+91|91|0)/, "").replace(/[\s\-()]/g, "");
      const normalized = normalizeIndianPhone(supPhone.trim());
      const isValidIndian = /^\d{10}$/.test(normalized);
      phoneToSave = isValidIndian ? normalized : supPhone.trim();
    }

    Alert.alert(
      "Confirm Changes",
      `Confirm saving changes for supervisor ${supName.trim()}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => doSaveSupervisor(phoneToSave) }
      ]
    );
  };

  const doSaveSupervisor = async (phoneToSave) => {
    setSavingSupervisor(true);
    try {
      let uploadedPhotoUrl;
      if (supPhoto) {
        const formData = new FormData();
        formData.append("file", { uri: supPhoto, type: "image/jpeg", name: "photo.jpg" });
        formData.append("folder", "supervisors");
        const up = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        uploadedPhotoUrl = up.data.url;
      }

      let aadharPhotoUrl;
      if (supAadharPhotoUri) {
        aadharPhotoUrl = await uploadDriverImage(supAadharPhotoUri, "aadhar_photos");
      }

      await api.post("/supervisors", {
        name: supName.trim(),
        email: supEmail.trim().toLowerCase(),
        phone: phoneToSave || undefined,
        password: generateTempPassword(),
        pan_number: supPanNumber.trim() || undefined,
        bank_account_number: supBankAccountNumber.trim() || undefined,
        bank_ifsc: supBankIfsc.trim() ? supBankIfsc.trim().toUpperCase() : undefined,
        aadhar_number: supAadharNumber.trim(),
        aadhar_photo: aadharPhotoUrl,
        supervisor_photo: uploadedPhotoUrl || undefined,
        gender: supGender,
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

  const resetDrvForm = () => {
    setDrvName("");
    setDrvEmail("");
    setDrvPhone("");
    setDrvPin("");
    setDrvPhoto(null);
    setDrvPhotoUri(null);
    setDrvLicenseNumber("");
    setDrvLicensePhoto(null);
    setDrvLicensePhotoUri(null);
    setDrvPan("");
    setDrvBankAccount("");
    setDrvBankIfsc("");
    setDrvAadharNumber("");
    setDrvAadharPhotoUri(null);
    setDrvGender("male");
    setDrvIfscChecking(false);
    setDrvIfscInfo(null);
  };

  const pickDriverPhoto = () => {
    pickImageHelper({
      quality: 0.8,
      onSelect: (uri) => {
        setDrvPhotoUri(uri);
        setDrvPhoto(uri);
      }
    });
  };

  const pickLicensePhoto = () => {
    pickImageHelper({
      quality: 0.8,
      onSelect: (uri) => {
        setDrvLicensePhotoUri(uri);
        setDrvLicensePhoto(uri);
      }
    });
  };

  const pickAadharPhoto = () => {
    pickImageHelper({
      quality: 0.8,
      onSelect: (uri) => {
        setDrvAadharPhotoUri(uri);
      }
    });
  };

  const pickSupAadharPhoto = () => {
    pickImageHelper({
      quality: 0.8,
      onSelect: (uri) => {
        setSupAadharPhotoUri(uri);
      }
    });
  };

  const uploadDriverImage = async (uri, folder) => {
    const formData = new FormData();
    formData.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
    formData.append("folder", folder);
    const up = await api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return up.data.url;
  };

  const saveDriver = async () => {
    const errs = validateDriver();
    setDriverErrors(errs);
    if (Object.keys(errs).length > 0) return;

    let phoneToSave;
    if (drvPhone.trim()) {
      const normalizeIndianPhone = (p) => p.replace(/^(\+91|91|0)/, "").replace(/[\s\-()]/g, "");
      const normalized = normalizeIndianPhone(drvPhone.trim());
      const isValidIndian = /^\d{10}$/.test(normalized);
      phoneToSave = isValidIndian ? normalized : drvPhone.trim();
    }

    Alert.alert(
      "Confirm Changes",
      `Confirm saving changes for driver ${drvName.trim()}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => doSaveDriver(phoneToSave) }
      ]
    );
  };

  const doSaveDriver = async (phoneToSave) => {
    setSavingDriver(true);
    try {
      let photoUrl;
      if (drvPhotoUri) {
        photoUrl = await uploadDriverImage(drvPhotoUri, "drivers");
      }
      let licensePhotoUrl;
      if (drvLicensePhotoUri) {
        licensePhotoUrl = await uploadDriverImage(drvLicensePhotoUri, "drivers/licenses");
      }
      let aadharPhotoUrl;
      if (drvAadharPhotoUri) {
        aadharPhotoUrl = await uploadDriverImage(drvAadharPhotoUri, "aadhar_photos");
      }
      await api.post("/drivers", {
        name: drvName.trim(),
        email: drvEmail.trim().toLowerCase(),
        phone: phoneToSave,
        pin: drvPin,
        driver_photo: photoUrl || undefined,
        pan_number: drvPan.trim() || undefined,
        bank_account_number: drvBankAccount.trim() || undefined,
        bank_ifsc: drvBankIfsc.trim() || undefined,
        driving_license_number: drvLicenseNumber.trim(),
        driving_license_photo: licensePhotoUrl,
        aadhar_number: drvAadharNumber.trim(),
        aadhar_photo: aadharPhotoUrl,
        gender: drvGender,
      });
      setShowAddDriverModal(false);
      resetDrvForm();
      Alert.alert("Driver Added!", `${drvName} has been added successfully.`);
      fetchDrivers();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to add driver");
    } finally {
      setSavingDriver(false);
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
    // Optimistic update all at once
    setDrivers(prev => prev.map(d => (d.available || d.assigned) ? { ...d, assigned: true } : d));
    try {
      await Promise.all(available.map(d => api.post(`/events/${currentEventId}/drivers/${d.id}`)));
    } catch (e) {
      // Refetch on error to get correct state
      fetchDrivers();
      Alert.alert("Error", "Failed to assign some drivers");
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
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
            paddingBottom: rp(16),
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
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(14) }}>
            <TouchableOpacity onPress={() => router.back()} style={iconBtn}>
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
                <View style={{ flexDirection: "row", marginTop: rp(4), alignItems: "center", gap: rp(8) }}>
                  <View
                    style={{
                      backgroundColor: event.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.18)",
                      paddingHorizontal: rp(8),
                      paddingVertical: rp(2),
                      borderRadius: rp(99),
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: rs(10), fontWeight: "800", letterSpacing: rs(1.5) }}>
                      {event.status === "closed" ? "CLOSED" : event.status.toUpperCase()}
                    </Text>
                  </View>
                  {guestCount != null && (
                    <View
                      style={{
                        backgroundColor: "rgba(255,255,255,0.18)",
                        paddingHorizontal: rp(8),
                        paddingVertical: rp(2),
                        borderRadius: rp(99),
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: rs(10), fontWeight: "800", letterSpacing: rs(1.5) }}>
                        {guestCount} GUESTS INVITED
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setShowMenu(!showMenu)}
              style={[iconBtn, { marginRight: rp(8) }]}
            >
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </TouchableOpacity>
            {event?.status === "active" && (
              <TouchableOpacity onPress={closeEvent} style={[iconBtn, { backgroundColor: "rgba(244,63,94,0.7)" }]}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

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
              top: 130,
              right: 20,
              backgroundColor: '#fff',
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
                    router.push({ pathname: "/(admin)/edit-event", params: { eventId: currentEventId } });
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#7C3AED" />
                  <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: '#0F2044' }}>Edit Event</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
                <TouchableOpacity
                  style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => {
                    setShowMenu(false);
                    if (event?.event_type === "hotel_special" || event?.event_type === "hotel_daily" || event?.event_type === "regular") {
                      setShowSpecialEventQRModal(true);
                    } else {
                      router.push("/(admin)/pre-register-qr");
                    }
                  }}
                >
                  <Ionicons name="qr-code-outline" size={20} color="#7C3AED" />
                  <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: '#0F2044' }}>QR Code</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
                <TouchableOpacity
                  style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => {
                    setShowMenu(false);
                    setShowIncidentModal(true);
                  }}
                >
                  <Ionicons name="warning-outline" size={20} color="#7C3AED" />
                  <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: '#0F2044' }}>Report Incident</Text>
                </TouchableOpacity>
                <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
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
              <Ionicons name="document-text-outline" size={20} color="#7C3AED" />
              <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: '#0F2044' }}>Export CSV</Text>
            </TouchableOpacity>
            <View style={{ height: rp(1), backgroundColor: '#F3F4F6' }} />
            <TouchableOpacity
              style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
              onPress={() => {
                setShowMenu(false);
                exportPDF();
              }}
            >
              <Ionicons name="document-outline" size={20} color="#7C3AED" />
              <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: '#0F2044' }}>Export PDF</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Tab bar */}
      <View
        style={{
          backgroundColor: "#fff",
          flexDirection: "row",
          marginHorizontal: rp(16),
          marginTop: -22,
          borderRadius: rp(20),
          padding: rp(4),
          ...cardShadow,
        }}
      >
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
            testID={`tab-${k}`}
            style={{
              flex: 1,
              paddingVertical: rp(10),
              borderRadius: rp(16),
              backgroundColor: tab === k ? "#7C3AED" : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontWeight: "800",
                fontSize: isClosed ? 13 : 11,
                color: tab === k ? "#fff" : "#6B7280",
                letterSpacing: rs(1),
              }}
            >
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
              onRefresh={onRefresh}
              tintColor="#7C3AED"
              colors={["#7C3AED"]}
            />
          }
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: rp(16),
              paddingHorizontal: rp(14),
              flexDirection: "row",
              alignItems: "center",
              marginBottom: rp(12),
              borderWidth: rp(1),
              borderColor: "#E5E7EB",
            }}
          >
            <Ionicons name="search" size={18} color="#7C3AED" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search plate..."
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, paddingVertical: rp(12), marginLeft: rp(8), color: "#111827" }}
              testID="car-search"
            />
          </View>
          <ScrollView
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
                  backgroundColor: statusFilter === f ? "#7C3AED" : "#fff",
                  borderWidth: rp(1),
                  borderColor: statusFilter === f ? "#7C3AED" : "#E5E7EB",
                }}
              >
                <Text
                  style={{
                    fontSize: rs(11),
                    fontWeight: "800",
                    color: statusFilter === f ? "#fff" : "#6B7280",
                    letterSpacing: rs(1),
                  }}
                >
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
                    {car.carried_forward && (
                      <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99), borderWidth: 1, borderColor: "#FDE68A" }}>
                        <Text style={{ color: "#92400E", fontSize: rs(9), fontWeight: "800", letterSpacing: rs(0.5) }}>
                          OVERNIGHT
                        </Text>
                      </View>
                    )}
                    <Text style={{ color: "#9CA3AF", fontSize: rs(11) }}>
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
          <View style={{ height: rp(40) }} />
        </ScrollView>
      )}

      {tab === "incidents" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
          }
        >
          {incidents.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: rp(60) }}>
              <View style={{ backgroundColor: "#D1FAE5", width: rp(80), height: rp(80), borderRadius: rp(40), alignItems: "center", justifyContent: "center", marginBottom: rp(16) }}>
                <Ionicons name="checkmark" size={40} color="#059669" />
              </View>
              <Text style={{ color: "#111827", fontWeight: "900", fontSize: rs(18) }}>No incidents reported</Text>
              <Text style={{ color: "#6B7280", marginTop: rp(4) }}>Everything is running smoothly</Text>
            </View>
          ) : (
            incidents.map((i) => (
              <View key={i.id} style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(18), marginBottom: rp(12), ...cardShadow }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flexDirection: "column", gap: rp(4) }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8) }}>
                      <View style={{ backgroundColor: "#111827", paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(8) }}>
                        <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(14) }}>{i.plate}</Text>
                      </View>
                      <View style={{ paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(6), backgroundColor: i.status === "OPEN" ? "#FEE2E2" : i.status === "IN_REVIEW" ? "#FEF3C7" : i.status === "RESOLVED" ? "#D1FAE5" : "#F3F4F6" }}>
                        <Text style={{ color: i.status === "OPEN" ? "#991B1B" : i.status === "IN_REVIEW" ? "#92400E" : i.status === "RESOLVED" ? "#065F46" : "#4B5563", fontSize: rs(10), fontWeight: "800" }}>{i.status}</Text>
                      </View>
                    </View>
                    <Text style={{ color: "#6B7280", fontSize: rs(11), fontWeight: "700" }}>{(i.incident_type || "UNKNOWN").replace(/_/g, " ").replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase())}</Text>
                  </View>
                  <Text style={{ color: "#9CA3AF", fontSize: rs(11) }}>
                    {new Date(i.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: 'Asia/Kolkata' })}
                  </Text>
                </View>

                <View style={{ marginTop: rp(12) }}>
                  <Text style={{ color: "#374151", fontSize: rs(14), lineHeight: 20 }}>{i.description}</Text>
                </View>

                {(i.status === "RESOLVED" || i.status === "DISMISSED") && i.remark && (
                  <View style={{ backgroundColor: "#F3F4F6", borderRadius: rp(12), padding: rp(12), marginTop: rp(12) }}>
                    <Text style={{ color: "#374151", fontSize: rs(13), lineHeight: 18 }}>{i.remark}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6) }}>
                      <Ionicons name="checkmark-done-circle" size={14} color="#6B7280" />
                      <Text style={{ color: "#6B7280", fontSize: rs(11), marginLeft: rp(4) }}>
                        Resolved by {i.resolved_by || "Unknown"} on {i.resolved_at ? new Date(i.resolved_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: 'Asia/Kolkata' }) : "Unknown"}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: rp(12), paddingTop: rp(12), borderTopWidth: rp(1), borderTopColor: "#F3F4F6" }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="person-circle-outline" size={16} color="#6B7280" />
                    <Text style={{ color: "#6B7280", fontSize: rs(12), marginLeft: rp(6) }}>
                      Reported by: <Text style={{ fontWeight: "700" }}>{i.driver_name || "Unknown Driver"}</Text>
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

      {tab === "employees" && !isClosed && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
        >
          {/* Internal tab toggle bar */}
          <View
            style={{
              backgroundColor: "#fff",
              flexDirection: "row",
              borderRadius: rp(20),
              padding: rp(4),
              marginBottom: rp(16),
              ...cardShadow,
            }}
          >
            <TouchableOpacity
              onPress={() => setEmployeeTab("supervisors")}
              style={{
                flex: 1,
                paddingVertical: rp(10),
                borderRadius: rp(16),
                backgroundColor: employeeTab === "supervisors" ? "#0F2044" : "transparent",
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: rp(6),
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: rs(13),
                  color: employeeTab === "supervisors" ? "#fff" : "#6B7280",
                  letterSpacing: rs(1),
                }}
              >
                Supervisors
              </Text>
              <View style={{ backgroundColor: employeeTab === "supervisors" ? "rgba(255,255,255,0.2)" : "#EDE9FE", paddingHorizontal: rp(6), paddingVertical: rp(1), borderRadius: rp(99) }}>
                <Text style={{ color: employeeTab === "supervisors" ? "#fff" : "#7C3AED", fontWeight: "800", fontSize: rs(10) }}>{supervisors.filter(s => s.assigned).length}/{supervisors.length}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setEmployeeTab("drivers")}
              style={{
                flex: 1,
                paddingVertical: rp(10),
                borderRadius: rp(16),
                backgroundColor: employeeTab === "drivers" ? "#0F2044" : "transparent",
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: rp(6),
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: rs(13),
                  color: employeeTab === "drivers" ? "#fff" : "#6B7280",
                  letterSpacing: rs(1),
                }}
              >
                Drivers
              </Text>
              <View style={{ backgroundColor: employeeTab === "drivers" ? "rgba(255,255,255,0.2)" : "#F3F0FF", paddingHorizontal: rp(6), paddingVertical: rp(1), borderRadius: rp(99) }}>
                <Text style={{ color: employeeTab === "drivers" ? "#fff" : "#7C3AED", fontWeight: "800", fontSize: rs(10) }}>{drivers.filter(d => d.assigned).length}/{drivers.length}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {employeeTab === "supervisors" && (
            <>
              {/* SUPERVISORS CONTENT */}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginBottom: rp(12) }}>
                <TouchableOpacity
                  onPress={() => setShowAddSupervisorModal(true)}
                  style={{ backgroundColor: "#0F2044", borderRadius: rp(12), paddingVertical: rp(7), paddingHorizontal: rp(14), flexDirection: "row", alignItems: "center", gap: rp(6) }}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(12), letterSpacing: rs(1) }}>ADD SUPERVISOR</Text>
                </TouchableOpacity>
              </View>

              {supervisors.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: rp(40) }}>
                  <Text style={{ fontSize: rs(48) }}>🛡️</Text>
                  <Text style={{ color: "#6B7280", marginTop: rp(8), fontWeight: "700" }}>No supervisors</Text>
                </View>
              )}

              {supervisors.map((s) => (
                <View
                  key={s.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: rp(24),
                    padding: rp(16),
                    marginBottom: rp(12),
                    ...cardShadow,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        backgroundColor: "#0F2044",
                        borderRadius: rp(99),
                        width: rp(48),
                        height: rp(48),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(18) }}>
                        {s.name?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ flex: 1, marginLeft: rp(12) }}
                      onPress={() =>
                        router.push({
                          pathname: "/(admin)/supervisor-detail",
                          params: { supervisorId: s.id, supervisorName: s.name },
                        })
                      }
                    >
                      <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(15) }}>{s.name}</Text>
                      <Text style={{ color: "#6B7280", fontSize: rs(12) }}>{s.email}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(4) }}>
                        <View
                          style={{
                            width: rp(8),
                            height: rp(8),
                            borderRadius: rp(99),
                            marginRight: rp(6),
                            backgroundColor: s.available ? "#059669" : "#F43F5E",
                          }}
                        />
                        <Text style={{ fontSize: rs(11), fontWeight: "700", color: s.available ? "#059669" : "#F43F5E" }}>
                          {s.available ? "Available" : `In ${s.conflict_event_name || "another event"}`}
                        </Text>
                        {s.is_verified === false && (
                          <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(4), marginLeft: rp(6) }}>
                            <Text style={{ color: "#D97706", fontSize: rs(9), fontWeight: "bold" }}>UNVERIFIED</Text>
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
                            letterSpacing: rs(1.5),
                            color: s.assigned ? "#F43F5E" : "#fff",
                            fontSize: rs(13),
                          }}
                        >
                          {s.assigned ? "UNASSIGN" : "ASSIGN"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: rp(12), backgroundColor: "#F3F4F6", borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center" }}>
                      <Text style={{ color: "#9CA3AF", fontSize: rs(11) }}>
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
                  onPress={() => setShowAddDriverModal(true)}
                  style={{ backgroundColor: "#7C3AED", borderRadius: rp(12), paddingVertical: rp(7), paddingHorizontal: rp(14), flexDirection: "row", alignItems: "center", gap: rp(6) }}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(12), letterSpacing: rs(1) }}>ADD DRIVER</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={assignAll}
                  disabled={assigningAll || drivers.filter(d => (d.available || d.assigned) && !d.assigned).length === 0}
                  style={{
                    backgroundColor: assigningAll ? "#EDE9FE" : "#7C3AED",
                    borderRadius: rp(12),
                    paddingVertical: rp(7),
                    paddingHorizontal: rp(14),
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
                <View
                  key={d.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: rp(24),
                    padding: rp(16),
                    marginBottom: rp(12),
                    ...cardShadow,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        backgroundColor: "#7C3AED",
                        borderRadius: rp(99),
                        width: rp(48),
                        height: rp(48),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(18) }}>
                        {d.name?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ flex: 1, marginLeft: rp(12) }}
                      onPress={() =>
                        router.push({
                          pathname: "/(admin)/driver-stats",
                          params: { driverId: d.id, driverName: d.name },
                        })
                      }
                    >
                      <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(15) }}>{d.name}</Text>
                      <Text style={{ color: "#6B7280", fontSize: rs(12) }}>{d.employee_id}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(4) }}>
                        <View
                          style={{
                            width: rp(8),
                            height: rp(8),
                            borderRadius: rp(99),
                            marginRight: rp(6),
                            backgroundColor: d.available ? "#059669" : "#F43F5E",
                          }}
                        />
                        <Text style={{ fontSize: rs(11), fontWeight: "700", color: d.available ? "#059669" : "#F43F5E" }}>
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
                      <Text style={{ color: "#059669", fontSize: rs(11), fontWeight: "700" }}>
                        Checked in: {d.cars_checked_in || 0}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                      <Text style={{ color: "#0EA5E9", fontSize: rs(11), fontWeight: "700" }}>
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
                            letterSpacing: rs(1.5),
                            color: d.assigned ? "#F43F5E" : "#fff",
                            fontSize: rs(13),
                          }}
                        >
                          {d.assigned ? "UNASSIGN" : "ASSIGN"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: rp(12), backgroundColor: "#F3F4F6", borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center" }}>
                      <Text style={{ color: "#9CA3AF", fontSize: rs(11) }}>
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

      {tab === "stats" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
        >
          <TouchableOpacity onPress={fetchStats} style={{ backgroundColor: "#fff", borderRadius: rp(16), paddingVertical: rp(10), alignItems: "center", marginBottom: rp(16), borderWidth: rp(1), borderColor: "#E5E7EB" }}>
            <Text style={{ color: "#7C3AED", fontWeight: "800", letterSpacing: rs(1) }}>↻ Refresh Stats</Text>
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

          {event?.event_type !== "hotel_daily" && (
            <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(24), marginBottom: rp(16), ...cardShadow }}>
              <Text style={{ fontSize: rs(16), fontWeight: "900", color: "#0F2044", marginBottom: rp(16) }}>Event Host</Text>

              <Text style={{ fontSize: rs(10), fontWeight: "800", color: "#9CA3AF", marginBottom: rp(4), letterSpacing: rs(1) }}>HOST NAME</Text>
              <TextInput
                value={event?.host_name || ""}
                onChangeText={txt => setEvent(prev => ({ ...prev, host_name: txt }))}
                placeholder="e.g. John Doe"
                placeholderTextColor="#9CA3AF"
                editable={!isClosed}
                style={{ backgroundColor: isClosed ? "#F3F4F6" : "#F9FAFB", borderWidth: rp(1), borderColor: "#E5E7EB", borderRadius: rp(12), padding: rp(12), color: isClosed ? "#9CA3AF" : "#111827", marginBottom: rp(16) }}
              />

              <Text style={{ fontSize: rs(10), fontWeight: "800", color: "#9CA3AF", marginBottom: rp(4), letterSpacing: rs(1) }}>HOST EMAIL</Text>
              <View style={{ flexDirection: "row", gap: rp(8) }}>
                <TextInput
                  value={event?.host_email || ""}
                  onChangeText={txt => setEvent(prev => ({ ...prev, host_email: txt }))}
                  placeholder="john@example.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isClosed}
                  style={{ flex: 1, backgroundColor: isClosed ? "#F3F4F6" : "#F9FAFB", borderWidth: rp(1), borderColor: "#E5E7EB", borderRadius: rp(12), padding: rp(12), color: isClosed ? "#9CA3AF" : "#111827" }}
                />
                {!isClosed && (
                  <TouchableOpacity
                    onPress={async () => {
                      if (!event?.host_email) {
                        Alert.alert("Required", "Please enter host email");
                        return;
                      }
                      try {
                        await api.patch(`/events/${currentEventId}/host`, {
                          host_name: event.host_name,
                          host_email: event.host_email
                        });
                        Alert.alert("Success", "Host updated and portal email sent");
                        fetchEvent();
                      } catch (err) {
                        Alert.alert("Error", err?.response?.data?.detail || "Failed to update host");
                      }
                    }}
                    style={{ backgroundColor: "#1A3C6E", paddingHorizontal: rp(16), justifyContent: "center", borderRadius: rp(12) }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: rs(12) }}>
                      {event?.host_email_sent ? "Resend Portal" : "Send Portal"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {isClosed && (
                <Text style={{ color: "#EF4444", fontSize: rs(11), marginTop: rp(8), fontWeight: "600" }}>
                  Cannot send portal email — event is closed
                </Text>
              )}

              {event?.host_email_sent && (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(12), gap: rp(6) }}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={{ fontSize: rs(12), fontWeight: "800", color: "#059669" }}>Portal email sent</Text>
                </View>
              )}
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
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <Ionicons name="document-outline" size={16}
                color="#7C3AED" />
            )}
            <Text style={{
              color: "#7C3AED", fontWeight: "800",
              fontSize: rs(13), marginLeft: rp(6)
            }}>
              {exportingPDF ? "Generating..." : "Export PDF Report"}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#7C3AED", letterSpacing: rs(3), marginBottom: rp(12), marginTop: rp(8) }}>
            PARKING SUMMARY
          </Text>
          <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(20), marginBottom: rp(16), ...cardShadow }}>
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

          <View style={{ height: rp(40) }} />
        </ScrollView>
      )}

      {tab === "slots" && !isClosed && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: rp(16), paddingBottom: rp(100) }}>

          {/* Internal sub-tab toggle */}
          <View style={{ backgroundColor: "#fff", flexDirection: "row", borderRadius: rp(18), padding: rp(4), marginBottom: rp(16), ...cardShadow }}>
            <TouchableOpacity
              onPress={() => setSlotTab("parking")}
              style={{
                flex: 1, paddingVertical: rp(10), borderRadius: rp(14),
                backgroundColor: slotTab === "parking" ? "#7C3AED" : "transparent",
                alignItems: "center", flexDirection: "row", justifyContent: "center", gap: rp(6)
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: rs(13), color: slotTab === "parking" ? "#fff" : "#6B7280" }}>🅿 Parking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSlotTab("keys")}
              style={{
                flex: 1, paddingVertical: rp(10), borderRadius: rp(14),
                backgroundColor: slotTab === "keys" ? "#7C3AED" : "transparent",
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
                    <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(12) }}>
                      CAPACITY OVERVIEW
                    </Text>
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
                        <Text style={{ fontSize: rs(28), fontWeight: "900", color: "#7C3AED" }}>{total}</Text>
                        <Text style={{ fontSize: rs(11), color: "#6B7280", fontWeight: "700" }}>TOTAL</Text>
                      </View>
                    </View>
                    <View style={{ height: rp(10), backgroundColor: "#F3F4F6", borderRadius: rp(99), overflow: "hidden" }}>
                      <View style={{ height: rp(10), width: `${pct}%`, backgroundColor: barColor, borderRadius: rp(99) }} />
                    </View>
                    <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(8), textAlign: "right" }}>
                      {pct}% full
                    </Text>
                    {pct >= 80 && (
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: "/(admin)/edit-event", params: { eventId: currentEventId } })}
                        style={{ backgroundColor: pct >= 90 ? "#FEE2E2" : "#FEF3C7", borderRadius: rp(14), padding: rp(12), marginTop: rp(12), flexDirection: "row", alignItems: "center", justifyContent: "center" }}
                      >
                        <Ionicons name="warning-outline" size={16} color={pct >= 90 ? "#EF4444" : "#D97706"} />
                        <Text style={{ fontWeight: "800", fontSize: rs(12), color: pct >= 90 ? "#EF4444" : "#D97706", marginLeft: rp(6) }}>
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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: rp(16) }}>
                    {zones.map(z => {
                      const zSlots = slots.filter(s => s.zone_name === z);
                      const zOcc = zSlots.filter(s => s.is_occupied).length;
                      return (
                        <TouchableOpacity
                          key={typeof z === "object" ? JSON.stringify(z) : z}
                          onPress={() => setSelectedZone(z)}
                          style={{
                            backgroundColor: selectedZone === z ? "#7C3AED" : "#fff",
                            borderRadius: rp(16),
                            paddingHorizontal: rp(16),
                            paddingVertical: rp(10),
                            marginRight: rp(10),
                            borderWidth: selectedZone === z ? 0 : 1,
                            borderColor: "#E5E7EB",
                            ...cardShadow,
                          }}
                        >
                          <Text style={{ fontWeight: "800", fontSize: rs(13), color: selectedZone === z ? "#fff" : "#111827" }}>
                            {typeof z === "object" ? z.zone_name || z.name || z.label || JSON.stringify(z) : `Zone ${z}`}
                          </Text>
                          <Text style={{ fontSize: rs(11), color: selectedZone === z ? "rgba(255,255,255,0.8)" : "#9CA3AF", marginTop: rp(2) }}>
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
                  <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(16), ...cardShadow }}>
                    <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(16) }}>
                      ZONE {selectedZone} — SLOT MAP
                    </Text>
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
                          <Ionicons
                            name={s.is_occupied ? "car" : "car-outline"}
                            size={16}
                            color={s.is_occupied ? "#EF4444" : "#059669"}
                          />
                          <Text style={{ fontSize: rs(11), fontWeight: "800", color: s.is_occupied ? "#EF4444" : "#059669", marginTop: rp(2) }}>
                            {s.slot_number}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {zoneSlots.length === 0 && (
                      <Text style={{ color: "#9CA3AF", textAlign: "center", paddingVertical: rp(24) }}>
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
                <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(20), marginBottom: rp(16), ...cardShadow }}>
                  {event?.key_hook_start != null && event?.key_hook_end != null && (
                    <View style={{ backgroundColor: "#EFF6FF", borderRadius: rp(99), paddingHorizontal: rp(12), paddingVertical: rp(6), marginBottom: rp(12), alignSelf: "flex-start" }}>
                      <Text style={{ color: "#1D4ED8", fontSize: rs(12), fontWeight: "800" }}>
                        Hook range for this event: {event.key_hook_start} – {event.key_hook_end}
                      </Text>
                    </View>
                  )}
                  <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(14) }}>
                    KEY BOARD STATUS
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: rp(16) }}>
                    {[
                      { label: "IN BOOTH", value: keyStats.in_booth, color: "#7C3AED" },
                      { label: "AVAILABLE", value: keyStats.hooks_available, color: "#059669" },
                      { label: "RETURNED", value: keyStats.returned, color: "#9CA3AF" },
                      { label: "TOTAL HOOKS", value: keyStats.total_hooks, color: "#0EA5E9" },
                    ].map(s => (
                      <View key={s.label} style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: rs(24), fontWeight: "900", color: s.color }}>{s.value}</Text>
                        <Text style={{ fontSize: rs(9), fontWeight: "800", color: "#9CA3AF", letterSpacing: rs(1.5), marginTop: rp(4), textAlign: "center" }}>
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
                        <View style={{ height: rp(8), backgroundColor: "#F3F4F6", borderRadius: rp(99), overflow: "hidden" }}>
                          <View style={{ height: rp(8), width: `${pct}%`, backgroundColor: barColor, borderRadius: rp(99) }} />
                        </View>
                        <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginTop: rp(6), textAlign: "right" }}>
                          {pct}% full
                        </Text>
                      </>
                    );
                  })()}

                  {/* Full board warning */}
                  {keyStats.hooks_full && (
                    <View style={{ backgroundColor: "#FEE2E2", borderRadius: rp(14), padding: rp(12), marginTop: rp(8), flexDirection: "row", alignItems: "center", gap: rp(8) }}>
                      <Ionicons name="warning" size={18} color="#EF4444" />
                      <Text style={{ color: "#991B1B", fontWeight: "800", fontSize: rs(13), flex: 1 }}>
                        Key board is full — no hooks available
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Untagged warning */}
              {keyStats?.untagged_count > 0 && (
                <View style={{ backgroundColor: "#FEF3C7", borderRadius: rp(16), padding: rp(14), marginBottom: rp(16), flexDirection: "row", alignItems: "center", gap: rp(10), borderWidth: rp(1), borderColor: "#FDE68A" }}>
                  <Ionicons name="warning" size={20} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: "#92400E", fontSize: rs(13) }}>
                      {keyStats.untagged_count} car(s) have no key tag
                    </Text>
                    <Text style={{ color: "#B45309", fontSize: rs(11), marginTop: rp(2) }}>
                      Ask drivers to add key tag numbers for these cars
                    </Text>
                  </View>
                </View>
              )}

              {/* Keys in booth */}
              {keys.filter(k => k.in_booth).length > 0 && (
                <>
                  <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#7C3AED", letterSpacing: rs(3), marginBottom: rp(10) }}>
                    IN BOOTH ({keys.filter(k => k.in_booth).length})
                  </Text>
                  {keys.filter(k => k.in_booth).map(k => (
                    <View key={k.car_id} style={{
                      backgroundColor: "#fff", borderRadius: rp(16), padding: rp(14), marginBottom: rp(8),
                      flexDirection: "row", alignItems: "center", borderLeftWidth: rp(4), borderLeftColor: "#7C3AED",
                      ...cardShadow
                    }}>
                      <View style={{ backgroundColor: "#F5F3FF", borderRadius: rp(12), width: rp(44), height: rp(44), alignItems: "center", justifyContent: "center", marginRight: rp(12) }}>
                        <Ionicons name="key" size={16} color="#7C3AED" />
                        <Text style={{ fontSize: rs(10), fontWeight: "900", color: "#7C3AED", marginTop: rp(1) }}>
                          #{k.key_tag}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(14) }}>{k.plate}</Text>
                        <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>
                          {k.color} {k.make}{k.zone ? ` · Zone ${k.zone} Slot ${k.slot}` : ""}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: "#EDE9FE", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                        <Text style={{ fontSize: rs(10), fontWeight: "800", color: "#7C3AED", letterSpacing: rs(1) }}>
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
                  <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#059669", letterSpacing: rs(3), marginTop: rp(8), marginBottom: rp(10) }}>
                    RETURNED ({keys.filter(k => !k.in_booth).length})
                  </Text>
                  {keys.filter(k => !k.in_booth).map(k => (
                    <View key={k.car_id} style={{
                      backgroundColor: "#fff", borderRadius: rp(16), padding: rp(14), marginBottom: rp(8),
                      flexDirection: "row", alignItems: "center", borderLeftWidth: rp(4), borderLeftColor: "#D1FAE5",
                      opacity: 0.75, ...cardShadow
                    }}>
                      <View style={{ backgroundColor: "#D1FAE5", borderRadius: rp(12), width: rp(44), height: rp(44), alignItems: "center", justifyContent: "center", marginRight: rp(12) }}>
                        <Ionicons name="key-outline" size={16} color="#059669" />
                        <Text style={{ fontSize: rs(10), fontWeight: "900", color: "#059669", marginTop: rp(1) }}>
                          #{k.key_tag}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "900", color: "#374151", fontSize: rs(14) }}>{k.plate}</Text>
                        <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginTop: rp(2) }}>
                          {k.color} {k.make} · Delivered
                        </Text>
                      </View>
                      <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
                        <Text style={{ fontSize: rs(10), fontWeight: "800", color: "#059669", letterSpacing: rs(1) }}>
                          RETURNED
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Empty state */}
              {keys.length === 0 && (
                <View style={{ backgroundColor: "#fff", borderRadius: rp(20), padding: rp(40), alignItems: "center", ...cardShadow }}>
                  <Ionicons name="key-outline" size={44} color="#D1D5DB" />
                  <Text style={{ color: "#9CA3AF", fontWeight: "700", marginTop: rp(12), fontSize: rs(15) }}>
                    No key tags recorded yet
                  </Text>
                  <Text style={{ color: "#D1D5DB", fontSize: rs(12), marginTop: rp(6), textAlign: "center" }}>
                    Drivers add key tags from their tasks screen after parking
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={showSpecialEventQRModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSpecialEventQRModal(false)}
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
              backgroundColor: "#fff",
              borderRadius: rp(32),
              padding: rp(32),
              alignItems: "center",
              width: "100%",
              shadowColor: "#000",
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
              <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#1D4ED8", letterSpacing: rs(3) }}>
                {event?.event_type === "hotel_daily" ? "HOTEL DAILY VALET QR" : event?.event_type === "hotel_special" ? "SPECIAL EVENT GUEST QR" : "EVENT GUEST QR"}
              </Text>
              <TouchableOpacity onPress={() => setShowSpecialEventQRModal(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text
              style={{
                fontSize: rs(22),
                fontWeight: "900",
                color: "#111827",
                textAlign: "center",
              }}
            >
              {event?.name}
            </Text>
            {specialEventHotel?.name ? (
              <Text
                style={{
                  fontSize: rs(14),
                  fontWeight: "700",
                  color: "#6B7280",
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
                backgroundColor: "#F5F3FF",
                borderRadius: rp(20),
                marginBottom: rp(20),
              }}
            >
              {event?.event_type === "hotel_daily" ? (
                specialEventHotel?.hotel_qr_token ? (
                  <QRCode
                    value={`${process.env.EXPO_PUBLIC_GUEST_URL}/hotel-register/${specialEventHotel.hotel_qr_token}`}
                    size={220}
                    color="#1D4ED8"
                  />
                ) : (
                  <View style={{ width: rp(220), height: rp(220), justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator color="#1D4ED8" size="large" />
                  </View>
                )
              ) : specialEventQRToken ? (
                <QRCode
                  value={`${process.env.EXPO_PUBLIC_GUEST_URL}/pre-register/event/${specialEventQRToken}`}
                  size={220}
                  color="#1D4ED8"
                />
              ) : (
                <View style={{ width: rp(220), height: rp(220), justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator color="#1D4ED8" size="large" />
                </View>
              )}
            </View>

            <Text
              style={{
                color: "#9CA3AF",
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
                backgroundColor: "#1D4ED8",
                borderRadius: rp(16),
                paddingVertical: rp(14),
                width: "100%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: rp(8),
              }}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>SHARE LINK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowSpecialEventQRModal(false)}
              style={{ paddingVertical: rp(12), marginTop: rp(8), alignItems: "center", width: "100%" }}
            >
              <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCarModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: rp(20), maxHeight: "85%" }}>
              <View style={{ alignItems: "center", marginBottom: rp(12) }}>
                <View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} />
              </View>
              <ScrollView>
                {selectedCar && (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: rs(28), fontWeight: "900", color: "#7C3AED" }}>{selectedCar.plate}</Text>
                        <Text style={{ color: "#6B7280", marginTop: rp(4) }}>{selectedCar.color} {selectedCar.make}</Text>
                        <Text style={{ color: "#9CA3AF", fontSize: rs(13), marginTop: rp(4) }}>
                          {selectedCar.zone ? `Zone ${selectedCar.zone} · Slot ${selectedCar.slot}` : "Not parked"}
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: rp(12), paddingVertical: rp(4), borderRadius: rp(99), backgroundColor: STATUS_CONFIG[selectedCar.status]?.color }}>
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: rs(11) }}>
                          {STATUS_CONFIG[selectedCar.status]?.label}
                        </Text>
                      </View>
                    </View>
                    {selectedCar.notes ? (
                      <Text style={{ color: "#6B7280", marginTop: rp(12), fontStyle: "italic" }}>"{selectedCar.notes}"</Text>
                    ) : null}

                    <Text style={[modalLabel, { marginTop: rp(16) }]}>CHECK-IN PHOTOS</Text>
                    {carPhotos.filter((p) => p.type === "checkin").length === 0 ? (
                      <Text style={{ color: "#9CA3AF", fontSize: rs(13) }}>No photos available</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(8) }}>
                        {carPhotos.filter((p) => p.type === "checkin").map((p, i) => (
                          <Image key={i} source={{ uri: p.url }} style={{ width: rp(120), height: rp(120), borderRadius: rp(14) }} />
                        ))}
                      </ScrollView>
                    )}

                    {carPhotos.find((p) => p.type === "handover") && (
                      <>
                        <Text style={[modalLabel, { marginTop: rp(16) }]}>HANDOVER PHOTO</Text>
                        <Image
                          source={{ uri: carPhotos.find((p) => p.type === "handover").url }}
                          style={{ width: "100%", height: rp(200), borderRadius: rp(14) }}
                        />
                      </>
                    )}

                    {["CHECKED_IN", "RETRIEVAL_REQUESTED", "BEING_FETCHED"].includes(selectedCar.status) && !showAssignPicker && (
                      <TouchableOpacity
                        onPress={openAssignPicker}
                        style={{ backgroundColor: "#0F2044", borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(20), flexDirection: "row", justifyContent: "center" }}
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
                        {drivers.filter(d => d.assigned).length === 0 ? (
                          <Text style={{ color: "#9CA3AF", fontSize: rs(13), textAlign: "center", paddingVertical: rp(12) }}>No drivers rostered on this event</Text>
                        ) : (
                          drivers.filter(d => d.assigned).map(d => (
                            <TouchableOpacity
                              key={d.id}
                              disabled={assigningDriver}
                              onPress={() => handleAssignDriver(d.id, d.duty_status === "busy", d.current_car_plate, d.name)}
                              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: rp(12), borderBottomWidth: rp(1), borderBottomColor: "#E5E7EB" }}
                            >
                              <View>
                                <Text style={{ fontWeight: "700", color: "#111827" }}>{d.name}</Text>
                                {d.duty_status === "busy" && d.current_car_plate && (
                                  <Text style={{ color: "#9CA3AF", fontSize: rs(11) }}>Busy with {d.current_car_plate}</Text>
                                )}
                              </View>
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
                      onPress={() => {
                        setShowCarModal(false);
                        router.push({
                          pathname: "/(admin)/car-log",
                          params: { car_id: selectedCar.id }
                        });
                      }}
                      style={{
                        backgroundColor: "#111827", borderRadius: rp(16),
                        paddingVertical: rp(14), alignItems: "center",
                        marginTop: rp(12), flexDirection: "row",
                        justifyContent: "center"
                      }}
                    >
                      <Ionicons name="time-outline" size={18} color="#fff" />
                      <Text style={{
                        color: "#fff", fontWeight: "900",
                        letterSpacing: rs(2), marginLeft: rp(8)
                      }}>VIEW FULL LOG</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setShowCarModal(false);
                        router.push({ pathname: "/(admin)/qr-display", params: { token: selectedCar.qr_token, plate: selectedCar.plate } });
                      }}
                      style={{ backgroundColor: "#7C3AED", borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(20) }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>VIEW QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeCar(selectedCar)}
                      style={{ borderWidth: rp(1.5), borderColor: "#F43F5E", borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(8), marginBottom: rp(16) }}
                    >
                      <Text style={{ color: "#F43F5E", fontWeight: "900", letterSpacing: rs(2) }}>REMOVE VEHICLE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowCarModal(false)} style={{ paddingVertical: rp(10), alignItems: "center", marginBottom: rp(12) }}>
                      <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showAddSupervisorModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, maxHeight: "90%" }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: rp(20), paddingBottom: rp(32) }}>
                <View style={{ alignItems: "center", marginBottom: rp(14) }}>
                  <View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} />
                </View>
                <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#0F2044", marginBottom: rp(20) }}>Add Supervisor</Text>

                <TouchableOpacity onPress={pickSupPhoto} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Supervisor Photo (optional)</Text>
                  {supPhoto ? (
                    <View style={{ position: "relative" }}>
                      <Image source={{ uri: supPhoto }} style={{ width: rp(80), height: rp(80), borderRadius: rp(40), borderWidth: rp(2), borderColor: "#0F2044" }} />
                      <TouchableOpacity onPress={() => setSupPhoto(null)} style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}>
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ width: rp(80), height: rp(80), borderRadius: rp(40), backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: "#E5E7EB", borderStyle: "dashed" }}>
                      <Ionicons name="person" size={32} color="#9CA3AF" />
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={modalLabel}>NAME <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={supName} onChangeText={t => { setSupName(t); if(errors.name) setErrors(prev => ({...prev, name: undefined})); }} placeholder="Full Name" style={[modalInput, errors.name && modalInputError]} />
                {errors.name && <Text style={modalErrorText}>* {errors.name}</Text>}

                <Text style={modalLabel}>EMAIL <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={supEmail} onChangeText={t => { setSupEmail(t); if(errors.email) setErrors(prev => ({...prev, email: undefined})); }} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" style={[modalInput, errors.email && modalInputError]} />
                {errors.email && <Text style={modalErrorText}>* {errors.email}</Text>}

                <Text style={modalLabel}>PHONE</Text>
                <TextInput value={supPhone} onChangeText={t => { setSupPhone(t); if(errors.phone) setErrors(prev => ({...prev, phone: undefined})); }} placeholder="10-digit mobile" keyboardType="phone-pad" style={[modalInput, errors.phone && modalInputError]} />
                {errors.phone && <Text style={modalErrorText}>* {errors.phone}</Text>}

                <Text style={modalLabel}>GENDER <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={{ flexDirection: 'row', gap: rp(10), marginBottom: rp(16) }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: rp(12), borderRadius: rp(12), borderWidth: rp(1), borderColor: errors.gender && !supGender ? '#EF4444' : supGender === 'male' ? '#1D4ED8' : '#E5E7EB', backgroundColor: supGender === 'male' ? '#EFF6FF' : '#FFF', alignItems: 'center' }}
                    onPress={() => setSupGender('male')}
                  >
                    <Text style={{ fontWeight: '600', color: supGender === 'male' ? '#1D4ED8' : '#4B5563', fontSize: rp(14) }}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: rp(12), borderRadius: rp(12), borderWidth: rp(1), borderColor: errors.gender && !supGender ? '#EF4444' : supGender === 'female' ? '#1D4ED8' : '#E5E7EB', backgroundColor: supGender === 'female' ? '#EFF6FF' : '#FFF', alignItems: 'center' }}
                    onPress={() => setSupGender('female')}
                  >
                    <Text style={{ fontWeight: '600', color: supGender === 'female' ? '#1D4ED8' : '#4B5563', fontSize: rp(14) }}>Female</Text>
                  </TouchableOpacity>
                </View>

                {/* <Text style={modalLabel}>PASSWORD</Text>
                <TextInput value={supPassword} onChangeText={setSupPassword} placeholder="Min 6 characters" secureTextEntry style={modalInput} /> */}

                <Text style={modalLabel}>PAN NUMBER</Text>
                <TextInput value={supPanNumber} onChangeText={setSupPanNumber} placeholder="ABCDE1234F" autoCapitalize="characters" style={modalInput} />

                <Text style={modalLabel}>BANK ACCOUNT NUMBER</Text>
                <TextInput value={supBankAccountNumber} onChangeText={t => { setSupBankAccountNumber(t); if(errors.bankAccount) setErrors(prev => ({...prev, bankAccount: undefined})); }} placeholder="Account Number" keyboardType="numeric" style={[modalInput, errors.bankAccount && modalInputError]} />
                {errors.bankAccount && <Text style={modalErrorText}>* {errors.bankAccount}</Text>}

                <Text style={modalLabel}>BANK IFSC</Text>
                <TextInput value={supBankIfsc} onChangeText={(v) => {
                  const upper = v.toUpperCase();
                  setSupBankIfsc(upper);
                  if (upper.length === 11) {
                    setSupIfscChecking(true);
                    api.get(`/utils/ifsc/${upper}`)
                      .then(res => { setSupIfscInfo(res.data); setSupIfscChecking(false); })
                      .catch((err) => {
                        if (err.response?.status === 404) {
                          setSupIfscInfo("error");
                        } else {
                          setSupIfscInfo("unverified");
                        }
                        setSupIfscChecking(false);
                      });
                  }
                }} placeholder="SBIN0001234" autoCapitalize="characters" maxLength={11} style={modalInput} />
                {supIfscChecking && <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>Checking IFSC...</Text>}
                {supIfscInfo === "unverified" && (
                  <Text style={{ color: "#D97706", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    Couldn't verify IFSC right now — you can still continue
                  </Text>
                )}
                {supIfscInfo && supIfscInfo !== "error" && supIfscInfo !== "unverified" && (
                  <Text style={{ color: "#059669", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    {supIfscInfo.bank} — {supIfscInfo.branch}, {supIfscInfo.city}
                  </Text>
                )}
                {supIfscInfo === "error" && (
                  <Text style={{ color: "#EF4444", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    Invalid IFSC Code
                  </Text>
                )}

                <Text style={modalLabel}>AADHAR NUMBER <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={supAadharNumber} onChangeText={v => { setSupAadharNumber(v.toUpperCase()); if(errors.aadharNumber) setErrors(prev => ({...prev, aadharNumber: undefined})); }} placeholder="Aadhar number" autoCapitalize="characters" style={[modalInput, errors.aadharNumber && modalInputError]} />
                {errors.aadharNumber && <Text style={modalErrorText}>* {errors.aadharNumber}</Text>}

                <TouchableOpacity onPress={pickSupAadharPhoto} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Aadhar Photo *</Text>
                  {errors.aadharPhoto && <Text style={[modalErrorText, {marginTop: rp(-4)}]}>* {errors.aadharPhoto}</Text>}
                  {supAadharPhotoUri ? (
                    <Image source={{ uri: supAadharPhotoUri }} style={{ width: rp(120), height: rp(80), borderRadius: rp(12), borderWidth: rp(2), borderColor: "#059669" }} />
                  ) : (
                    <View style={{ width: rp(120), height: rp(80), borderRadius: rp(12), backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: errors.aadharPhoto ? "#EF4444" : "#E5E7EB", borderStyle: "dashed" }}>
                      <Ionicons name="document-outline" size={28} color="#9CA3AF" />
                    </View>
                  )}
                </TouchableOpacity>


                <TouchableOpacity
                  onPress={saveSupervisor}
                  disabled={savingSupervisor}
                  style={{ backgroundColor: "#0F2044", borderRadius: rp(16), paddingVertical: rp(16), alignItems: "center", marginTop: rp(10), shadowColor: "#0F2044", shadowOpacity: 0.3, shadowRadius: rp(12), shadowOffset: { width: 0, height: rp(6) }, elevation: 6 }}
                >
                  {savingSupervisor ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>SAVE SUPERVISOR</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    resetSupForm();
                    setShowAddSupervisorModal(false);
                  }}
                  style={{ paddingVertical: rp(12), alignItems: "center", marginTop: rp(4) }}
                >
                  <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Driver Modal */}
      <Modal visible={showAddDriverModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, maxHeight: "90%" }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: rp(20), paddingBottom: rp(32) }}>
                <View style={{ alignItems: "center", marginBottom: rp(14) }}>
                  <View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} />
                </View>
                <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#059669", marginBottom: rp(20) }}>Add Driver</Text>

                <TouchableOpacity onPress={pickDriverPhoto} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Driver Photo (optional)</Text>
                  {drvPhotoUri ? (
                    <Image source={{ uri: drvPhotoUri }} style={{ width: rp(80), height: rp(80), borderRadius: rp(40), borderWidth: rp(2), borderColor: "#059669" }} />
                  ) : (
                    <View style={{ width: rp(80), height: rp(80), borderRadius: rp(40), backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: "#E5E7EB", borderStyle: "dashed" }}>
                      <Ionicons name="person" size={32} color="#9CA3AF" />
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={modalLabel}>NAME <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvName} onChangeText={t => { setDrvName(t); if(driverErrors.name) setDriverErrors(prev => ({...prev, name: undefined})); }} placeholder="Full Name" style={[modalInput, driverErrors.name && modalInputError]} />
                {driverErrors.name && <Text style={modalErrorText}>* {driverErrors.name}</Text>}
                <Text style={modalLabel}>PHONE <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvPhone} onChangeText={t => { setDrvPhone(t); if(driverErrors.phone) setDriverErrors(prev => ({...prev, phone: undefined})); }} placeholder="10-digit mobile" keyboardType="phone-pad" style={[modalInput, driverErrors.phone && modalInputError]} />
                {driverErrors.phone && <Text style={modalErrorText}>* {driverErrors.phone}</Text>}

                <Text style={modalLabel}>GENDER <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={{ flexDirection: 'row', gap: rp(10), marginBottom: rp(16) }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: rp(12), borderRadius: rp(12), borderWidth: rp(1), borderColor: driverErrors.gender && !drvGender ? '#EF4444' : drvGender === 'male' ? '#1D4ED8' : '#E5E7EB', backgroundColor: drvGender === 'male' ? '#EFF6FF' : '#FFF', alignItems: 'center' }}
                    onPress={() => setDrvGender('male')}
                  >
                    <Text style={{ fontWeight: '600', color: drvGender === 'male' ? '#1D4ED8' : '#4B5563', fontSize: rp(14) }}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: rp(12), borderRadius: rp(12), borderWidth: rp(1), borderColor: driverErrors.gender && !drvGender ? '#EF4444' : drvGender === 'female' ? '#1D4ED8' : '#E5E7EB', backgroundColor: drvGender === 'female' ? '#EFF6FF' : '#FFF', alignItems: 'center' }}
                    onPress={() => setDrvGender('female')}
                  >
                    <Text style={{ fontWeight: '600', color: drvGender === 'female' ? '#1D4ED8' : '#4B5563', fontSize: rp(14) }}>Female</Text>
                  </TouchableOpacity>
                </View>
                <Text style={modalLabel}>4-DIGIT PIN <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvPin} onChangeText={t => { setDrvPin(t); if(driverErrors.pin) setDriverErrors(prev => ({...prev, pin: undefined})); }} placeholder="4-digit PIN" keyboardType="numeric" maxLength={4} style={[modalInput, driverErrors.pin && modalInputError]} />
                {driverErrors.pin && <Text style={modalErrorText}>* {driverErrors.pin}</Text>}
                <Text style={modalLabel}>EMAIL <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvEmail} onChangeText={t => { setDrvEmail(t); if(driverErrors.email) setDriverErrors(prev => ({...prev, email: undefined})); }} placeholder="driver@example.com" autoCapitalize="none" keyboardType="email-address" style={[modalInput, driverErrors.email && modalInputError]} />
                {driverErrors.email && <Text style={modalErrorText}>* {driverErrors.email}</Text>}
                <Text style={modalLabel}>PAN CARD NUMBER</Text>
                <TextInput value={drvPan} onChangeText={(v) => setDrvPan(v.toUpperCase())} placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} style={modalInput} />
                <Text style={modalLabel}>BANK ACCOUNT NUMBER</Text>
                <TextInput value={drvBankAccount} onChangeText={setDrvBankAccount} placeholder="Account number" keyboardType="numeric" style={modalInput} />
                <Text style={modalLabel}>BANK IFSC CODE</Text>
                <TextInput value={drvBankIfsc} onChangeText={(v) => {
                  const upper = v.toUpperCase();
                  setDrvBankIfsc(upper);
                  if (upper.length === 11) {
                    setDrvIfscChecking(true);
                    api.get(`/utils/ifsc/${upper}`)
                      .then(res => { setDrvIfscInfo(res.data); setDrvIfscChecking(false); })
                      .catch((err) => {
                        if (err.response?.status === 404) {
                          setDrvIfscInfo("error");
                        } else {
                          setDrvIfscInfo("unverified");
                        }
                        setDrvIfscChecking(false);
                      });
                  }
                }} placeholder="SBIN0001234" autoCapitalize="characters" maxLength={11} style={modalInput} />
                {drvIfscChecking && <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>Checking IFSC...</Text>}
                {drvIfscInfo === "unverified" && (
                  <Text style={{ color: "#D97706", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    Couldn't verify IFSC right now — you can still continue
                  </Text>
                )}
                {drvIfscInfo && drvIfscInfo !== "error" && drvIfscInfo !== "unverified" && (
                  <Text style={{ color: "#059669", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    {drvIfscInfo.bank} — {drvIfscInfo.branch}, {drvIfscInfo.city}
                  </Text>
                )}
                {drvIfscInfo === "error" && (
                  <Text style={{ color: "#EF4444", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    Invalid IFSC Code
                  </Text>
                )}
                <Text style={modalLabel}>DRIVING LICENCE NUMBER <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvLicenseNumber} onChangeText={v => { setDrvLicenseNumber(v.toUpperCase()); if(driverErrors.licenseNumber) setDriverErrors(prev => ({...prev, licenseNumber: undefined})); }} placeholder="DL number" autoCapitalize="characters" style={[modalInput, driverErrors.licenseNumber && modalInputError]} />
                {driverErrors.licenseNumber && <Text style={modalErrorText}>* {driverErrors.licenseNumber}</Text>}

                <TouchableOpacity onPress={pickLicensePhoto} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Licence Photo *</Text>
                  {driverErrors.licensePhoto && <Text style={[modalErrorText, {marginTop: rp(-4)}]}>* {driverErrors.licensePhoto}</Text>}
                  {drvLicensePhotoUri ? (
                    <Image source={{ uri: drvLicensePhotoUri }} style={{ width: rp(120), height: rp(80), borderRadius: rp(12), borderWidth: rp(2), borderColor: "#059669" }} />
                  ) : (
                    <View style={{ width: rp(120), height: rp(80), borderRadius: rp(12), backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: driverErrors.licensePhoto ? "#EF4444" : "#E5E7EB", borderStyle: "dashed" }}>
                      <Ionicons name="document-outline" size={28} color="#9CA3AF" />
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={modalLabel}>AADHAR NUMBER <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvAadharNumber} onChangeText={v => { setDrvAadharNumber(v.toUpperCase()); if(driverErrors.aadharNumber) setDriverErrors(prev => ({...prev, aadharNumber: undefined})); }} placeholder="Aadhar number" autoCapitalize="characters" style={[modalInput, driverErrors.aadharNumber && modalInputError]} />
                {driverErrors.aadharNumber && <Text style={modalErrorText}>* {driverErrors.aadharNumber}</Text>}

                <TouchableOpacity onPress={pickAadharPhoto} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Aadhar Photo *</Text>
                  {driverErrors.aadharPhoto && <Text style={[modalErrorText, {marginTop: rp(-4)}]}>* {driverErrors.aadharPhoto}</Text>}
                  {drvAadharPhotoUri ? (
                    <Image source={{ uri: drvAadharPhotoUri }} style={{ width: rp(120), height: rp(80), borderRadius: rp(12), borderWidth: rp(2), borderColor: "#059669" }} />
                  ) : (
                    <View style={{ width: rp(120), height: rp(80), borderRadius: rp(12), backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: driverErrors.aadharPhoto ? "#EF4444" : "#E5E7EB", borderStyle: "dashed" }}>
                      <Ionicons name="document-outline" size={28} color="#9CA3AF" />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={saveDriver}
                  disabled={savingDriver}
                  style={{ backgroundColor: "#059669", borderRadius: rp(16), paddingVertical: rp(16), alignItems: "center", marginTop: rp(10), shadowColor: "#059669", shadowOpacity: 0.3, shadowRadius: rp(12), shadowOffset: { width: 0, height: rp(6) }, elevation: 6 }}
                >
                  {savingDriver ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>SAVE DRIVER</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    resetDrvForm();
                    setShowAddDriverModal(false);
                  }}
                  style={{ paddingVertical: rp(12), alignItems: "center", marginTop: rp(4) }}
                >
                  <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showIncidentModal}
        animationType="slide"
        transparent
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
            <View style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 36, borderTopRightRadius: 36,
              padding: rp(20), maxHeight: "92%"
            }}>

              {/* Handle */}
              <View style={{ alignItems: "center", marginBottom: rp(14) }}>
                <View style={{
                  backgroundColor: "#D1D5DB", width: rp(48),
                  height: rp(4), borderRadius: rp(99)
                }} />
              </View>

              {/* Header */}
              <View style={{
                flexDirection: "row", alignItems: "center",
                marginBottom: rp(16)
              }}>
                <View style={{
                  backgroundColor: "#FEF3C7",
                  borderRadius: rp(99), padding: rp(8), marginRight: rp(10)
                }}>
                  <Ionicons name="warning" size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: rs(18), fontWeight: "900",
                    color: "#111827"
                  }}>Report Incident</Text>
                  <Text style={{
                    fontSize: rs(12), color: "#9CA3AF",
                    marginTop: rp(2)
                  }}>
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
                <Text style={{
                  fontSize: rs(11), fontWeight: "800",
                  color: "#6B7280", letterSpacing: rs(2), marginBottom: rp(8)
                }}>
                  SELECT CAR *
                </Text>
                {!incidentCar ? (
                  <>
                    <View style={{
                      backgroundColor: "#F9FAFB",
                      borderRadius: rp(14), borderWidth: rp(1),
                      borderColor: "#E5E7EB", flexDirection: "row",
                      alignItems: "center", paddingHorizontal: rp(12),
                      marginBottom: rp(6)
                    }}>
                      <Ionicons name="search" size={16} color="#7C3AED" />
                      <TextInput
                        value={incidentCarSearch}
                        onChangeText={setIncidentCarSearch}
                        placeholder="Search plate number..."
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="characters"
                        style={{
                          flex: 1, paddingVertical: rp(13),
                          paddingLeft: rp(8), color: "#111827", fontWeight: "700"
                        }}
                      />
                      {incidentCarSearch.length > 0 && (
                        <TouchableOpacity onPress={() => setIncidentCarSearch("")}>
                          <Ionicons name="close-circle" size={18} color="#D1D5DB" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {incidentCarSearch.length > 1 && (
                      <View style={{
                        backgroundColor: "#fff",
                        borderRadius: rp(14), borderWidth: rp(1),
                        borderColor: "#E5E7EB", marginBottom: rp(12),
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
                                borderBottomColor: "#F3F4F6",
                                flexDirection: "row",
                                alignItems: "center"
                              }}
                            >
                              <View style={{
                                backgroundColor: "#F3F4F6",
                                borderRadius: rp(8), padding: rp(6),
                                marginRight: rp(10)
                              }}>
                                <Ionicons name="car-outline" size={16}
                                  color="#374151" />
                              </View>
                              <View>
                                <Text style={{
                                  fontWeight: "900",
                                  color: "#111827"
                                }}>{c.plate}</Text>
                                <Text style={{
                                  color: "#6B7280",
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
                              <Text style={{ color: "#9CA3AF", fontSize: rs(13) }}>
                                No cars found
                              </Text>
                            </View>
                          )}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={{
                    backgroundColor: "#D1FAE5",
                    borderRadius: rp(12), padding: rp(12), marginBottom: rp(16),
                    flexDirection: "row", alignItems: "center"
                  }}>
                    <Ionicons name="checkmark-circle" size={18}
                      color="#059669" />
                    <Text style={{
                      color: "#059669", fontWeight: "800",
                      marginLeft: rp(8), flex: 1
                    }}>
                      {incidentCar.plate} · {incidentCar.color} {incidentCar.make}
                    </Text>
                    <TouchableOpacity onPress={() => {
                      setIncidentCar(null);
                      setIncidentType(""); setIncidentCarSearch("");
                    }}>
                      <Ionicons name="close-circle" size={20} color="#059669" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Driver select */}
                <Text style={{
                  fontSize: rs(11), fontWeight: "800",
                  color: "#6B7280", letterSpacing: rs(2), marginBottom: rp(8)
                }}>
                  DRIVER INVOLVED (OPTIONAL)
                </Text>
                <ScrollView
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
                            ? "#7C3AED" : "#fff",
                        borderColor:
                          (incidentDriver?.id ?? null) === d.id
                            ? "#7C3AED" : "#E5E7EB",
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
                </ScrollView>

                {/* Incident Type Picker */}
                <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(2), marginBottom: rp(8) }}>
                  INCIDENT TYPE *
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: rp(16) }}>
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
                          borderColor: incidentType === t.key ? "#7C3AED" : "#E5E7EB",
                          backgroundColor: incidentType === t.key ? "#7C3AED" : "#F9FAFB",
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

                {/* Description */}
                <Text style={{
                  fontSize: rs(11), fontWeight: "800",
                  color: "#6B7280", letterSpacing: rs(2), marginBottom: rp(8)
                }}>
                  DESCRIPTION *
                </Text>
                <TextInput
                  value={incidentDesc}
                  onChangeText={setIncidentDesc}
                  placeholder="Describe what happened..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  style={{
                    backgroundColor: "#F9FAFB", borderRadius: rp(14),
                    borderWidth: rp(1), borderColor: "#E5E7EB", padding: rp(14),
                    color: "#111827", textAlignVertical: "top",
                    minHeight: 110, marginBottom: rp(16), fontSize: rs(14),
                    lineHeight: 22
                  }}
                />

                {/* Photo */}
                <TouchableOpacity
                  onPress={pickIncidentPhoto}
                  style={{
                    borderWidth: rp(1.5),
                    borderColor: incidentPhoto ? "#059669" : "#E5E7EB",
                    borderStyle: incidentPhoto ? "solid" : "dashed",
                    borderRadius: rp(14), padding: rp(16), alignItems: "center",
                    marginBottom: rp(20),
                    backgroundColor: incidentPhoto
                      ? "#D1FAE5" : "#FAFAFA"
                  }}
                >
                  <Ionicons
                    name={incidentPhoto
                      ? "checkmark-circle" : "camera-outline"}
                    size={26}
                    color={incidentPhoto ? "#059669" : "#9CA3AF"}
                  />
                  <Text style={{
                    color: incidentPhoto ? "#059669" : "#9CA3AF",
                    marginTop: rp(6), fontWeight: "700", fontSize: rs(13)
                  }}>
                    {incidentPhoto
                      ? "Photo Added ✓ (tap to retake)"
                      : "Add Photo (Optional)"}
                  </Text>
                  {incidentPhoto && (
                    <TouchableOpacity onPress={() => setIncidentPhoto(null)} style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}>
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
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
                      submittingIncident ? "#D1D5DB" : "#F59E0B",
                    borderRadius: rp(18), paddingVertical: rp(18),
                    alignItems: "center", marginBottom: rp(24),
                    shadowColor: "#F59E0B", shadowOpacity: 0.35,
                    shadowRadius: rp(12),
                    shadowOffset: { width: 0, height: rp(6) },
                    elevation: 6
                  }}
                >
                  {submittingIncident ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{
                      color: "#fff", fontWeight: "900",
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
                <View style={{ backgroundColor: "#E0E7FF", borderRadius: rp(99), padding: rp(8), marginRight: rp(10) }}>
                  <Ionicons name="shield-checkmark" size={20} color="#4F46E5" />
                </View>
                <Text style={{ fontSize: rs(18), fontWeight: "900", color: "#111827", flex: 1 }}>Update Status</Text>
                <TouchableOpacity onPress={() => setShowResolveModal(false)}>
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
                        backgroundColor: resolveStatus === statusVal ? "#7C3AED" : "#fff",
                        borderColor: resolveStatus === statusVal ? "#7C3AED" : "#E5E7EB"
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
                  onChangeText={setResolveRemark}
                  placeholder="Details about the resolution..."
                  multiline
                  style={[modalInput, { minHeight: rp(100), textAlignVertical: "top" }]}
                />
                <TouchableOpacity
                  onPress={submitResolve}
                  disabled={submittingResolve}
                  style={{
                    backgroundColor: "#7C3AED",
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
    </View>
  );
}

const iconBtn = {
  backgroundColor: "rgba(255,255,255,0.15)",
  borderRadius: rp(99),
  padding: rp(8),
};

const modalLabel = {
  fontSize: rs(11),
  fontWeight: "800",
  color: "#6B7280",
  letterSpacing: rs(3),
  marginBottom: rp(8),
};

const modalInputError = { borderColor: "#EF4444" };
const modalErrorText = { color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) };
const modalInput = {
  backgroundColor: "#F9FAFB",
  borderRadius: rp(14),
  borderWidth: rp(1),
  borderColor: "#E5E7EB",
  padding: rp(14),
  color: "#111827",
  marginBottom: rp(16),
  fontSize: rs(15),
  fontWeight: "700",
};