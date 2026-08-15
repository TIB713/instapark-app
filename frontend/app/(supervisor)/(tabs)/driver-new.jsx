import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { rs, rp } from "../../../utils/responsive";
import { theme } from "../../../utils/theme";
import { Screen, TopBar, Btn } from "../../../components/valet/ui";
import { confirmDialog } from "../../../lib/confirmDialog";
import api from "../../../lib/api";
import { pickImageHelper } from "../../../utils/imagePicker";

export default function DriverNew() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

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
  const [drvAadharPhoto, setDrvAadharPhoto] = useState(null);
  const [drvAadharPhotoUri, setDrvAadharPhotoUri] = useState(null);
  const [savingDrv, setSavingDrv] = useState(false);
  const [drvPan, setDrvPan] = useState("");
  const [drvBankAccount, setDrvBankAccount] = useState("");
  const [drvBankIfsc, setDrvBankIfsc] = useState("");
  const [drvAadharNumber, setDrvAadharNumber] = useState("");
  const [drvIfscInfo, setDrvIfscInfo] = useState(null);
  const [drvIfscChecking, setDrvIfscChecking] = useState(false);
  const [driverErrors, setDriverErrors] = useState({});

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

  const pickDriverPhoto = () => {
    pickImageHelper({
      quality: 0.8,
      onSelect: (uri) => {
        setDrvPhotoUri(uri);
      }
    });
  };

  const pickLicensePhoto = () => {
    pickImageHelper({
      quality: 0.8,
      onSelect: (uri) => {
        setDrvLicensePhotoUri(uri);
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

  const saveDriver = async () => {
    const errs = validateDriver();
    setDriverErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSavingDrv(true);
    let photoUrl;
    if (drvPhotoUri && !drvPhotoUri.startsWith('http')) {
      try {
        photoUrl = await uploadDriverImage(drvPhotoUri, "drivers");
      } catch (e) {
        confirmDialog.info("Upload failed", "Failed to upload photo.");
        setSavingDrv(false);
        return;
      }
    } else {
        photoUrl = drvPhotoUri;
    }
    let licensePhotoUrl;
    if (drvLicensePhotoUri && !drvLicensePhotoUri.startsWith('http')) {
      try {
        licensePhotoUrl = await uploadDriverImage(drvLicensePhotoUri, "drivers/licenses");
      } catch (e) {
        confirmDialog.info("Upload failed", "Failed to upload license photo.");
        setSavingDrv(false);
        return;
      }
    } else {
        licensePhotoUrl = drvLicensePhotoUri;
    }
    let aadharPhotoUrl;
    if (drvAadharPhotoUri && !drvAadharPhotoUri.startsWith('http')) {
      try {
        aadharPhotoUrl = await uploadDriverImage(drvAadharPhotoUri, "aadhar_photos");
      } catch (e) {
        confirmDialog.info("Upload failed", "Failed to upload aadhar photo.");
        setSavingDrv(false);
        return;
      }
    } else {
        aadharPhotoUrl = drvAadharPhotoUri;
    }
    
    try {
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
        license_number: drvLicenseNumber.trim(),
        license_photo: licensePhotoUrl,
        aadhar_number: drvAadharNumber.trim(),
        aadhar_photo: aadharPhotoUrl,
      });
      router.replace("/(supervisor)/(tabs)/team");
    } catch (e) {
      confirmDialog.info("Error", `Failed to save driver: ${e?.response?.data?.detail || "Failed to add driver"}`);
    } finally {
      setSavingDrv(false);
    }
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



  return (
    <Screen scroll={false}>
      <TopBar title="Add Driver" onBack={() => router.replace("/(supervisor)/(tabs)/team")} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: rp(theme.spacing.xl), paddingBottom: rp(theme.spacing.xxxl) + (insets?.bottom || 0) + tabBarHeight }}>

                

                <TouchableOpacity onPress={pickDriverPhoto} style={{ alignItems: "center", marginBottom: rp(theme.spacing.lg) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Driver Photo (optional)</Text>
                  {drvPhotoUri ? (
                    <View style={{ position: "relative" }}>
                      <Image source={{ uri: drvPhotoUri }} style={{ width: rp(80), height: rp(80), borderRadius: rp(40), borderWidth: rp(2), borderColor: theme.colors.success }} />
                      <TouchableOpacity 
                        onPress={() => { setDrvPhotoUri(null); setDrvPhoto(null); }} 
                        style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                      >
                        <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ width: rp(80), height: rp(80), borderRadius: rp(40), backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: theme.colors.border, borderStyle: "dashed" }}>
                      <Ionicons name="person" size={32} color={theme.colors.textMuted} />
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={modalLabel}>NAME <Text style={{ color: theme.colors.danger }}>*</Text></Text>
                <TextInput value={drvName} onChangeText={(t) => { setDrvName(t); if (driverErrors.name) setDriverErrors(prev => ({ ...prev, name: undefined })); }} placeholder="Full Name" style={[modalInput, driverErrors.name && modalInputError]} />
                {driverErrors.name && <Text style={modalErrorText}>* {driverErrors.name}</Text>}
                <Text style={modalLabel}>PHONE <Text style={{ color: theme.colors.danger }}>*</Text></Text>
                <TextInput value={drvPhone} onChangeText={(t) => { setDrvPhone(t); if (driverErrors.phone) setDriverErrors(prev => ({ ...prev, phone: undefined })); }} maxLength={10} placeholder="10-digit mobile" keyboardType="phone-pad" style={[modalInput, driverErrors.phone && modalInputError]} />
                {driverErrors.phone && <Text style={modalErrorText}>* {driverErrors.phone}</Text>}
                <Text style={modalLabel}>GENDER <Text style={{ color: theme.colors.danger }}>*</Text></Text>
                <View style={{ flexDirection: 'row', gap: rp(10), marginBottom: rp(theme.spacing.lg) }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: rp(theme.spacing.md), borderRadius: rp(theme.spacing.md), borderWidth: rp(1), borderColor: driverErrors.gender && !drvGender ? theme.colors.danger : (drvGender === 'male' ? theme.colors.info : theme.colors.border), backgroundColor: drvGender === 'male' ? theme.colors.infoLight : theme.colors.surface, alignItems: 'center' }}
                    onPress={() => { setDrvGender('male'); if (driverErrors.gender) setDriverErrors(prev => ({ ...prev, gender: undefined })); }}
                  >
                    <Text style={{ fontWeight: '600', color: drvGender === 'male' ? theme.colors.info : theme.colors.textSecondary, fontSize: rp(14) }}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: rp(theme.spacing.md), borderRadius: rp(theme.spacing.md), borderWidth: rp(1), borderColor: driverErrors.gender && !drvGender ? theme.colors.danger : (drvGender === 'female' ? theme.colors.info : theme.colors.border), backgroundColor: drvGender === 'female' ? theme.colors.infoLight : theme.colors.surface, alignItems: 'center' }}
                    onPress={() => { setDrvGender('female'); if (driverErrors.gender) setDriverErrors(prev => ({ ...prev, gender: undefined })); }}
                  >
                    <Text style={{ fontWeight: '600', color: drvGender === 'female' ? theme.colors.info : theme.colors.textSecondary, fontSize: rp(14) }}>Female</Text>
                  </TouchableOpacity>
                </View>
                {driverErrors.gender && <Text style={modalErrorText}>* {driverErrors.gender}</Text>}
                <Text style={modalLabel}>4-DIGIT PIN <Text style={{ color: theme.colors.danger }}>*</Text></Text>
                <TextInput value={drvPassword} onChangeText={(t) => { setDrvPassword(t); if (driverErrors.pin) setDriverErrors(prev => ({ ...prev, pin: undefined })); }} placeholder="e.g. 1234" keyboardType="numeric" maxLength={4} style={[modalInput, driverErrors.pin && modalInputError]} />
                {driverErrors.pin && <Text style={modalErrorText}>* {driverErrors.pin}</Text>}
                <Text style={modalLabel}>EMAIL <Text style={{ color: theme.colors.danger }}>*</Text></Text>
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
                {drvIfscChecking && <Text style={{ color: theme.colors.textMuted, fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(theme.spacing.lg) }}>Checking IFSC...</Text>}
                {drvIfscInfo === "unverified" && (
                  <Text style={{ color: theme.colors.warning, fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(theme.spacing.lg) }}>
                    Couldn't verify IFSC right now — you can still continue
                  </Text>
                )}
                {drvIfscInfo && drvIfscInfo !== "error" && (
                  <Text style={{ color: theme.colors.success, fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(theme.spacing.lg) }}>
                    {drvIfscInfo.bank} — {drvIfscInfo.branch}, {drvIfscInfo.city}
                  </Text>
                )}
                {drvIfscInfo === "error" && (
                  <Text style={{ color: theme.colors.danger, fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(theme.spacing.lg) }}>
                    IFSC code not found
                  </Text>
                )}
                <Text style={modalLabel}>DRIVING LICENCE NUMBER <Text style={{ color: theme.colors.danger }}>*</Text></Text>
                <TextInput value={drvLicenseNumber} onChangeText={(v) => { setDrvLicenseNumber(v.toUpperCase()); if (driverErrors.licenseNumber) setDriverErrors(prev => ({ ...prev, licenseNumber: undefined })); }} placeholder="DL number" maxLength={16} autoCapitalize="characters" style={[modalInput, driverErrors.licenseNumber && modalInputError]} />
                {driverErrors.licenseNumber && <Text style={modalErrorText}>* {driverErrors.licenseNumber}</Text>}

                <TouchableOpacity onPress={() => { pickLicensePhoto(); if (driverErrors.licensePhoto) setDriverErrors(prev => ({ ...prev, licensePhoto: undefined })); }} style={{ alignItems: "center", marginBottom: rp(theme.spacing.lg) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Licence Photo <Text style={{ color: theme.colors.danger }}>*</Text></Text>
                  {drvLicensePhotoUri ? (
                    <View style={{ position: "relative" }}>
                      <Image source={{ uri: drvLicensePhotoUri }} style={{ width: rp(120), height: rp(80), borderRadius: rp(theme.spacing.md), borderWidth: rp(2), borderColor: driverErrors.licensePhoto ? theme.colors.danger : theme.colors.success }} />
                      <TouchableOpacity 
                        onPress={() => { setDrvLicensePhotoUri(null); setDrvLicensePhoto(null); }} 
                        style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                      >
                        <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ width: rp(120), height: rp(80), borderRadius: rp(theme.spacing.md), backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: driverErrors.licensePhoto ? theme.colors.danger : theme.colors.border, borderStyle: "dashed" }}>
                      <Ionicons name="document-outline" size={28} color={driverErrors.licensePhoto ? theme.colors.danger : theme.colors.textMuted} />
                    </View>
                  )}
                </TouchableOpacity>
                {driverErrors.licensePhoto && <Text style={[modalErrorText, { textAlign: 'center' }]}>* {driverErrors.licensePhoto}</Text>}

                <Text style={modalLabel}>AADHAR NUMBER <Text style={{ color: theme.colors.danger }}>*</Text></Text>
                <TextInput value={drvAadharNumber} onChangeText={(t) => { setDrvAadharNumber(t); if (driverErrors.aadharNumber) setDriverErrors(prev => ({ ...prev, aadharNumber: undefined })); }} placeholder="Aadhar number" keyboardType="numeric" maxLength={12} style={[modalInput, driverErrors.aadharNumber && modalInputError]} />
                {driverErrors.aadharNumber && <Text style={modalErrorText}>* {driverErrors.aadharNumber}</Text>}

                <TouchableOpacity onPress={() => { pickAadharPhoto(); if (driverErrors.aadharPhoto) setDriverErrors(prev => ({ ...prev, aadharPhoto: undefined })); }} style={{ alignItems: "center", marginBottom: rp(theme.spacing.lg) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Aadhar Photo <Text style={{ color: theme.colors.danger }}>*</Text></Text>
                  {drvAadharPhotoUri ? (
                    <View style={{ position: "relative" }}>
                      <Image source={{ uri: drvAadharPhotoUri }} style={{ width: rp(120), height: rp(80), borderRadius: rp(theme.spacing.md), borderWidth: rp(2), borderColor: driverErrors.aadharPhoto ? theme.colors.danger : theme.colors.success }} />
                      <TouchableOpacity 
                        onPress={() => { setDrvAadharPhotoUri(null); }} 
                        style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                      >
                        <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ width: rp(120), height: rp(80), borderRadius: rp(theme.spacing.md), backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: driverErrors.aadharPhoto ? theme.colors.danger : theme.colors.border, borderStyle: "dashed" }}>
                      <Ionicons name="document-outline" size={28} color={driverErrors.aadharPhoto ? theme.colors.danger : theme.colors.textMuted} />
                    </View>
                  )}
                </TouchableOpacity>
                {driverErrors.aadharPhoto && <Text style={[modalErrorText, { textAlign: 'center' }]}>* {driverErrors.aadharPhoto}</Text>}

                <TouchableOpacity onPress={saveDriver} disabled={savingDrv} style={{ backgroundColor: theme.colors.primary, borderRadius: rp(theme.spacing.lg), paddingVertical: rp(theme.spacing.lg), alignItems: "center" }}>
                  {savingDrv ? <ActivityIndicator color={theme.colors.surface} /> : <Text style={{ color: theme.colors.surface, fontWeight: "900" }}>SAVE DRIVER</Text>}
                </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const modalLabel = { fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(theme.spacing.sm) };
const modalInputError = { borderColor: theme.colors.danger };
const modalErrorText = { color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(theme.spacing.md) };
const modalInput = { backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(14), borderWidth: rp(1), borderColor: theme.colors.border, padding: rp(14), color: theme.colors.textPrimary, marginBottom: rp(theme.spacing.lg), fontSize: rs(15), fontWeight: "700" };
