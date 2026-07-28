import { useEffect, useState, useCallback } from "react";
import { rs, rp } from '../../utils/responsive';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  BackHandler,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import api from "../../lib/api";
import { pickImageHelper } from "../../utils/imagePicker";

const generateTempPassword = () => Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "1!";

const cardShadow = {
  shadowColor: "#0F2044",
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function ManageEmployees() {
  const router = useRouter();
  const { tab: initialTab } = useLocalSearchParams();
  const [tab, setTab] = useState(initialTab === "drivers" ? "drivers" : "supervisors");
  const [supervisors, setSupervisors] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [resendingInviteId, setResendingInviteId] = useState(null);

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

  // Driver Form State
  const [showDrvModal, setShowDrvModal] = useState(false);
  const [drvName, setDrvName] = useState("");
  const [drvEmail, setDrvEmail] = useState("");
  const [drvPhone, setDrvPhone] = useState("");
  const [drvGender, setDrvGender] = useState("");
  const [drvPassword, setDrvPassword] = useState("");
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
  const [drvIfscInfo, setDrvIfscInfo] = useState(null);
  const [drvIfscChecking, setDrvIfscChecking] = useState(false);
  const [savingDrv, setSavingDrv] = useState(false);
  const [driverErrors, setDriverErrors] = useState({});

  useEffect(() => {
    const backAction = () => {
      if (showSupModal) { resetSupForm(); setShowSupModal(false); return true; }
      if (showDrvModal) { resetDrvForm(); setShowDrvModal(false); setDriverErrors({}); return true; }
      router.back(); return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [showSupModal, showDrvModal]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, drvRes] = await Promise.all([
        api.get("/supervisors"),
        api.get("/drivers")
      ]);
      setSupervisors(supRes.data || []);
      setDrivers(drvRes.data || []);
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredSupervisors = supervisors.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDrivers = drivers.filter(d => 
    d.name?.toLowerCase().includes(search.toLowerCase())
  );

  const resetSupForm = () => {
    setSupName(""); setSupEmail(""); setSupPhone(""); setSupGender(""); setSupPassword("");
    setSupPan(""); setSupBankAccount(""); setSupBankIfsc(""); setSupAadharNumber("");
    setSupAadharPhotoUri(null); setSupPhoto(null); setSupPhotoUri(null);
    setSupIfscInfo(null); setSupIfscChecking(false);
  };

  const resetDrvForm = () => {
    setDrvName("");
    setDrvEmail("");
    setDrvPhone("");
    setDrvGender("");
    setDrvPassword("");
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
    setDrvIfscInfo(null); setDrvIfscChecking(false);
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

  const validateSupervisor = () => {
    const errs = {};
    if (!supName.trim()) errs.name = "Name is required";
    if (!supEmail.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supEmail.trim())) errs.email = "Please enter a valid email address";
    // if (!supPassword.trim()) errs.password = "Password is required";
    if (!supGender) errs.gender = "Please select gender";
    if (!supPhone.trim()) errs.phone = "Phone is required";
    else if (!/^\d{10}$/.test(supPhone.trim().replace(/\D/g, ""))) errs.phone = "Please enter a valid 10-digit phone number";
    if (supPan.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(supPan.trim().toUpperCase())) errs.pan = "Expected format: ABCDE1234F";
    if (supBankAccount.trim() && !/^\d{9,18}$/.test(supBankAccount.trim())) errs.bankAccount = "Must be 9–18 digits";
    if (supBankIfsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(supBankIfsc.trim().toUpperCase())) errs.bankIfsc = "Expected format: ABCD0123456";
    else if (supBankIfsc.trim().length === 11 && supIfscInfo === "error") errs.bankIfsc = "This IFSC code was not found. Please check and try again.";
    if (!supAadharNumber.trim()) errs.aadharNumber = "Aadhar Number is required";
    else if (!/^\d{12}$/.test(supAadharNumber.trim())) errs.aadharNumber = "Aadhar number must be exactly 12 digits";
    if (!supAadharPhotoUri) errs.aadharPhoto = "Aadhar Photo is required";
    return errs;
  };

  const saveSupervisor = async () => {
    const errs = validateSupervisor();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSavingSup(true);
    try {
      let photoUrl;
      if (supPhotoUri) {
        const formData = new FormData();
        formData.append("file", { uri: supPhotoUri, type: "image/jpeg", name: "photo.jpg" });
        formData.append("folder", "supervisors");
        const up = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        photoUrl = up.data.url;
      }
      let aadharPhotoUrl;
      if (supAadharPhotoUri) {
        aadharPhotoUrl = await uploadDriverImage(supAadharPhotoUri, "aadhar_photos");
      }
      await api.post("/supervisors", {
        name: supName.trim(),
        email: supEmail.trim().toLowerCase(),
        phone: supPhone.trim(),
        gender: supGender,
        password: generateTempPassword(),
        pan_number: supPan.trim() || undefined,
        bank_account_number: supBankAccount.trim() || undefined,
        bank_ifsc: supBankIfsc.trim() || undefined,
        aadhar_number: supAadharNumber.trim(),
        aadhar_photo: aadharPhotoUrl,
        supervisor_photo: photoUrl || undefined,
      });
      setShowSupModal(false);
      resetSupForm(); setErrors({});
      fetchAll();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to add supervisor");
    } finally {
      setSavingSup(false);
    }
  };

  const validateDriver = () => {
    const errs = {};
    if (!drvName.trim()) errs.name = "Name is required";
    if (!drvEmail.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(drvEmail.trim())) errs.email = "Please enter a valid email address";
    if (!drvPassword.trim()) errs.pin = "PIN is required";
    else if (drvPassword.length !== 4 || !/^\d{4}$/.test(drvPassword)) errs.pin = "PIN must be exactly 4 digits";
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

  const saveDriver = async () => {
    const errs = validateDriver();
    setDriverErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSavingDrv(true);
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
        phone: drvPhone.trim(),
        gender: drvGender,
        pin: drvPassword,
        driver_photo: photoUrl || undefined,
        pan_number: drvPan.trim() || undefined,
        bank_account_number: drvBankAccount.trim() || undefined,
        bank_ifsc: drvBankIfsc.trim() || undefined,
        driving_license_number: drvLicenseNumber.trim(),
        driving_license_photo: licensePhotoUrl,
        aadhar_number: drvAadharNumber.trim(),
        aadhar_photo: aadharPhotoUrl,
      });
      setShowDrvModal(false);
      resetDrvForm();
      fetchAll();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to add driver");
    } finally {
      setSavingDrv(false);
    }
  };

  const handleResendInvite = async (s) => {
    setResendingInviteId(s.id);
    try {
      await api.post(`/supervisors/${s.id}/resend-invite`);
      Alert.alert("Invite Sent", `Verification email resent to ${s.email}`);
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to resend invite");
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleSupervisorLongPress = (s) => {
    Alert.alert("Supervisor Options", s.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: async () => {
          setProcessingId(s.id);
          try {
            await api.delete(`/supervisors/${s.id}`);
            Alert.alert("Success", "Deactivated successfully");
            fetchAll();
          } catch (e) {
            Alert.alert("Error", e.response?.data?.detail || "Failed to deactivate");
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  };

  const handleDriverLongPress = (d) => {
    Alert.alert("Driver Options", d.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: async () => {
          setProcessingId(d.id);
          try {
            await api.delete(`/drivers/${d.id}`);
            Alert.alert("Success", "Deactivated successfully");
            fetchAll();
          } catch (e) {
            Alert.alert("Error", e.response?.data?.detail || "Failed to deactivate");
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
        <View style={{ backgroundColor: "#7C3AED", paddingHorizontal: rp(20), paddingBottom: rp(20), paddingTop: rp(8) }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(16) }}>
            <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8) }}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(12) }}>Employees</Text>
          </View>

          <View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: rp(16), padding: rp(4) }}>
            <TouchableOpacity
              onPress={() => setTab("supervisors")}
              style={{
                flex: 1,
                paddingVertical: rp(10),
                borderRadius: rp(12),
                backgroundColor: tab === "supervisors" ? "#fff" : "transparent",
                alignItems: "center"
              }}
            >
              <Text style={{ fontWeight: "800", color: tab === "supervisors" ? "#7C3AED" : "rgba(255,255,255,0.6)", fontSize: rs(13) }}>Supervisors</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTab("drivers")}
              style={{
                flex: 1,
                paddingVertical: rp(10),
                borderRadius: rp(12),
                backgroundColor: tab === "drivers" ? "#fff" : "transparent",
                alignItems: "center"
              }}
            >
              <Text style={{ fontWeight: "800", color: tab === "drivers" ? "#7C3AED" : "rgba(255,255,255,0.6)", fontSize: rs(13) }}>Drivers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ paddingHorizontal: rp(20), paddingVertical: rp(12) }}>
        <View style={{ backgroundColor: "#fff", borderRadius: rp(16), borderWidth: rp(1), borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: rp(14) }}>
          <Ionicons name="search-outline" size={18} color="#7C3AED" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${tab}...`}
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(12), fontSize: rs(14), color: "#111827" }}
          />
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: rp(16) }}>
        {loading ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: rp(20) }} />
        ) : (
          <>
            {tab === "supervisors" ? (
              filteredSupervisors.map(s => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => router.push({ pathname: "/(admin)/supervisor-detail", params: { supervisorId: s.id, supervisorName: s.name } })}
                  onLongPress={() => handleSupervisorLongPress(s)}
                  activeOpacity={0.85}
                  style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(16), marginBottom: rp(12), flexDirection: "row", alignItems: "center", ...cardShadow }}
                >
                  <View style={{ backgroundColor: "#7C3AED", borderRadius: rp(99), width: rp(48), height: rp(48), alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(18) }}>{s.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: rp(14) }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: rp(6) }}>
                      <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(15) }}>
                        {s.name}
                      </Text>
                      {!s.is_verified && (
                        <View style={{
                          backgroundColor: "#FEF3C7",
                          borderRadius: rp(99),
                          paddingHorizontal: rp(6),
                          paddingVertical: rp(2),
                        }}>
                          <Text style={{ color: "#D97706", fontSize: rs(9), fontWeight: "800" }}>
                            UNVERIFIED
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>
                      {s.email}
                    </Text>
                    {!s.is_verified && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleResendInvite(s);
                        }}
                        disabled={resendingInviteId === s.id}
                        style={{
                          marginTop: rp(6),
                          alignSelf: "flex-start",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: rp(4),
                          backgroundColor: "#FEF3C7",
                          borderWidth: 1,
                          borderColor: "#F59E0B",
                          borderRadius: rp(8),
                          paddingHorizontal: rp(10),
                          paddingVertical: rp(4),
                        }}
                      >
                        {resendingInviteId === s.id ? (
                          <ActivityIndicator size="small" color="#D97706" />
                        ) : (
                          <Ionicons name="mail-outline" size={12} color="#D97706" />
                        )}
                        <Text style={{ color: "#D97706", fontSize: rs(11), fontWeight: "700" }}>
                          {resendingInviteId === s.id ? "Sending..." : "Resend Invite"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {processingId === s.id ? (
                    <ActivityIndicator size="small" color="#7C3AED" />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              ))
            ) : (
              filteredDrivers.map(d => (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => router.push({ pathname: "/(admin)/driver-stats", params: { driverId: d.id, driverName: d.name } })}
                  onLongPress={() => handleDriverLongPress(d)}
                  activeOpacity={0.85}
                  style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(16), marginBottom: rp(12), flexDirection: "row", alignItems: "center", ...cardShadow }}
                >
                  <View style={{ backgroundColor: "#059669", borderRadius: rp(99), width: rp(48), height: rp(48), alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(18) }}>{d.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: rp(14) }}>
                    <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(15) }}>{d.name}</Text>
                    <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>ID: {d.employee_id}</Text>
                  </View>
                  {processingId === d.id ? (
                    <ActivityIndicator size="small" color="#059669" />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              ))
            )}
            
            {(tab === "supervisors" ? filteredSupervisors : filteredDrivers).length === 0 && (
              <View style={{ alignItems: "center", marginTop: rp(60) }}>
                <Text style={{ fontSize: rs(48) }}>{tab === "supervisors" ? "🛡️" : "👥"}</Text>
                <Text style={{ color: "#6B7280", marginTop: rp(8), fontWeight: "700" }}>No {tab} found</Text>
              </View>
            )}
          </>
        )}
        <View style={{ height: rp(100) }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => tab === "supervisors" ? setShowSupModal(true) : setShowDrvModal(true)}
        style={{ position: "absolute", bottom: 24, right: 24, width: rp(60), height: rp(60), borderRadius: rp(30), backgroundColor: tab === "supervisors" ? "#7C3AED" : "#059669", alignItems: "center", justifyContent: "center", ...cardShadow }}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Supervisor Modal */}
      <Modal visible={showSupModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, maxHeight: "90%" }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: rp(20), paddingBottom: rp(32) }}>
                <View style={{ alignItems: "center", marginBottom: rp(12) }}><View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} /></View>
                <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#7C3AED", marginBottom: rp(16) }}>Add Supervisor</Text>

                <TouchableOpacity onPress={() => {
                  pickImageHelper({
                    quality: 0.8,
                    onSelect: (uri) => {
                      setSupPhotoUri(uri);
                      setSupPhoto(uri);
                    }
                  });
                }} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Supervisor Photo (optional)</Text>
                  {supPhotoUri ? (
                    <View style={{ position: "relative" }}>
                      <Image source={{ uri: supPhotoUri }} style={{ width: rp(80), height: rp(80), borderRadius: rp(40), borderWidth: rp(2), borderColor: "#7C3AED" }} />
                      <TouchableOpacity 
                        onPress={() => { setSupPhotoUri(null); setSupPhoto(null); }} 
                        style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                      >
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
                <TextInput value={supName} onChangeText={(t) => { setSupName(t); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })); }} placeholder="Full Name" style={[modalInput, errors.name && modalInputError]} />
                {errors.name && <Text style={modalErrorText}>* {errors.name}</Text>}
                <Text style={modalLabel}>EMAIL <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={supEmail} onChangeText={(t) => { setSupEmail(t); if (errors.email) setErrors(prev => ({ ...prev, email: undefined })); }} placeholder="email@example.com" autoCapitalize="none" style={[modalInput, errors.email && modalInputError]} />
                {errors.email && <Text style={modalErrorText}>* {errors.email}</Text>}
                <Text style={modalLabel}>PHONE <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={supPhone} onChangeText={(t) => { setSupPhone(t); if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined })); }} maxLength={10} placeholder="10-digit mobile" keyboardType="phone-pad" style={[modalInput, errors.phone && modalInputError]} />
                {errors.phone && <Text style={modalErrorText}>* {errors.phone}</Text>}
                <Text style={modalLabel}>GENDER <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={{ flexDirection: 'row', gap: rp(10), marginBottom: rp(16) }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: rp(12), borderRadius: rp(12), borderWidth: rp(1), borderColor: errors.gender && !supGender ? '#EF4444' : (supGender === 'male' ? '#1D4ED8' : '#E5E7EB'), backgroundColor: supGender === 'male' ? '#EFF6FF' : '#FFF', alignItems: 'center' }}
                    onPress={() => { setSupGender('male'); if (errors.gender) setErrors(prev => ({ ...prev, gender: undefined })); }}
                  >
                    <Text style={{ fontWeight: '600', color: supGender === 'male' ? '#1D4ED8' : '#4B5563', fontSize: rp(14) }}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: rp(12), borderRadius: rp(12), borderWidth: rp(1), borderColor: errors.gender && !supGender ? '#EF4444' : (supGender === 'female' ? '#1D4ED8' : '#E5E7EB'), backgroundColor: supGender === 'female' ? '#EFF6FF' : '#FFF', alignItems: 'center' }}
                    onPress={() => { setSupGender('female'); if (errors.gender) setErrors(prev => ({ ...prev, gender: undefined })); }}
                  >
                    <Text style={{ fontWeight: '600', color: supGender === 'female' ? '#1D4ED8' : '#4B5563', fontSize: rp(14) }}>Female</Text>
                  </TouchableOpacity>
                </View>
                {errors.gender && <Text style={modalErrorText}>* {errors.gender}</Text>}
                {/* <Text style={modalLabel}>PASSWORD <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={supPassword} onChangeText={(t) => { setSupPassword(t); if (errors.password) setErrors(prev => ({ ...prev, password: undefined })); }} placeholder="Min 6 characters" secureTextEntry style={[modalInput, errors.password && modalInputError]} />
                {errors.password && <Text style={modalErrorText}>* {errors.password}</Text>} */}
                <Text style={modalLabel}>PAN CARD NUMBER (OPTIONAL)</Text>
                <TextInput value={supPan} onChangeText={(v) => { setSupPan(v.toUpperCase()); if (errors.pan) setErrors(prev => ({ ...prev, pan: undefined })); }} placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} style={[modalInput, errors.pan && modalInputError]} />
                {errors.pan && <Text style={modalErrorText}>* {errors.pan}</Text>}
                <Text style={modalLabel}>BANK ACCOUNT NUMBER</Text>
                <TextInput value={supBankAccount} onChangeText={(t) => { setSupBankAccount(t); if (errors.bankAccount) setErrors(prev => ({ ...prev, bankAccount: undefined })); }} placeholder="Account number" keyboardType="numeric" maxLength={18} style={[modalInput, errors.bankAccount && modalInputError]} />
                {errors.bankAccount && <Text style={modalErrorText}>* {errors.bankAccount}</Text>}
                <Text style={modalLabel}>BANK IFSC CODE</Text>
                <TextInput value={supBankIfsc} onChangeText={(v) => {
                  const upper = v.toUpperCase();
                  setSupBankIfsc(upper);
                  if (errors.bankIfsc) setErrors(prev => ({ ...prev, bankIfsc: undefined }));
                  if (upper !== supBankIfsc) setSupIfscInfo(null);
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
                }} placeholder="SBIN0001234" autoCapitalize="characters" maxLength={11} style={[modalInput, errors.bankIfsc && modalInputError]} />
                {errors.bankIfsc && <Text style={modalErrorText}>* {errors.bankIfsc}</Text>}
                {supIfscChecking && <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>Checking IFSC...</Text>}
                {supIfscInfo === "unverified" && (
                  <Text style={{ color: "#D97706", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    Couldn't verify IFSC right now — you can still continue
                  </Text>
                )}
                {supIfscInfo && supIfscInfo !== "error" && (
                  <Text style={{ color: "#059669", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    {supIfscInfo.bank} — {supIfscInfo.branch}, {supIfscInfo.city}
                  </Text>
                )}
                {supIfscInfo === "error" && (
                  <Text style={{ color: "#EF4444", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    IFSC code not found
                  </Text>
                )}
                <Text style={modalLabel}>AADHAR NUMBER <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={supAadharNumber} onChangeText={(t) => { setSupAadharNumber(t); if (errors.aadharNumber) setErrors(prev => ({ ...prev, aadharNumber: undefined })); }} placeholder="Aadhar number" keyboardType="numeric" maxLength={12} style={[modalInput, errors.aadharNumber && modalInputError]} />
                {errors.aadharNumber && <Text style={modalErrorText}>* {errors.aadharNumber}</Text>}

                <TouchableOpacity onPress={() => { pickSupAadharPhoto(); if (errors.aadharPhoto) setErrors(prev => ({ ...prev, aadharPhoto: undefined })); }} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Aadhar Photo <Text style={{ color: '#EF4444' }}>*</Text></Text>
                  {supAadharPhotoUri ? (
                    <View style={{ position: "relative" }}>
                      <Image source={{ uri: supAadharPhotoUri }} style={{ width: rp(120), height: rp(80), borderRadius: rp(12), borderWidth: rp(2), borderColor: errors.aadharPhoto ? "#EF4444" : "#059669" }} />
                      <TouchableOpacity 
                        onPress={() => { setSupAadharPhotoUri(null); }} 
                        style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ width: rp(120), height: rp(80), borderRadius: rp(12), borderWidth: rp(1), borderColor: errors.aadharPhoto ? "#EF4444" : "#CBD5E1", borderStyle: "dashed", backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" }}>
                      <Ionicons name="camera" size={32} color={errors.aadharPhoto ? "#EF4444" : "#94A3B8"} />
                      <Text style={{ fontSize: rs(10), color: errors.aadharPhoto ? "#EF4444" : "#64748B", marginTop: rp(4) }}>Upload</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {errors.aadharPhoto && <Text style={[modalErrorText, { textAlign: 'center' }]}>* {errors.aadharPhoto}</Text>}

                <TouchableOpacity onPress={saveSupervisor} disabled={savingSup} style={{ backgroundColor: "#7C3AED", borderRadius: rp(16), paddingVertical: rp(16), alignItems: "center", marginTop: rp(8) }}>
                  {savingSup ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>SAVE SUPERVISOR</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { resetSupForm(); setShowSupModal(false); }} style={{ paddingVertical: rp(12), alignItems: "center" }}>
                  <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Driver Modal */}
      <Modal visible={showDrvModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, maxHeight: "90%" }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: rp(20), paddingBottom: rp(32) }}>
                <View style={{ alignItems: "center", marginBottom: rp(12) }}><View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} /></View>
                <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#059669", marginBottom: rp(16) }}>Add Driver</Text>

                <TouchableOpacity onPress={pickDriverPhoto} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Driver Photo (optional)</Text>
                  {drvPhotoUri ? (
                    <View style={{ position: "relative" }}>
                      <Image source={{ uri: drvPhotoUri }} style={{ width: rp(80), height: rp(80), borderRadius: rp(40), borderWidth: rp(2), borderColor: "#059669" }} />
                      <TouchableOpacity 
                        onPress={() => { setDrvPhotoUri(null); setDrvPhoto(null); }} 
                        style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                      >
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
                <TextInput value={drvName} onChangeText={(t) => { setDrvName(t); if (driverErrors.name) setDriverErrors(prev => ({ ...prev, name: undefined })); }} placeholder="Full Name" style={[modalInput, driverErrors.name && modalInputError]} />
                {driverErrors.name && <Text style={modalErrorText}>* {driverErrors.name}</Text>}
                <Text style={modalLabel}>PHONE <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvPhone} onChangeText={(t) => { setDrvPhone(t); if (driverErrors.phone) setDriverErrors(prev => ({ ...prev, phone: undefined })); }} maxLength={10} placeholder="10-digit mobile" keyboardType="phone-pad" style={[modalInput, driverErrors.phone && modalInputError]} />
                {driverErrors.phone && <Text style={modalErrorText}>* {driverErrors.phone}</Text>}
                <Text style={modalLabel}>GENDER <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={{ flexDirection: 'row', gap: rp(10), marginBottom: rp(16) }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: rp(12), borderRadius: rp(12), borderWidth: rp(1), borderColor: driverErrors.gender && !drvGender ? '#EF4444' : (drvGender === 'male' ? '#1D4ED8' : '#E5E7EB'), backgroundColor: drvGender === 'male' ? '#EFF6FF' : '#FFF', alignItems: 'center' }}
                    onPress={() => { setDrvGender('male'); if (driverErrors.gender) setDriverErrors(prev => ({ ...prev, gender: undefined })); }}
                  >
                    <Text style={{ fontWeight: '600', color: drvGender === 'male' ? '#1D4ED8' : '#4B5563', fontSize: rp(14) }}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: rp(12), borderRadius: rp(12), borderWidth: rp(1), borderColor: driverErrors.gender && !drvGender ? '#EF4444' : (drvGender === 'female' ? '#1D4ED8' : '#E5E7EB'), backgroundColor: drvGender === 'female' ? '#EFF6FF' : '#FFF', alignItems: 'center' }}
                    onPress={() => { setDrvGender('female'); if (driverErrors.gender) setDriverErrors(prev => ({ ...prev, gender: undefined })); }}
                  >
                    <Text style={{ fontWeight: '600', color: drvGender === 'female' ? '#1D4ED8' : '#4B5563', fontSize: rp(14) }}>Female</Text>
                  </TouchableOpacity>
                </View>
                {driverErrors.gender && <Text style={modalErrorText}>* {driverErrors.gender}</Text>}
                <Text style={modalLabel}>4-DIGIT PIN <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvPassword} onChangeText={(t) => { setDrvPassword(t); if (driverErrors.pin) setDriverErrors(prev => ({ ...prev, pin: undefined })); }} placeholder="e.g. 1234" keyboardType="numeric" maxLength={4} style={[modalInput, driverErrors.pin && modalInputError]} />
                {driverErrors.pin && <Text style={modalErrorText}>* {driverErrors.pin}</Text>}
                <Text style={modalLabel}>EMAIL <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvEmail} onChangeText={(t) => { setDrvEmail(t); if (driverErrors.email) setDriverErrors(prev => ({ ...prev, email: undefined })); }} placeholder="driver@example.com" autoCapitalize="none" keyboardType="email-address" style={[modalInput, driverErrors.email && modalInputError]} />
                {driverErrors.email && <Text style={modalErrorText}>* {driverErrors.email}</Text>}
                <Text style={modalLabel}>PAN CARD NUMBER (OPTIONAL)</Text>
                <TextInput value={drvPan} onChangeText={(v) => { setDrvPan(v.toUpperCase()); if (driverErrors.pan) setDriverErrors(prev => ({ ...prev, pan: undefined })); }} placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} style={[modalInput, driverErrors.pan && modalInputError]} />
                {driverErrors.pan && <Text style={modalErrorText}>* {driverErrors.pan}</Text>}
                <Text style={modalLabel}>BANK ACCOUNT NUMBER</Text>
                <TextInput value={drvBankAccount} onChangeText={(t) => { setDrvBankAccount(t); if (driverErrors.bankAccount) setDriverErrors(prev => ({ ...prev, bankAccount: undefined })); }} placeholder="Account number" keyboardType="numeric" maxLength={18} style={[modalInput, driverErrors.bankAccount && modalInputError]} />
                {driverErrors.bankAccount && <Text style={modalErrorText}>* {driverErrors.bankAccount}</Text>}
                <Text style={modalLabel}>BANK IFSC CODE</Text>
                <TextInput value={drvBankIfsc} onChangeText={(v) => {
                  const upper = v.toUpperCase();
                  setDrvBankIfsc(upper);
                  if (driverErrors.bankIfsc) setDriverErrors(prev => ({ ...prev, bankIfsc: undefined }));
                  if (upper !== drvBankIfsc) setDrvIfscInfo(null);
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
                }} placeholder="SBIN0001234" autoCapitalize="characters" maxLength={11} style={[modalInput, driverErrors.bankIfsc && modalInputError]} />
                {driverErrors.bankIfsc && <Text style={modalErrorText}>* {driverErrors.bankIfsc}</Text>}
                {drvIfscChecking && <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>Checking IFSC...</Text>}
                {drvIfscInfo === "unverified" && (
                  <Text style={{ color: "#D97706", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    Couldn't verify IFSC right now — you can still continue
                  </Text>
                )}
                {drvIfscInfo && drvIfscInfo !== "error" && (
                  <Text style={{ color: "#059669", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    {drvIfscInfo.bank} — {drvIfscInfo.branch}, {drvIfscInfo.city}
                  </Text>
                )}
                {drvIfscInfo === "error" && (
                  <Text style={{ color: "#EF4444", fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(16) }}>
                    IFSC code not found
                  </Text>
                )}
                <Text style={modalLabel}>DRIVING LICENCE NUMBER <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvLicenseNumber} onChangeText={(v) => { setDrvLicenseNumber(v.toUpperCase()); if (driverErrors.licenseNumber) setDriverErrors(prev => ({ ...prev, licenseNumber: undefined })); }} placeholder="DL number" autoCapitalize="characters" style={[modalInput, driverErrors.licenseNumber && modalInputError]} />
                {driverErrors.licenseNumber && <Text style={modalErrorText}>* {driverErrors.licenseNumber}</Text>}

                <TouchableOpacity onPress={() => { pickLicensePhoto(); if (driverErrors.licensePhoto) setDriverErrors(prev => ({ ...prev, licensePhoto: undefined })); }} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Licence Photo <Text style={{ color: '#EF4444' }}>*</Text></Text>
                  {drvLicensePhotoUri ? (
                    <View style={{ position: "relative" }}>
                      <Image source={{ uri: drvLicensePhotoUri }} style={{ width: rp(120), height: rp(80), borderRadius: rp(12), borderWidth: rp(2), borderColor: driverErrors.licensePhoto ? "#EF4444" : "#059669" }} />
                      <TouchableOpacity 
                        onPress={() => { setDrvLicensePhotoUri(null); setDrvLicensePhoto(null); }} 
                        style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ width: rp(120), height: rp(80), borderRadius: rp(12), backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: driverErrors.licensePhoto ? "#EF4444" : "#E5E7EB", borderStyle: "dashed" }}>
                      <Ionicons name="document-outline" size={28} color={driverErrors.licensePhoto ? "#EF4444" : "#9CA3AF"} />
                    </View>
                  )}
                </TouchableOpacity>
                {driverErrors.licensePhoto && <Text style={[modalErrorText, { textAlign: 'center' }]}>* {driverErrors.licensePhoto}</Text>}

                <Text style={modalLabel}>AADHAR NUMBER <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput value={drvAadharNumber} onChangeText={(t) => { setDrvAadharNumber(t); if (driverErrors.aadharNumber) setDriverErrors(prev => ({ ...prev, aadharNumber: undefined })); }} placeholder="Aadhar number" keyboardType="numeric" maxLength={12} style={[modalInput, driverErrors.aadharNumber && modalInputError]} />
                {driverErrors.aadharNumber && <Text style={modalErrorText}>* {driverErrors.aadharNumber}</Text>}

                <TouchableOpacity onPress={() => { pickAadharPhoto(); if (driverErrors.aadharPhoto) setDriverErrors(prev => ({ ...prev, aadharPhoto: undefined })); }} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Aadhar Photo <Text style={{ color: '#EF4444' }}>*</Text></Text>
                  {drvAadharPhotoUri ? (
                    <View style={{ position: "relative" }}>
                      <Image source={{ uri: drvAadharPhotoUri }} style={{ width: rp(120), height: rp(80), borderRadius: rp(12), borderWidth: rp(2), borderColor: driverErrors.aadharPhoto ? "#EF4444" : "#059669" }} />
                      <TouchableOpacity 
                        onPress={() => { setDrvAadharPhotoUri(null); }} 
                        style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ width: rp(120), height: rp(80), borderRadius: rp(12), backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: driverErrors.aadharPhoto ? "#EF4444" : "#E5E7EB", borderStyle: "dashed" }}>
                      <Ionicons name="document-outline" size={28} color={driverErrors.aadharPhoto ? "#EF4444" : "#9CA3AF"} />
                    </View>
                  )}
                </TouchableOpacity>
                {driverErrors.aadharPhoto && <Text style={[modalErrorText, { textAlign: 'center' }]}>* {driverErrors.aadharPhoto}</Text>}

                <TouchableOpacity onPress={saveDriver} disabled={savingDrv} style={{ backgroundColor: "#059669", borderRadius: rp(16), paddingVertical: rp(16), alignItems: "center" }}>
                  {savingDrv ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>SAVE DRIVER</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { resetDrvForm(); setShowDrvModal(false); setDriverErrors({}); }} style={{ paddingVertical: rp(12), alignItems: "center" }}>
                  <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const modalLabel = { fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(2), marginBottom: rp(8) };
const modalInputError = { borderColor: "#EF4444" };
const modalErrorText = { color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) };
const modalInput = { backgroundColor: "#F9FAFB", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", padding: rp(14), color: "#111827", marginBottom: rp(16), fontSize: rs(15), fontWeight: "700" };
