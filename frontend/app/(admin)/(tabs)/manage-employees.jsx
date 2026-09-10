import { useEmployeeManagement } from "../../../hooks/useEmployeeManagement";
import { Screen, TopBar, Btn, Card, StatusPill, Field, FieldLabel, fieldTextInputStyle, EmptyState } from "../../../components/valet/ui";
import Heading from "../../../components/Heading";
import { Hero } from "../../../components/admin/Hero";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback, useRef } from "react";
import { confirmDialog } from "../../../lib/confirmDialog";
import { rs, rp } from '../../../utils/responsive';
import { theme } from "../../../utils/theme";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  BackHandler,
  Linking,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import api from "../../../lib/api";
import { getItem } from "../../../lib/secure";
import { pickImageHelper } from "../../../utils/imagePicker";

import { scrollToFirstError } from "../../../lib/scrollToFirstError";

const generateTempPassword = () => Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "1!";

const cardShadow = {
  shadowColor: theme.colors.textPrimary,
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function ManageEmployees() {
  const insets = useSafeAreaInsets();
  const { createDriver } = useEmployeeManagement();

  const router = useRouter();
  const { tab: initialTab } = useLocalSearchParams();
  const scrollViewRef = useRef(null);
  const fieldRefs = useRef({});

  const tabBarHeight = useBottomTabBarHeight();
  const [tab, setTab] = useState(initialTab === "drivers" ? "drivers" : "supervisors");
  const [supervisors, setSupervisors] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [processingId, setProcessingId] = useState(null);

  // Supervisor Form State
  const [showSupModal, setShowSupModal] = useState(false);
  const [supName, setSupName] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supGender, setSupGender] = useState("");
  const [supPassword, setSupPassword] = useState("");
  const [savingSup, setSavingSup] = useState(false);
  const [errors, setErrors] = useState({});
  const [supPan, setSupPan] = useState("");
  const [supBankAccount, setSupBankAccount] = useState("");
  const [supBankIfsc, setSupBankIfsc] = useState("");
  const [supAadharNumber, setSupAadharNumber] = useState("");
  const [supAadharPhotoUri, setSupAadharPhotoUri] = useState(null);
  const [supIfscInfo, setSupIfscInfo] = useState(null);
  const [supIfscChecking, setSupIfscChecking] = useState(false);
  const [supPhoto, setSupPhoto] = useState(null);
  const [supPhotoUri, setSupPhotoUri] = useState(null);
  useEffect(() => {
    const backAction = () => {
      if (showSupModal) { resetSupForm(); setShowSupModal(false); return true; }
      router.back(); return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [showSupModal]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, drvRes] = await Promise.all([
        api.get("/supervisors"),
        api.get("/drivers")
      ]);
      setSupervisors(supRes.data || []);
      setDrivers(drvRes.data || []);
    } catch (e) { }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredSupervisors = supervisors.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredSupervisorsByMode = filteredSupervisors.filter(s => filterMode === "all" || s.is_active);
  const activeSupCount = supervisors.filter(s => s.is_active).length;
  const verifiedSupCount = supervisors.filter(s => s.is_verified).length;
  const totalSupCount = supervisors.length;

  const filteredDrivers = drivers.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDriversByMode = filteredDrivers.filter(d => filterMode === "all" || d.is_active);
  const activeDrvCount = drivers.filter(d => d.is_active).length;
  const verifiedDrvCount = drivers.filter(d => d.is_verified).length;
  const totalDrvCount = drivers.length;



  const handleDownloadSample = async () => {
    try {
      setLoading(true);
      const token = await getItem("auth_token");
      const fileUri = FileSystem.documentDirectory + "driver_bulk_template.xlsx";
      const { uri, status } = await FileSystem.downloadAsync(
        `${api.defaults.baseURL}/drivers/bulk-template`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (status !== 200) {
        throw new Error(`Download failed with status ${status}`);
      }
      await Sharing.shareAsync(uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    } catch (e) {
      confirmDialog.info("Couldn't download template", "Something went wrong saving the file. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "application/octet-stream"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const file = res.assets[0];

      setLoading(true);
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name || "bulk_drivers.xlsx",
        type: file.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      const { data } = await api.post("/drivers/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });

      const warnedCount = (data.results || []).filter(r => r.status === "Added (with warnings)").length;
      let msg = `Inserted: ${data.inserted}`;
      if (warnedCount > 0) {
        msg += ` (${warnedCount} with warnings — check the downloaded file for details)`;
      }
      msg += `\nSkipped: ${data.skipped}`;
      confirmDialog.info("Bulk Upload Result", msg);

      let csv = "Row,Name,Phone,Status,Reason\n";
      (data.results || []).forEach(r => {
        csv += `${r.row},"${r.name || ""}","${r.phone || ""}",${r.status},"${r.reason || ""}"\n`;
      });
      const fn = FileSystem.documentDirectory + `bulk_upload_result_${new Date().toISOString().split('T')[0]}.csv`;
      await FileSystem.writeAsStringAsync(fn, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fn, { mimeType: "text/csv" });
      fetchAll();
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : "Something went wrong uploading the file. Please check your connection and try again.";
      confirmDialog.info("Couldn't upload file", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateDriver = async (did) => {
    try {
      setProcessingId(did);
      await api.patch(`/drivers/${did}/activate`);
      fetchAll();
    } catch (e) {
      confirmDialog.info("Couldn't activate driver", e.response?.data?.detail || "Something went wrong activating this account. Check your connection and try again.");
    } finally {
      setProcessingId(null);
    }
  };
  const handleSupervisorLongPress = (s) => {
    const action = s.is_active ? "Deactivate" : "Activate";
    const onConfirm = async () => {
      setProcessingId(s.id);
      try {
        await api.patch(`/supervisors/${s.id}`, { is_active: !s.is_active });
        confirmDialog.info("Success", `${action}d successfully`);
        fetchAll();
      } catch (e) {
        const detail = e.response?.data?.detail;
        const msg = typeof detail === 'string' ? detail : "Something went wrong. Please check your connection and try again.";
        confirmDialog.info("Operation failed", msg);
      } finally {
        setProcessingId(null);
      }
    };
    if (s.is_active) {
      confirmDialog.destructiveConfirm("Supervisor options", s.name, onConfirm, action);
    } else {
      confirmDialog.confirm("Supervisor options", s.name, onConfirm);
    }
  };

  const handleDriverLongPress = (d) => {
    const action = d.is_active ? "Deactivate" : "Activate";
    const onConfirm = async () => {
      setProcessingId(d.id);
      try {
        await api.patch(`/drivers/${d.id}`, { is_active: !d.is_active });
        confirmDialog.info("Success", `${action}d successfully`);
        fetchAll();
      } catch (e) {
        const detail = e.response?.data?.detail;
        const msg = typeof detail === 'string' ? detail : "Something went wrong. Please check your connection and try again.";
        confirmDialog.info("Operation failed", msg);
      } finally {
        setProcessingId(null);
      }
    };
    if (d.is_active) {
      confirmDialog.destructiveConfirm("Driver options", d.name, onConfirm, action);
    } else {
      confirmDialog.confirm("Driver options", d.name, onConfirm);
    }
  };

  return (
    <Screen scroll={false} testID="manage-employees-screen">
      <View style={{
        backgroundColor: theme.colors.primary,
        paddingHorizontal: rp(theme.spacing.xl),
        paddingBottom: rp(32),
        paddingTop: rp(theme.spacing.xl) + (insets.top || 0),
        borderBottomLeftRadius: rp(32),
        borderBottomRightRadius: rp(32),
        overflow: 'hidden',
        position: 'relative'
      }}>
        <View style={{ position: 'absolute', top: rp(-40), right: rp(-20), width: rp(150), height: rp(150), borderRadius: rp(75), backgroundColor: theme.colors.accent, opacity: 0.1 }} />
        <View style={{ position: 'absolute', bottom: rp(-50), left: rp(-30), width: rp(200), height: rp(200), borderRadius: rp(100), backgroundColor: theme.colors.primaryDark, opacity: 0.3 }} />

        <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.accent, fontSize: rs(14), fontWeight: '800', letterSpacing: 1, marginBottom: rp(6), textAlign: "center" }}>YOUR TEAM</Text>


        <View style={{ flexDirection: 'row', gap: rp(8), marginBottom: rp(theme.spacing.md) }}>
          <TouchableOpacity
            onPress={() => setTab("supervisors")}
            style={{ flex: 1, backgroundColor: tab === "supervisors" ? theme.colors.surface : 'rgba(255,255,255,0.08)', borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.md), alignItems: 'flex-start' }}
          >
            <Ionicons name="shield-checkmark" size={24} color={tab === "supervisors" ? theme.colors.primary : 'rgba(255,255,255,0.7)'} />
            <Text style={{ fontFamily: theme.fontFamily.regular, fontWeight: 'bold', color: tab === "supervisors" ? theme.colors.primary : 'rgba(255,255,255,0.7)', fontSize: rs(16), marginTop: rp(8), marginBottom: rp(4) }}>Supervisors</Text>
            <Text style={{ fontFamily: theme.fontFamily.regular, color: tab === "supervisors" ? theme.colors.textSecondary : 'rgba(255,255,255,0.5)', fontSize: rs(12) }}>{activeSupCount} available</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("drivers")}
            style={{ flex: 1, backgroundColor: tab === "drivers" ? theme.colors.surface : 'rgba(255,255,255,0.08)', borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.md), alignItems: 'flex-start' }}
          >
            <Ionicons name="car" size={24} color={tab === "drivers" ? theme.colors.primary : 'rgba(255,255,255,0.7)'} />
            <Text style={{ fontFamily: theme.fontFamily.regular, fontWeight: 'bold', color: tab === "drivers" ? theme.colors.primary : 'rgba(255,255,255,0.7)', fontSize: rs(16), marginTop: rp(8), marginBottom: rp(4) }}>Drivers</Text>
            <Text style={{ fontFamily: theme.fontFamily.regular, color: tab === "drivers" ? theme.colors.textSecondary : 'rgba(255,255,255,0.5)', fontSize: rs(12) }}>{activeDrvCount} available</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: rp(8) }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.md), alignItems: 'center' }}>
            <Heading level="display" style={{ color: theme.colors.surface }}>{tab === "supervisors" ? totalSupCount : totalDrvCount}</Heading>
            <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textMuted, fontSize: rs(10), fontWeight: '700', marginTop: rp(4) }}>{tab === "supervisors" ? "SUPERVISORS" : "DRIVERS"}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.md), alignItems: 'center' }}>
            <Heading level="display" style={{ color: theme.colors.surface }}>{tab === "supervisors" ? activeSupCount : activeDrvCount}</Heading>
            <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textMuted, fontSize: rs(10), fontWeight: '700', marginTop: rp(4) }}>ACTIVE</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.md), alignItems: 'center' }}>
            <Heading level="display" style={{ color: theme.colors.surface }}>{tab === "supervisors" ? verifiedSupCount : verifiedDrvCount}</Heading>
            <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textMuted, fontSize: rs(10), fontWeight: '700', marginTop: rp(4) }}>VERIFIED</Text>
          </View>
        </View>
      </View>

      <ScrollView ref={scrollViewRef} style={{ flex: 1 }} contentContainerStyle={{ padding: rp(theme.spacing.lg), paddingBottom: rp(100) + tabBarHeight }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(99), flexDirection: "row", alignItems: "center", paddingHorizontal: rp(16), marginBottom: rp(theme.spacing.md), shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
          <Ionicons name="search-outline" size={20} color={theme.colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${tab}...`}
            placeholderTextColor={theme.colors.textMuted}
            style={{ fontFamily: theme.fontFamily.regular, flex: 1, marginLeft: rp(12), paddingVertical: rp(14), fontSize: rs(15), color: theme.colors.textPrimary }}
          />
        </View>

        <View style={{ flexDirection: "row", backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(99), padding: rp(4), marginBottom: rp(theme.spacing.xl) }}>
          <TouchableOpacity
            onPress={() => setFilterMode("all")}
            style={{ flex: 1, paddingVertical: rp(10), alignItems: "center", borderRadius: rp(99), backgroundColor: filterMode === "all" ? theme.colors.surface : "transparent", shadowColor: filterMode === "all" ? "#000" : "transparent", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: filterMode === "all" ? 2 : 0 }}
          >
            <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "700", color: filterMode === "all" ? theme.colors.primary : theme.colors.textSecondary, fontSize: rs(13) }}>All {tab === "supervisors" ? "Supervisors" : "Drivers"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterMode("available")}
            style={{ flex: 1, paddingVertical: rp(10), alignItems: "center", borderRadius: rp(99), backgroundColor: filterMode === "available" ? theme.colors.surface : "transparent", shadowColor: filterMode === "available" ? "#000" : "transparent", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: filterMode === "available" ? 2 : 0 }}
          >
            <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "700", color: filterMode === "available" ? theme.colors.primary : theme.colors.textSecondary, fontSize: rs(13) }}>Available</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: rp(theme.spacing.xl) }} />
        ) : (
          <>
            {tab === "supervisors" ? (
              <>
                <View style={{ flexDirection: 'row', gap: rp(theme.spacing.md), marginBottom: rp(theme.spacing.lg) }}>
                  <TouchableOpacity
                    onPress={() => router.push("/(admin)/(tabs)/add-supervisor")}
                    style={{ flex: 1, backgroundColor: theme.colors.accent, paddingVertical: rp(theme.spacing.md), borderRadius: rp(theme.radius.lg), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
                  >
                    <Ionicons name="person-add" size={18} color={theme.colors.accentForeground} style={{ marginRight: rp(8) }} />
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.accentForeground, fontWeight: '800', fontSize: rs(14) }}>ADD SUPERVISOR</Text>
                  </TouchableOpacity>
                </View>
                {filteredSupervisorsByMode.map(s => (
                  <Card key={s.id} onPress={() => router.push({ pathname: "/(admin)/(tabs)/supervisor-detail", params: { supervisorId: s.id, supervisorName: s.name } })} onLongPress={() => handleSupervisorLongPress(s)} style={{ padding: 0, borderRadius: rp(28), overflow: 'hidden', marginBottom: rp(theme.spacing.md) }}>
                    <View style={{ padding: rp(theme.spacing.lg), flexDirection: "row", alignItems: "center" }}>
                      <View style={{ width: rp(48), height: rp(48), borderRadius: rp(16), backgroundColor: theme.colors.primaryLight, justifyContent: "center", alignItems: "center", marginRight: rp(theme.spacing.md) }}>
                        <Ionicons name="shield-checkmark" size={rs(24)} color={theme.colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: rp(theme.spacing.sm), marginBottom: rp(4) }}>
                          <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge), color: theme.colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
                          <View style={{ backgroundColor: s.is_active ? theme.colors.successLight : theme.colors.dangerLight, paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(theme.radius.pill) }}>
                            <Text style={{ fontFamily: theme.fontFamily.bold, color: s.is_active ? theme.colors.success : theme.colors.danger, fontSize: rs(9), fontWeight: theme.fontWeight.bold, textTransform: 'uppercase' }}>{s.is_active ? "ACTIVE" : "INACTIVE"}</Text>
                          </View>
                        </View>
                        <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.caption) }} numberOfLines={1}>{s.email} {s.phone ? `• ${s.phone}` : ''}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                      <View style={{ flex: 1, paddingVertical: rp(12), alignItems: "center", borderRightWidth: 1, borderRightColor: theme.colors.border }}>
                        <Ionicons name={s.is_verified ? "shield-checkmark" : "shield-half"} size={16} color={s.is_verified ? theme.colors.success : theme.colors.warning} style={{ marginBottom: rp(4) }} />
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(10), fontWeight: "700", color: s.is_verified ? theme.colors.success : theme.colors.warning }}>{s.is_verified ? "VERIFIED" : "PENDING"}</Text>
                      </View>
                      <TouchableOpacity
                        disabled={!s.phone}
                        onPress={() => Linking.openURL(`tel:${s.phone}`)}
                        style={{ flex: 1, paddingVertical: rp(12), alignItems: "center", borderRightWidth: 1, borderRightColor: theme.colors.border, opacity: s.phone ? 1 : 0.4 }}
                      >
                        <Ionicons name="call" size={16} color={theme.colors.primary} style={{ marginBottom: rp(4) }} />
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(10), fontWeight: "700", color: theme.colors.primary }}>CALL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: '/(admin)/(tabs)/edit-supervisor', params: { supervisorId: s.id } })}
                        style={{ flex: 1, paddingVertical: rp(12), alignItems: "center" }}
                      >
                        <Ionicons name="pencil" size={16} color={theme.colors.primary} style={{ marginBottom: rp(4) }} />
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(10), fontWeight: "700", color: theme.colors.primary }}>EDIT</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))}

                {filteredSupervisorsByMode.length === 0 && (
                  <EmptyState
                    icon={<Ionicons name="shield-outline" size={48} color={theme.colors.textMuted} />}
                    title="No supervisors"
                    body="Nobody matches that search right now."
                    style={{ marginTop: rp(40) }}
                  />
                )}

              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: rp(theme.spacing.md), marginBottom: rp(theme.spacing.lg) }}>
                  <TouchableOpacity
                    onPress={() => router.push("/(admin)/(tabs)/add-driver")}
                    style={{ flex: 1, backgroundColor: theme.colors.accent, paddingVertical: rp(theme.spacing.md), borderRadius: rp(theme.radius.lg), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
                  >
                    <Ionicons name="person-add" size={18} color={theme.colors.accentForeground} style={{ marginRight: rp(8) }} />
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.accentForeground, fontWeight: '800', fontSize: rs(14) }}>ADD DRIVER</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push("/(admin)/(tabs)/bulk-add-driver")}
                    style={{ flex: 1, backgroundColor: theme.colors.surface, paddingVertical: rp(theme.spacing.md), borderRadius: rp(theme.radius.lg), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.primary} style={{ marginRight: rp(8) }} />
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.primary, fontWeight: '800', fontSize: rs(14) }}>BULK ADD</Text>
                  </TouchableOpacity>
                </View>
                {filteredDriversByMode.map(d => (
                  <Card key={d.id} onPress={() => router.push({ pathname: "/(admin)/(tabs)/driver-stats", params: { driverId: d.id, driverName: d.name } })} onLongPress={() => handleDriverLongPress(d)} style={{ padding: 0, borderRadius: rp(28), overflow: 'hidden', marginBottom: rp(theme.spacing.md) }}>
                    <View style={{ padding: rp(theme.spacing.lg), flexDirection: "row", alignItems: "center" }}>
                      <View style={{ width: rp(48), height: rp(48), borderRadius: rp(16), backgroundColor: theme.colors.successLight, justifyContent: "center", alignItems: "center", marginRight: rp(theme.spacing.md) }}>
                        <Ionicons name="person" size={rs(24)} color={theme.colors.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: rp(theme.spacing.sm), marginBottom: rp(4) }}>
                          <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge), color: theme.colors.textPrimary }} numberOfLines={1}>{d.name}</Text>
                          <View style={{ backgroundColor: d.is_active ? theme.colors.successLight : theme.colors.surfaceAlt, paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(theme.radius.pill) }}>
                            <Text style={{ fontFamily: theme.fontFamily.bold, color: d.is_active ? theme.colors.success : theme.colors.textSecondary, fontSize: rs(9), fontWeight: theme.fontWeight.bold, textTransform: 'uppercase' }}>{d.is_active ? "AVAILABLE" : "OFF-DUTY"}</Text>
                          </View>
                        </View>
                        <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.caption) }} numberOfLines={1}>ID: {d.employee_id || "N/A"} {d.phone ? `• ${d.phone}` : ''}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                      <View style={{ flex: 1, paddingVertical: rp(12), alignItems: "center", borderRightWidth: 1, borderRightColor: theme.colors.border }}>
                        <Ionicons name={d.is_verified ? "shield-checkmark" : "shield-half"} size={16} color={d.is_verified ? theme.colors.success : theme.colors.warning} style={{ marginBottom: rp(4) }} />
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(10), fontWeight: "700", color: d.is_verified ? theme.colors.success : theme.colors.warning }}>{d.is_verified ? "VERIFIED" : "PENDING"}</Text>
                      </View>
                      <TouchableOpacity
                        disabled={!d.phone}
                        onPress={() => Linking.openURL(`tel:${d.phone}`)}
                        style={{ flex: 1, paddingVertical: rp(12), alignItems: "center", borderRightWidth: 1, borderRightColor: theme.colors.border, opacity: d.phone ? 1 : 0.4 }}
                      >
                        <Ionicons name="call" size={16} color={theme.colors.primary} style={{ marginBottom: rp(4) }} />
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(10), fontWeight: "700", color: theme.colors.primary }}>CALL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: "/(admin)/(tabs)/edit-driver", params: { driverId: d.id } })}
                        style={{ flex: 1, paddingVertical: rp(12), alignItems: "center" }}
                      >
                        <Ionicons name="pencil" size={16} color={theme.colors.primary} style={{ marginBottom: rp(4) }} />
                        <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(10), fontWeight: "700", color: theme.colors.primary }}>EDIT</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))}

                {filteredDriversByMode.length === 0 && (
                  <EmptyState
                    icon={<Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />}
                    title="No drivers"
                    body="Nobody matches that search right now."
                    style={{ marginTop: rp(40) }}
                  />
                )}

              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const modalLabel = { fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8) };
const modalInputError = { borderColor: theme.colors.danger };
const modalErrorText = { color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) };
const modalInput = { backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(14), borderWidth: rp(1), borderColor: theme.colors.border, padding: rp(14), color: theme.colors.textPrimary, marginBottom: rp(16), fontSize: rs(15), fontWeight: "700" };
