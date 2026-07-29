import { useEffect, useState, useCallback } from "react";
import { rs, rp } from '../../utils/responsive';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  TextInput,
  Alert,
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

const NAVY = "#7C3AED";
const PURPLE = "#7C3AED";

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function SupervisorDetail() {
  const router = useRouter();
  const { supervisorId, supervisorName } = useLocalSearchParams();
  const { setCurrentEventId } = useAppStore();
  
  const [supervisor, setSupervisor] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("overview");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [aadharNumber, setAadharNumber] = useState("");
  const [aadharPhoto, setAadharPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [evtFilter, setEvtFilter] = useState("active");
  const [exportingPDF, setExportingPDF] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [supRes, eventsRes, statsRes] = await Promise.all([
        api.get(`/supervisors/${supervisorId}`),
        api.get(`/supervisors/${supervisorId}/events`),
        api.get(`/supervisors/${supervisorId}/stats`),
      ]);
      setSupervisor(supRes.data);
      setName(supRes.data.name || "");
      setPhone(supRes.data.phone || "");
      setEmail(supRes.data.email || "");
      setPanNumber(supRes.data.pan_number || "");
      setBankAccount(supRes.data.bank_account_number || "");
      setBankIfsc(supRes.data.bank_ifsc || "");
      setAadharNumber(supRes.data.aadhar_number || "");
      setAadharPhoto(supRes.data.aadhar_photo || null);
      setEvents(eventsRes.data || []);
      setStats(statsRes.data);
    } catch (e) {
      console.error("Failed to fetch supervisor detail", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supervisorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const validateSupervisor = () => {
    const errs = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!phone.trim()) errs.phone = "Phone is required";
    else if (!/^\d{10}$/.test(phone.trim().replace(/\D/g, ""))) errs.phone = "Please enter a valid 10-digit phone number";
    if (password && password.length < 6) errs.password = "Password must be at least 6 characters";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Please enter a valid email address";
    if (panNumber.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber.trim().toUpperCase())) errs.panNumber = "Expected format: ABCDE1234F";
    if (bankAccount.trim() && !/^\d{9,18}$/.test(bankAccount.trim())) errs.bankAccount = "Must be 9-18 digits";
    if (bankIfsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc.trim().toUpperCase())) errs.bankIfsc = "Expected format: ABCD0123456";
    if (!aadharNumber.trim()) errs.aadharNumber = "Aadhar Number is required";
    else if (!/^\d{12}$/.test(aadharNumber.trim())) errs.aadharNumber = "Aadhar number must be exactly 12 digits";
    if (!aadharPhoto) errs.aadharPhoto = "Aadhar Photo is required";
    return errs;
  };

  const saveSupervisor = async () => {
    const errs = validateSupervisor();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      Alert.alert("Validation Error", "Please check the highlighted fields");
      return;
    }
    setErrors({});
    try {
      setSaving(true);
      const body = { name, phone };
      if (email.trim()) body.email = email.trim();
      if (password && password.length >= 6) body.password = password;
      if (panNumber.trim()) body.pan_number = panNumber.trim();
      if (bankAccount.trim()) body.bank_account_number = bankAccount.trim();
      if (bankIfsc.trim()) body.bank_ifsc = bankIfsc.trim();
      if (aadharNumber.trim()) body.aadhar_number = aadharNumber.trim();
      if (aadharPhoto) body.aadhar_photo = aadharPhoto;
      await api.patch(`/supervisors/${supervisorId}`, body);
      Alert.alert("Updated", "Supervisor updated successfully");
      setPassword("");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to update");
    } finally {
      setSaving(false);
    }
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

  const toggleActive = async () => {
    try {
      await api.patch(`/supervisors/${supervisorId}`, { is_active: !supervisor.is_active });
      setSupervisor({ ...supervisor, is_active: !supervisor.is_active });
    } catch {
      Alert.alert("Error", "Failed to update supervisor status");
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Supervisor",
      "WARNING: This will permanently delete this supervisor and cannot be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/superadmin/supervisors/${supervisorId}/permanent`);
              Alert.alert("Deleted", "Supervisor permanently deleted");
              router.back();
            } catch {
              Alert.alert("Error", "Failed to delete supervisor");
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openEvent = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(admin)/event-detail");
  };

  const exportPDF = async () => {
    if (!supervisor) return;
    setExportingPDF(true);
    try {
      const { data: incidents } = await api.get(`/incidents/supervisor/${supervisorId}`);
      
      const eventRows = events.map(e => `
        <tr>
          <td>${e.name}</td>
          <td>${e.venue || "—"}</td>
          <td>${e.date}</td>
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
        : '<tr><td colspan="3" style="text-align:center;color:#9CA3AF;">No incidents reported</td></tr>';

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
        <h1>Supervisor Performance Report</h1>
        <p>${supervisor.name} · ${supervisor.employee_id || "ID: —"}</p>
        <p style="margin-top:6px;font-size:10px;opacity:0.6;">Generated ${new Date().toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</p>
      </div>
      <div class="section">
        <h2>Supervisor Information</h2>
        <p><strong>Name:</strong> ${supervisor.name}</p>
        <p><strong>Employee ID:</strong> ${supervisor.employee_id || "—"}</p>
        <p><strong>Email:</strong> ${supervisor.email || "—"}</p>
        <p><strong>Phone:</strong> ${supervisor.phone || "—"}</p>
      </div>
      <div class="section">
        <h2>Stats Summary</h2>
        <div class="stats">
          <div class="stat"><div class="stat-val">${stats?.total_events || 0}</div><div class="stat-lbl">Events Supervised</div></div>
          <div class="stat"><div class="stat-val">${stats?.total_drivers || 0}</div><div class="stat-lbl">Unique Drivers</div></div>
          <div class="stat"><div class="stat-val">${stats?.avg_rating || "—"}</div><div class="stat-lbl">Avg Rating</div></div>
          <div class="stat"><div class="stat-val" style="color:${stats?.total_incidents > 0 ? "#EF4444" : "#111827"}">${stats?.total_incidents || 0}</div><div class="stat-lbl">Incidents Reported</div></div>
        </div>
      </div>
      <div class="section">
        <h2>Events List</h2>
        <table><thead><tr><th>Event</th><th>Venue</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${eventRows}</tbody></table>
      </div>
      <div class="section">
        <h2>Incidents Reported</h2>
        <table><thead><tr><th>Date</th><th>Plate</th><th>Description</th></tr></thead>
        <tbody>${incidentRows}</tbody></table>
      </div>
      <div class="footer">InstaPark — Supervisor Performance Report · ${supervisor.name}</div>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const filename = `${supervisor.name.replace(/\s+/g, "_")}_report.pdf`;
      const dest = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      await Sharing.shareAsync(dest, { mimeType: "application/pdf", dialogTitle: `${supervisor.name} — Performance Report` });
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
      <SafeAreaView edges={["top"]} style={{ backgroundColor: PURPLE }}>
        <View
          style={{
            backgroundColor: PURPLE,
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
            paddingBottom: rp(24),
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(124,58,237,0.3)",
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
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900" }}>{supervisorName || supervisor?.name}</Text>
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(6), marginLeft: rp(10) }}>
                  <Text style={{ color: "#fff", fontSize: rs(10), fontWeight: "900", letterSpacing: rs(1) }}>SUPERVISOR</Text>
                </View>
              </View>
              {supervisor?.employee_id ? ( 
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: rs(12), marginTop: rp(2) }}>{supervisor.employee_id}</Text> 
              ) : null}
            </View>
          </View>
        </View>
      </SafeAreaView>

      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#fff",
          marginHorizontal: rp(16),
          marginTop: -22,
          borderRadius: rp(20),
          padding: rp(4),
          shadowColor: PURPLE,
          shadowOpacity: 0.08,
          shadowRadius: rp(16),
          shadowOffset: { width: 0, height: rp(4) },
          elevation: 4,
        }}
      >
        {[
          ["overview", "Overview"],
          ["events", "Events"],
        ].map(([k, l]) => (
          <TouchableOpacity
            key={k}
            onPress={() => setTab(k)}
            style={{
              flex: 1,
              paddingVertical: rp(10),
              borderRadius: rp(16),
              backgroundColor: tab === k ? PURPLE : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontWeight: "800",
                fontSize: rs(13),
                color: tab === k ? "#fff" : "#6B7280",
                letterSpacing: rs(1),
              }}
            >
              {l}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {supervisor && ( 
        <View style={{ marginHorizontal: rp(16), marginTop: rp(12), backgroundColor: "#fff", borderRadius: rp(20), padding: rp(14), flexDirection: "row", alignItems: "center", gap: rp(14), ...cardShadow }}> 
          {supervisor.supervisor_photo ? ( 
            <Image source={{ uri: supervisor.supervisor_photo }} style={{ width: rp(56), height: rp(56), borderRadius: rp(28) }} /> 
          ) : ( 
            <View style={{ width: rp(56), height: rp(56), borderRadius: rp(28), backgroundColor: "#F3F0FF", alignItems: "center", justifyContent: "center" }}> 
              <Ionicons name="person" size={28} color="#7C3AED" /> 
            </View> 
          )} 
          <View style={{ flex: 1 }}> 
            <Text style={{ fontWeight: "900", fontSize: rs(16), color: "#111827" }}>{supervisor.name}</Text> 
            <Text style={{ fontSize: rs(12), color: "#6B7280", marginTop: rp(1) }}>{supervisor.employee_id || supervisor.provider_name || "—"}</Text> 
            <View style={{ flexDirection: "row", gap: rp(6), marginTop: rp(5), flexWrap: "wrap" }}> 
              <View
                style={{
                  backgroundColor: supervisor.is_active ? "#D1FAE5" : "#FEE2E2",
                  paddingHorizontal: rp(8),
                  paddingVertical: rp(2),
                  borderRadius: rp(99),
                }}
              >
                <Text style={{ color: supervisor.is_active ? "#059669" : "#EF4444", fontSize: rs(10), fontWeight: "800" }}>
                  {supervisor.is_active ? "ACTIVE ✓" : "INACTIVE ✗"}
                </Text>
              </View>
              {supervisor.phone ? ( 
                <View style={{ flexDirection: "row", alignItems: "center", gap: rp(3), backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(99) }}> 
                  <Ionicons name="call-outline" size={10} color="#6B7280" /> 
                  <Text style={{ color: "#6B7280", fontSize: rs(10), fontWeight: "700" }}>{supervisor.phone}</Text> 
                </View> 
              ) : null} 
            </View> 
          </View> 
        </View> 
      )} 

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: rp(40) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PURPLE} />}
      >
        {tab === "overview" && (
          <>
            {/* Stats Row */}
            <View style={{ paddingHorizontal: rp(16), marginTop: rp(20) }}>
              <Text style={sectionTitle}>PERFORMANCE</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(12) }}>
                <StatCard label="EVENTS SUPERVISED" value={stats?.total_events || 0} color="#7C3AED" icon="calendar" />
                <StatCard label="DRIVERS OVERSEEN" value={stats?.total_drivers || 0} color="#0EA5E9" icon="people" />
                <StatCard label="AVG RATING" value={stats?.avg_rating || "—"} color="#F59E0B" icon="star" />
                <StatCard label="INCIDENTS REPORTED" value={stats?.total_incidents || 0} color="#EF4444" icon="warning" />
              </View>
            </View>

            {supervisor && (
              <>
                <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginTop: rp(24), marginBottom: rp(10), marginHorizontal: rp(16) }}>EDIT SUPERVISOR</Text>
            <View style={[{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(18), marginHorizontal: rp(16) }, cardShadow]}>
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
              <Text style={miniLabel}>NEW PASSWORD (LEAVE BLANK TO KEEP)</Text>
              <View style={[miniInput, errors.password && { borderColor: "#EF4444" }]}>
                <Ionicons name="keypad-outline" size={16} color="#7C3AED" />
                <TextInput value={password} onChangeText={setPassword} secureTextEntry style={miniInputText} />
              </View>
              {errors.password && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(2) }}>{errors.password}</Text>}
              <Text style={miniLabel}>EMAIL</Text>
              <View style={[miniInput, errors.email && { borderColor: "#EF4444" }]}>
                <Ionicons name="mail-outline" size={16} color="#7C3AED" />
                <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={miniInputText} />
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
                onPress={saveSupervisor}
                disabled={saving}
                style={{ backgroundColor: "#7C3AED", borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", marginTop: rp(4) }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>SAVE</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    supervisor.is_active ? "Deactivate Supervisor" : "Activate Supervisor",
                    supervisor.is_active
                      ? "This supervisor will be marked inactive. Continue?"
                      : "This supervisor will be marked active again. Continue?",
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
                  backgroundColor: supervisor.is_active ? "#FEE2E2" : "#D1FAE5",
                  borderRadius: rp(12),
                  paddingVertical: rp(12),
                  marginTop: rp(8),
                }}
              >
                <Ionicons name={supervisor.is_active ? "close-circle-outline" : "checkmark-circle-outline"} size={16} color={supervisor.is_active ? "#EF4444" : "#059669"} />
                <Text style={{ color: supervisor.is_active ? "#EF4444" : "#059669", fontWeight: "800", fontSize: rs(13) }}>
                  {supervisor.is_active ? "Deactivate Supervisor" : "Activate Supervisor"}
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
                <Text style={{ color: "#EF4444", fontWeight: "800", fontSize: rs(13) }}>Delete Supervisor</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
          </>
        )}

        {tab === "events" && ( 
          <View style={{ paddingHorizontal: rp(16), paddingTop: rp(16) }}> 
            {/* Filter chips — same as driver-stats */} 
            <ScrollView horizontal contentContainerStyle={{ gap: rp(8), marginBottom: rp(16) }} showsHorizontalScrollIndicator={false}> 
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
                  <Text style={{ fontSize: rs(11), fontWeight: "800", color: evtFilter === f ? "#fff" : "#6B7280", letterSpacing: rs(1.5) }}> 
                    {f.toUpperCase()} 
                  </Text> 
                </TouchableOpacity> 
              ))} 
            </ScrollView> 
      
            {filteredEvts.length === 0 ? ( 
              <View style={{ alignItems: "center", marginTop: rp(60) }}> 
                <Text style={{ fontSize: rs(48) }}>📅</Text> 
                <Text style={{ color: "#6B7280", marginTop: rp(8), fontWeight: "700" }}>No events found</Text> 
              </View> 
            ) : ( 
              filteredEvts.map((e) => ( 
                <TouchableOpacity 
                  key={e.id} 
                  onPress={() => openEvent(e)} 
                  activeOpacity={0.85} 
                  style={{ 
                    backgroundColor: "#fff", 
                    borderRadius: rp(24), 
                    padding: rp(16), 
                    marginBottom: rp(12), 
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
                      <View style={pillGray}> 
                        <Ionicons name="calendar-outline" size={10} color="#6B7280" /> 
                        <Text style={pillGrayText}>{e.date}</Text> 
                      </View> 
                      <View style={pillGray}> 
                        <Ionicons name="location-outline" size={10} color="#6B7280" /> 
                        <Text style={pillGrayText}>{e.venue}</Text> 
                      </View> 
                    </View> 
                  </View> 
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" /> 
                </TouchableOpacity> 
              )) 
            )} 
            <View style={{ height: rp(40) }} /> 
          </View> 
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <View style={{ width: "48%", backgroundColor: "#fff", borderRadius: rp(20), padding: rp(16), ...cardShadow }}>
      <View style={{ backgroundColor: color + "15", width: rp(32), height: rp(32), borderRadius: rp(10), alignItems: "center", justifyContent: "center", marginBottom: rp(12) }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ fontSize: rs(24), fontWeight: "900", color: "#111827" }}>{value}</Text>
      <Text style={{ fontSize: rs(9), fontWeight: "800", color: "#6B7280", letterSpacing: rs(1), marginTop: rp(4) }}>{label}</Text>
    </View>
  );
}

const sectionTitle = { fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(12) };
const infoRow = { flexDirection: "row", alignItems: "center", gap: rp(12) };
const infoLabel = { fontSize: rs(9), fontWeight: "800", color: "#9CA3AF", letterSpacing: rs(2) };
const infoValue = { fontSize: rs(14), fontWeight: "700", color: "#111827" };

const miniLabel = { fontSize: rs(10), fontWeight: "800", color: "#6B7280", letterSpacing: rs(2), marginBottom: rp(6) };
const miniInput = { backgroundColor: "#F9FAFB", borderRadius: rp(12), borderWidth: rp(1), borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: rp(12), marginBottom: rp(12) };
const miniInputText = { flex: 1, paddingVertical: rp(10), marginLeft: rp(8), fontSize: rs(14), color: "#111827" };
const pillGray = { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99), gap: rp(4) };
const pillGrayText = { color: "#6B7280", fontSize: rs(10), fontWeight: "700" };
