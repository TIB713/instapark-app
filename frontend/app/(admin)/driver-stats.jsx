import { useEffect, useState } from "react";
import { rs, rp } from '../../utils/responsive';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function DriverStats() {
  const router = useRouter();
  const { driverId, driverName } = useLocalSearchParams();
  const { setCurrentEventId } = useAppStore();
  const [tab, setTab] = useState("performance");
  const [stats, setStats] = useState({ cars_checked_in: 0, cars_retrieved: 0 });
  const [filter, setFilter] = useState("all");
  const [filteredStats, setFilteredStats] = useState({ cars_checked_in: 0, cars_retrieved: 0 });
  const [driver, setDriver] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [aadharNumber, setAadharNumber] = useState("");
  const [aadharPhoto, setAadharPhoto] = useState(null);
  const [licensePhoto, setLicensePhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [events, setEvents] = useState([]);
  const [evtFilter, setEvtFilter] = useState("active");
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/drivers/${driverId}/stats`);
        setStats(data);
      } catch {}
      try {
        const { data } = await api.get(`/drivers/${driverId}`);
        setDriver(data);
        setName(data.name || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setPanNumber(data.pan_number || "");
        setBankAccount(data.bank_account_number || "");
        setBankIfsc(data.bank_ifsc || "");
        setLicenseNumber(data.driving_license_number || "");
        setLicensePhoto(data.driving_license_photo || null);
        setAadharNumber(data.aadhar_number || "");
        setAadharPhoto(data.aadhar_photo || null);
      } catch {}
    })();
  }, [driverId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/drivers/${driverId}/stats/filtered?filter=${filter}`);
        setFilteredStats(data);
      } catch {}
    })();
  }, [filter, driverId]);

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const { data: evs } = await api.get("/events");
      const results = [];
      const limited = (evs || []).slice(0, 20);
      for (const e of limited) {
        try {
          const { data: drs } = await api.get(`/events/${e.id}/drivers`);
          const found = drs.find((d) => d.id === driverId && d.assigned);
          if (found) results.push({ ...e, cars_checked_in: found.cars_checked_in, cars_retrieved: found.cars_retrieved });
        } catch {}
      }
      setEvents(results);
    } catch {}
    setLoadingEvents(false);
  };

  useEffect(() => { if (tab === "history") loadEvents(); }, [tab]);

  const validateDriver = () => {
    const errs = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!phone.trim()) errs.phone = "Phone is required";
    else if (!/^\d{10}$/.test(phone.trim().replace(/\D/g, ""))) errs.phone = "Please enter a valid 10-digit phone number";
    if (pin && !/^\d{4}$/.test(pin)) errs.pin = "PIN must be exactly 4 digits";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Please enter a valid email address";
    if (panNumber.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber.trim().toUpperCase())) errs.panNumber = "Expected format: ABCDE1234F";
    if (bankAccount.trim() && !/^\d{9,18}$/.test(bankAccount.trim())) errs.bankAccount = "Must be 9-18 digits";
    if (bankIfsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc.trim().toUpperCase())) errs.bankIfsc = "Expected format: ABCD0123456";
    if (!licenseNumber.trim()) errs.licenseNumber = "Driving License Number is required";
    else if (!/^[A-Z0-9]{10,16}$/.test(licenseNumber.trim().toUpperCase())) errs.licenseNumber = "Must be 10-16 alphanumeric characters";
    if (!licensePhoto) errs.licensePhoto = "License Photo is required";
    if (!aadharNumber.trim()) errs.aadharNumber = "Aadhar Number is required";
    else if (!/^\d{12}$/.test(aadharNumber.trim())) errs.aadharNumber = "Aadhar number must be exactly 12 digits";
    if (!aadharPhoto) errs.aadharPhoto = "Aadhar Photo is required";
    return errs;
  };

  const saveDriver = async () => {
    const errs = validateDriver();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      Alert.alert("Validation Error", "Please check the highlighted fields");
      return;
    }
    setErrors({});
    try {
      const body = { name, phone };
      if (pin && pin.length === 4) body.pin = pin;
      if (email.trim()) body.email = email.trim();
      if (panNumber.trim()) body.pan_number = panNumber.trim();
      if (bankAccount.trim()) body.bank_account_number = bankAccount.trim();
      if (bankIfsc.trim()) body.bank_ifsc = bankIfsc.trim();
      if (licenseNumber.trim()) body.driving_license_number = licenseNumber.trim();
      if (licensePhoto) body.driving_license_photo = licensePhoto;
      if (aadharNumber.trim()) body.aadhar_number = aadharNumber.trim();
      if (aadharPhoto) body.aadhar_photo = aadharPhoto;
      await api.patch(`/drivers/${driverId}`, body);
      Alert.alert("Updated", "Driver updated successfully");
      setPin("");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed");
    }
  };

  const toggleActive = async () => {
    try {
      await api.patch(`/drivers/${driverId}`, { is_active: !driver.is_active });
      setDriver({ ...driver, is_active: !driver.is_active });
    } catch {
      Alert.alert("Error", "Failed to update driver status");
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Driver",
      "WARNING: This will permanently delete this driver and cannot be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/superadmin/drivers/${driverId}/permanent`);
              Alert.alert("Deleted", "Driver permanently deleted");
              router.back();
            } catch {
              Alert.alert("Error", "Failed to delete driver");
            }
          },
        },
      ]
    );
  };

  const pickAadharPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Photo library access is required");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      try {
        const formData = new FormData();
        formData.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
        formData.append("folder", "aadhar_photos");
        const up = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setAadharPhoto(up.data.url);
        setErrors(prev => ({ ...prev, aadharPhoto: undefined }));
        Alert.alert("Success", "Aadhar photo uploaded");
      } catch (e) {
        Alert.alert("Error", "Failed to upload photo");
      }
    }
  };

  const pickLicensePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Photo library access is required");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      try {
        const formData = new FormData();
        formData.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
        formData.append("folder", "drivers/licenses");
        const up = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setLicensePhoto(up.data.url);
        setErrors(prev => ({ ...prev, licensePhoto: undefined }));
        Alert.alert("Success", "License photo uploaded");
      } catch (e) {
        Alert.alert("Error", "Failed to upload photo");
      }
    }
  };

  const openEvent = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(admin)/event-detail");
  };

  const exportPDF = async () => {
    if (!driver) return;
    setExportingPDF(true);
    try {
      const { data: report } = await api.get(`/drivers/${driverId}/report`);
      const incidents = report.incidents || [];
      
      const eventRows = events.map(e => `
        <tr>
          <td>${e.name}</td>
          <td>${e.venue || "—"}</td>
          <td>${e.date}</td>
          <td>${(e.cars_checked_in || 0) + (e.cars_retrieved || 0)}</td>
          <td>${e.status?.toUpperCase()}</td>
        </tr>
      `).join("");

      const incidentRows = incidents.length > 0 
        ? incidents.map(i => `
          <tr>
            <td>${new Date(i.created_at).toLocaleDateString("en-IN", { timeZone: 'Asia/Kolkata' })}</td>
            <td>${i.plate}</td>
            <td>${i.description}</td>
          </tr>
        `).join("")
        : '<tr><td colspan="3" style="text-align:center;color:#9CA3AF;">No incidents recorded</td></tr>';

      const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,sans-serif;color:#111827;font-size:12px;line-height:1.5;}
        .header{background:#7C3AED;color:white;padding:24px 28px;}
        .header h1{font-size:22px;font-weight:900;}
        .header p{opacity:0.8;margin-top:3px;font-size:12px;}
        .section{padding:20px 28px;border-bottom:1px solid #f3f4f6;}
        .section h2{font-size:11px;font-weight:800;color:#7C3AED;letter-spacing:3px;margin-bottom:12px;text-transform:uppercase;}
        .stats{display:flex;gap:12px;flex-wrap:wrap;}
        .stat{background:#f9fafb;border-radius:10px;padding:12px 16px;text-align:center;min-width:110px;}
        .stat-val{font-size:22px;font-weight:900;color:#111827;}
        .stat-lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-top:3px;}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;}
        th{padding:8px;text-align:left;background:#f9fafb;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;}
        td{padding:8px;border-bottom:1px solid #f3f4f6;}
        .footer{padding:16px 28px;text-align:center;color:#9ca3af;font-size:10px;}
      </style></head><body>
      <div class="header">
        <h1>Driver Performance Report</h1>
        <p>${driver.name} · ${driver.employee_id || "ID: —"}</p>
        <p style="margin-top:6px;font-size:10px;opacity:0.6;">Generated ${new Date().toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</p>
      </div>
      <div class="section">
        <h2>Driver Information</h2>
        <p><strong>Name:</strong> ${driver.name}</p>
        <p><strong>Employee ID:</strong> ${driver.employee_id || "—"}</p>
        <p><strong>Phone:</strong> ${driver.phone || "—"}</p>
        <p><strong>Email:</strong> ${driver.email || "—"}</p>
      </div>
      <div class="section">
        <h2>Lifetime Stats Summary</h2>
        <div class="stats">
          <div class="stat"><div class="stat-val">${events.length}</div><div class="stat-lbl">Total Events</div></div>
          <div class="stat"><div class="stat-val">${stats.cars_checked_in}</div><div class="stat-lbl">Total Check-ins</div></div>
          <div class="stat"><div class="stat-val">${stats.cars_retrieved}</div><div class="stat-lbl">Total Retrievals</div></div>
          <div class="stat"><div class="stat-val">${report.platform_avg_rating || "—"}</div><div class="stat-lbl">Platform Rating</div></div>
          <div class="stat"><div class="stat-val">${report.driver_avg_rating || "—"}</div><div class="stat-lbl">Driver Rating</div></div>
          <div class="stat"><div class="stat-val" style="color:${incidents.length > 0 ? "#EF4444" : "#111827"}">${incidents.length}</div><div class="stat-lbl">Incidents</div></div>
        </div>
      </div>
      <div class="section">
        <h2>Events History</h2>
        <table><thead><tr><th>Event</th><th>Venue</th><th>Date</th><th>Cars</th><th>Status</th></tr></thead>
        <tbody>${eventRows}</tbody></table>
      </div>
      <div class="section">
        <h2>Incidents List</h2>
        <table><thead><tr><th>Date</th><th>Plate</th><th>Description</th></tr></thead>
        <tbody>${incidentRows}</tbody></table>
      </div>
      <div class="footer">InstaPark — Driver Performance Report · ${driver.name}</div>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const filename = `${driver.name.replace(/\s+/g, "_")}_stats.pdf`;
      const dest = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      await Sharing.shareAsync(dest, { mimeType: "application/pdf", dialogTitle: `${driver.name} — Performance Report` });
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to generate PDF report");
    } finally {
      setExportingPDF(false);
    }
  };

  const filteredEvts = events.filter((e) => evtFilter === "all" || e.status === evtFilter);

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
        <View
          style={{
            backgroundColor: "#7C3AED",
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
            paddingBottom: rp(18),
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8) }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={exportPDF}
              disabled={exportingPDF}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8), marginLeft: rp(10) }}
            >
              {exportingPDF ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="download-outline" size={22} color="#fff" />
              )}
            </TouchableOpacity>
            <View style={{ marginLeft: rp(14), flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: rs(11), letterSpacing: rs(1.5) }}>DRIVER</Text>
              <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900" }}>{driverName}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Tabs */}
      <View style={{ flexDirection: "row", backgroundColor: "#fff", marginHorizontal: rp(16), marginTop: -22, borderRadius: rp(20), padding: rp(4), ...cardShadow }}>
        {[["performance", "Lifetime"], ["history", "Events"]].map(([k, l]) => (
          <TouchableOpacity
            key={k}
            onPress={() => setTab(k)}
            style={{
              flex: 1,
              paddingVertical: rp(10),
              borderRadius: rp(16),
              backgroundColor: tab === k ? "#7C3AED" : "transparent",
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: rs(13), color: tab === k ? "#fff" : "#6B7280", letterSpacing: rs(1) }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {driver && (
        <View style={{ marginHorizontal: rp(16), marginTop: rp(12), backgroundColor: "#fff", borderRadius: rp(20), padding: rp(14), flexDirection: "row", alignItems: "center", gap: rp(14), ...cardShadow }}>
          {driver.driver_photo ? (
            <Image source={{ uri: driver.driver_photo }} style={{ width: rp(56), height: rp(56), borderRadius: rp(28) }} />
          ) : (
            <View style={{ width: rp(56), height: rp(56), borderRadius: rp(28), backgroundColor: "#F3F0FF", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="person" size={28} color="#7C3AED" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "900", fontSize: rs(16), color: "#111827" }}>{driver.name}</Text>
            <Text style={{ fontSize: rs(12), color: "#6B7280", marginTop: rp(1) }}>{driver.employee_id}</Text>
            <View style={{ flexDirection: "row", gap: rp(6), marginTop: rp(5), flexWrap: "wrap" }}>
              <View
                style={{
                  backgroundColor: driver.is_active ? "#D1FAE5" : "#FEE2E2",
                  paddingHorizontal: rp(8),
                  paddingVertical: rp(2),
                  borderRadius: rp(99),
                }}
              >
                <Text style={{ color: driver.is_active ? "#059669" : "#EF4444", fontSize: rs(10), fontWeight: "800" }}>
                  {driver.is_active ? "ACTIVE ✓" : "INACTIVE ✗"}
                </Text>
              </View>
              {driver.phone ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: rp(3), backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(99) }}>
                  <Ionicons name="call-outline" size={10} color="#6B7280" />
                  <Text style={{ color: "#6B7280", fontSize: rs(10), fontWeight: "700" }}>{driver.phone}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {tab === "performance" ? (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
        >
          <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(10) }}>TIME RANGE</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: rp(8), paddingBottom: rp(4) }} showsHorizontalScrollIndicator={false}>
            {[["week", "This Week"], ["month", "This Month"], ["quarter", "Last 3 Months"], ["all", "All Time"]].map(([f, l]) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: rp(14),
                  paddingVertical: rp(8),
                  borderRadius: rp(99),
                  backgroundColor: filter === f ? "#7C3AED" : "#fff",
                  borderWidth: rp(1),
                  borderColor: filter === f ? "#7C3AED" : "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: rs(11), fontWeight: "800", color: filter === f ? "#fff" : "#6B7280", letterSpacing: rs(1) }}>{l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: rp(12), marginTop: rp(14) }}>
            <View style={[{ flex: 1, backgroundColor: "#fff", borderRadius: rp(24), padding: rp(16) }, cardShadow]}>
              <Text style={{ color: "#6B7280", fontSize: rs(11), fontWeight: "800", letterSpacing: rs(2) }}>CHECKED IN</Text>
              <Text style={{ color: "#7C3AED", fontSize: rs(24), fontWeight: "900", marginTop: rp(6) }}>{filteredStats.cars_checked_in}</Text>
            </View>
            <View style={[{ flex: 1, backgroundColor: "#fff", borderRadius: rp(24), padding: rp(16) }, cardShadow]}>
              <Text style={{ color: "#6B7280", fontSize: rs(11), fontWeight: "800", letterSpacing: rs(2) }}>RETRIEVED</Text>
              <Text style={{ color: "#059669", fontSize: rs(24), fontWeight: "900", marginTop: rp(6) }}>{filteredStats.cars_retrieved}</Text>
            </View>
          </View>

          {driver && (
            <>
              <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginTop: rp(24), marginBottom: rp(10) }}>EDIT DRIVER</Text>
          <View style={[{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(18) }, cardShadow]}>
            <Text style={miniLabel}>NAME <Text style={{ color: "#EF4444" }}>*</Text></Text>
            <View style={[miniInput, errors.name && { borderColor: "#EF4444" }]}>
              <Ionicons name="person-outline" size={16} color="#7C3AED" />
              <TextInput value={name} onChangeText={setName} style={miniInputText} />
            </View>
            {errors.name && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(2) }}>{errors.name}</Text>}
            <Text style={miniLabel}>PHONE <Text style={{ color: "#EF4444" }}>*</Text></Text>
            <View style={[miniInput, errors.phone && { borderColor: "#EF4444" }]}>
              <Ionicons name="call-outline" size={16} color="#7C3AED" />
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={miniInputText} />
            </View>
            {errors.phone && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(2) }}>{errors.phone}</Text>}
            <Text style={miniLabel}>NEW PIN (LEAVE BLANK TO KEEP)</Text>
            <View style={[miniInput, errors.pin && { borderColor: "#EF4444" }]}>
              <Ionicons name="keypad-outline" size={16} color="#7C3AED" />
              <TextInput value={pin} onChangeText={setPin} keyboardType="numeric" maxLength={4} secureTextEntry style={miniInputText} />
            </View>
            {errors.pin && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(2) }}>{errors.pin}</Text>}
            <Text style={miniLabel}>EMAIL</Text>
            <View style={[miniInput, errors.email && { borderColor: "#EF4444" }]}>
              <Ionicons name="mail-outline" size={16} color="#7C3AED" />
              <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="email@example.com" placeholderTextColor="#9CA3AF" style={miniInputText} />
            </View>
            {errors.email && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(2) }}>{errors.email}</Text>}
            <Text style={miniLabel}>PAN CARD NUMBER</Text>
            <View style={[miniInput, errors.panNumber && { borderColor: "#EF4444" }]}>
              <Ionicons name="card-outline" size={16} color="#7C3AED" />
              <TextInput value={panNumber} onChangeText={v => setPanNumber(v.toUpperCase())} autoCapitalize="characters" maxLength={10} placeholder="ABCDE1234F" placeholderTextColor="#9CA3AF" style={miniInputText} />
            </View>
            {errors.panNumber && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(2) }}>{errors.panNumber}</Text>}
            <Text style={miniLabel}>BANK ACCOUNT NUMBER</Text>
            <View style={[miniInput, errors.bankAccount && { borderColor: "#EF4444" }]}>
              <Ionicons name="business-outline" size={16} color="#7C3AED" />
              <TextInput value={bankAccount} onChangeText={setBankAccount} keyboardType="numeric" placeholder="Account number" placeholderTextColor="#9CA3AF" style={miniInputText} />
            </View>
            {errors.bankAccount && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(2) }}>{errors.bankAccount}</Text>}
            <Text style={miniLabel}>BANK IFSC CODE</Text>
            <View style={[miniInput, errors.bankIfsc && { borderColor: "#EF4444" }]}>
              <Ionicons name="business-outline" size={16} color="#7C3AED" />
              <TextInput value={bankIfsc} onChangeText={v => setBankIfsc(v.toUpperCase())} autoCapitalize="characters" maxLength={11} placeholder="SBIN0001234" placeholderTextColor="#9CA3AF" style={miniInputText} />
            </View>
            {errors.bankIfsc && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(2) }}>{errors.bankIfsc}</Text>}
            <Text style={miniLabel}>DRIVING LICENSE NUMBER <Text style={{ color: "#EF4444" }}>*</Text></Text>
            <View style={[miniInput, errors.licenseNumber && { borderColor: "#EF4444" }]}>
              <Ionicons name="document-text-outline" size={16} color="#7C3AED" />
              <TextInput value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" placeholder="DL number" placeholderTextColor="#9CA3AF" style={miniInputText} />
            </View>
            {errors.licenseNumber && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(2) }}>{errors.licenseNumber}</Text>}
            <TouchableOpacity onPress={pickLicensePhoto} style={{ alignItems: "center", marginBottom: rp(16), marginTop: rp(8) }}>
              <Text style={miniLabel}>LICENSE PHOTO <Text style={{ color: "#EF4444" }}>*</Text></Text>
              {licensePhoto ? (
                <View style={{ position: "relative", marginTop: rp(8) }}>
                  <Image source={{ uri: licensePhoto }} style={{ width: rp(120), height: rp(80), borderRadius: rp(12), borderWidth: rp(2), borderColor: errors.licensePhoto ? "#EF4444" : "#7C3AED" }} />
                  <TouchableOpacity 
                    onPress={() => setLicensePhoto(null)} 
                    style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.9)", borderRadius: rp(99), padding: rp(2) }}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ width: rp(120), height: rp(80), borderRadius: rp(12), backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center", borderWidth: rp(1), borderColor: errors.licensePhoto ? "#EF4444" : "#E5E7EB", borderStyle: "dashed", marginTop: rp(8) }}>
                  <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                </View>
              )}
            </TouchableOpacity>
            {errors.licensePhoto && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", textAlign: 'center', marginTop: rp(4) }}>* {errors.licensePhoto}</Text>}
            <Text style={miniLabel}>AADHAR NUMBER <Text style={{ color: "#EF4444" }}>*</Text></Text>
            <View style={[miniInput, errors.aadharNumber && { borderColor: "#EF4444" }]}>
              <Ionicons name="document-text-outline" size={16} color="#7C3AED" />
              <TextInput value={aadharNumber} onChangeText={setAadharNumber} autoCapitalize="none" placeholder="Aadhar number" placeholderTextColor="#9CA3AF" style={miniInputText} />
            </View>
            {errors.aadharNumber && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(2) }}>{errors.aadharNumber}</Text>}
            <TouchableOpacity onPress={pickAadharPhoto} style={{ alignItems: "center", marginBottom: rp(16), marginTop: rp(8) }}>
              <Text style={miniLabel}>AADHAR PHOTO <Text style={{ color: "#EF4444" }}>*</Text></Text>
              {aadharPhoto ? (
                <View style={{ position: "relative", marginTop: rp(8) }}>
                  <Image source={{ uri: aadharPhoto }} style={{ width: rp(120), height: rp(80), borderRadius: rp(12), borderWidth: rp(2), borderColor: errors.aadharPhoto ? "#EF4444" : "#7C3AED" }} />
                  <TouchableOpacity 
                    onPress={() => setAadharPhoto(null)} 
                    style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.9)", borderRadius: rp(99), padding: rp(2) }}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ width: rp(120), height: rp(80), borderRadius: rp(12), backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center", borderWidth: rp(1), borderColor: errors.aadharPhoto ? "#EF4444" : "#E5E7EB", borderStyle: "dashed", marginTop: rp(8) }}>
                  <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                </View>
              )}
            </TouchableOpacity>
            {errors.aadharPhoto && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", textAlign: 'center', marginTop: rp(4) }}>* {errors.aadharPhoto}</Text>}
            <TouchableOpacity
              onPress={saveDriver}
              style={{ backgroundColor: "#7C3AED", borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(4) }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>SAVE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  driver.is_active ? "Deactivate Driver" : "Activate Driver",
                  driver.is_active
                    ? "This driver will be marked inactive. Continue?"
                    : "This driver will be marked active again. Continue?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Confirm", onPress: toggleActive },
                  ]
                );
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: rp(6),
                backgroundColor: driver.is_active ? "#FEE2E2" : "#D1FAE5",
                borderRadius: rp(12),
                paddingVertical: rp(12),
                marginTop: rp(8),
              }}
            >
              <Ionicons name={driver.is_active ? "close-circle-outline" : "checkmark-circle-outline"} size={16} color={driver.is_active ? "#EF4444" : "#059669"} />
              <Text style={{ color: driver.is_active ? "#EF4444" : "#059669", fontWeight: "800", fontSize: rs(13) }}>
                {driver.is_active ? "Deactivate Driver" : "Activate Driver"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: rp(6),
                backgroundColor: "#FEE2E2",
                borderRadius: rp(12),
                paddingVertical: rp(12),
                marginTop: rp(8),
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={{ color: "#EF4444", fontWeight: "800", fontSize: rs(13) }}>Delete Driver</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
          <View style={{ height: rp(40) }} />
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(16) }}
          contentContainerStyle={{ paddingBottom: rp(100) }}
        >
          <ScrollView horizontal contentContainerStyle={{ gap: rp(8) }} showsHorizontalScrollIndicator={false}>
            {["all", "active", "closed"].map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setEvtFilter(f)}
                style={{
                  paddingHorizontal: rp(14),
                  paddingVertical: rp(8),
                  borderRadius: rp(99),
                  backgroundColor: evtFilter === f ? "#7C3AED" : "#fff",
                  borderWidth: rp(1),
                  borderColor: evtFilter === f ? "#7C3AED" : "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: rs(11), fontWeight: "800", color: evtFilter === f ? "#fff" : "#6B7280", letterSpacing: rs(1.5) }}>{f.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {loadingEvents && <ActivityIndicator color="#7C3AED" style={{ marginTop: rp(20) }} />}
          {!loadingEvents && filteredEvts.length === 0 && (
            <View style={{ alignItems: "center", marginTop: rp(60) }}>
              <Text style={{ fontSize: rs(48) }}>📅</Text>
              <Text style={{ color: "#6B7280", marginTop: rp(8) }}>No events for this driver</Text>
            </View>
          )}
          {filteredEvts.map((e) => (
            <View key={e.id}>
              <TouchableOpacity
                onPress={() => openEvent(e)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: rp(24),
                  padding: rp(16),
                  marginTop: rp(12),
                  flexDirection: "row",
                  alignItems: "center",
                  borderLeftWidth: rp(4),
                  borderLeftColor: e.status === "active" ? "#059669" : "#9CA3AF",
                  ...cardShadow,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(15) }}>{e.name}</Text>
                  <View style={{ flexDirection: "row", gap: rp(6), marginTop: rp(6), flexWrap: "wrap" }}>
                    <View style={pillGray}><Ionicons name="calendar-outline" size={10} color="#6B7280" /><Text style={pillGrayText}>{e.date}</Text></View>
                    <View style={pillGray}><Ionicons name="location-outline" size={10} color="#6B7280" /><Text style={pillGrayText}>{e.venue}</Text></View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ height: rp(40) }} />
        </ScrollView>
      )}
    </View>
  );
}

const miniLabel = { fontSize: rs(10), fontWeight: "800", color: "#6B7280", letterSpacing: rs(2), marginBottom: rp(6) };
const miniInput = { backgroundColor: "#F9FAFB", borderRadius: rp(12), borderWidth: rp(1), borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: rp(12), marginBottom: rp(12) };
const miniInputText = { flex: 1, paddingVertical: rp(10), marginLeft: rp(8), fontSize: rs(14), color: "#111827" };
const pillGray = { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99), gap: rp(4) };
const pillGrayText = { color: "#6B7280", fontSize: rs(10), fontWeight: "700" };
