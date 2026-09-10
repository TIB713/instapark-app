import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { rs, rp } from "../../../utils/responsive";
import { theme } from "../../../utils/theme";
import { Btn, Field, FieldLabel, fieldTextInputStyle } from "../../../components/valet/ui";
import { Hero } from "../../../components/admin/Hero";
import { confirmDialog } from "../../../lib/confirmDialog";
import api from "../../../lib/api";
import { pickImageHelper } from "../../../utils/imagePicker";
import { scrollToFirstError } from "../../../lib/scrollToFirstError";

const modalErrorText = { color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) };

export default function SupervisorEdit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const { supervisorId } = useLocalSearchParams();
  const [loadingSup, setLoadingSup] = useState(true);

  const scrollViewRef = useRef(null);
  const fieldRefs = useRef({});

  const [supName, setSupName] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supGender, setSupGender] = useState("");
  const [supPhoto, setSupPhoto] = useState(null);
  const [supPhotoUri, setSupPhotoUri] = useState(null);

  const [supPan, setSupPan] = useState("");
  const [supBankAccount, setSupBankAccount] = useState("");
  const [supBankIfsc, setSupBankIfsc] = useState("");
  const [supAadharNumber, setSupAadharNumber] = useState("");
  const [supAadharPhotoUri, setSupAadharPhotoUri] = useState(null);

  const [supIfscInfo, setSupIfscInfo] = useState(null);
  const [supIfscChecking, setSupIfscChecking] = useState(false);
  const [supIsActive, setSupIsActive] = useState(true);

  const [savingSup, setSavingSup] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchSupervisor = async () => {
      try {
        const { data } = await api.get(`/supervisors`);
        const sup = data.find(s => s.id === parseInt(supervisorId) || s.id === supervisorId);
        if (sup) {
          setSupName(sup.name || "");
          setSupEmail(sup.email || "");
          setSupPhone(sup.phone || "");
          setSupGender(sup.gender || "");
          setSupPan(sup.pan_number || "");
          setSupBankAccount(sup.bank_account_number || "");
          setSupBankIfsc(sup.bank_ifsc || "");
          setSupAadharNumber(sup.aadhar_number || "");
          setSupIsActive(sup.is_active ?? true);
          if (sup.supervisor_photo) setSupPhotoUri(sup.supervisor_photo);
          if (sup.aadhar_photo) setSupAadharPhotoUri(sup.aadhar_photo);
        }
      } catch (e) {
        console.warn("Failed to fetch supervisor details");
      } finally {
        setLoadingSup(false);
      }
    };
    if (supervisorId) fetchSupervisor();
  }, [supervisorId]);

  const validateSupervisor = () => {
    const errs = {};
    if (!supName.trim()) errs.name = "Name is required";
    if (!supEmail.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supEmail.trim())) errs.email = "Please enter a valid email address";
    if (!supGender) errs.gender = "Please select gender";
    if (!supPhone.trim()) errs.phone = "Phone is required";
    else if (!/^\d{10}$/.test(supPhone.trim().replace(/\D/g, ""))) errs.phone = "Please enter a valid 10-digit phone number";
    if (supPan.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(supPan.trim().toUpperCase())) errs.pan = "Expected format: ABCDE1234F";
    if (supBankAccount.trim() && !/^\d{9,18}$/.test(supBankAccount.trim())) errs.bankAccount = "Must be 9-18 digits";
    if (supBankIfsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(supBankIfsc.trim().toUpperCase())) errs.bankIfsc = "Expected format: ABCD0123456";
    else if (supBankIfsc.trim().length === 11 && supIfscInfo === "error") errs.bankIfsc = "This IFSC code was not found. Please check and try again.";
    if (!supAadharNumber.trim()) errs.aadharNumber = "Aadhar Number is required";
    else if (!/^\d{12}$/.test(supAadharNumber.trim())) errs.aadharNumber = "Aadhar number must be exactly 12 digits";
    if (!supAadharPhotoUri) errs.aadharPhoto = "Aadhar Photo is required";
    return errs;
  };

  const pickSupPhoto = () => {
    pickImageHelper({
      quality: 0.8,
      onSelect: (uri) => {
        setSupPhotoUri(uri);
        setSupPhoto(uri);
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

  const uploadSupervisorImage = async (uri, folder) => {
    const formData = new FormData();
    formData.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
    formData.append("folder", folder);
    const up = await api.post("/upload", formData, {
      timeout: 30000,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return up.data.url;
  };

  const saveSupervisor = async () => {
    const errs = validateSupervisor();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      scrollToFirstError(["name", "email", "phone", "pan", "bankAccount", "aadharNumber", "aadharPhoto"], errs, fieldRefs, scrollViewRef);
      return;
    }
    setSavingSup(true);
    let photoUrl;
    if (supPhotoUri && !supPhotoUri.startsWith('http')) {
      try {
        photoUrl = await uploadSupervisorImage(supPhotoUri, "supervisors");
      } catch (e) {
        confirmDialog.info("Upload failed", "Failed to upload photo — please check your connection and try again.");
        setSavingSup(false);
        return;
      }
    } else {
      photoUrl = supPhotoUri;
    }

    let aadharPhotoUrl;
    if (supAadharPhotoUri && !supAadharPhotoUri.startsWith('http')) {
      try {
        aadharPhotoUrl = await uploadSupervisorImage(supAadharPhotoUri, "aadhar_photos");
      } catch (e) {
        confirmDialog.info("Upload failed", "Failed to upload aadhar photo — please check your connection and try again.");
        setSavingSup(false);
        return;
      }
    } else {
      aadharPhotoUrl = supAadharPhotoUri;
    }

    try {
      await api.patch(`/supervisors/${supervisorId}`, {
        name: supName.trim(),
        email: supEmail.trim().toLowerCase(),
        phone: supPhone.trim(),
        gender: supGender,
        pan_number: supPan.trim() || undefined,
        bank_account_number: supBankAccount.trim() || undefined,
        bank_ifsc: supBankIfsc.trim() || undefined,
        aadhar_number: supAadharNumber.trim(),
        aadhar_photo: aadharPhotoUrl,
        supervisor_photo: photoUrl || undefined,
      });
      router.replace("/(admin)/(tabs)/manage-employees?tab=supervisors");
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : "Something went wrong. Please check your connection and try again.";
      confirmDialog.info("Couldn't save supervisor", msg);
    } finally {
      setSavingSup(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }} testID="edit-supervisor-screen">
      <Hero eyebrow="People" title="Edit supervisor" onBack={() => router.replace("/(admin)/(tabs)/manage-employees?tab=supervisors")} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scrollViewRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: rp(theme.spacing.xl), paddingBottom: rp(theme.spacing.xxxl) + (insets?.bottom || 0) + tabBarHeight }}>

          {loadingSup ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: rp(40) }} />
          ) : (
            <>
              <TouchableOpacity onPress={pickSupPhoto} style={{ alignItems: "center", marginBottom: rp(theme.spacing.lg) }}>
                <FieldLabel style={{ textAlign: "center" }}>Supervisor Photo (optional)</FieldLabel>
                {supPhotoUri ? (
                  <View style={{ position: "relative" }}>
                    <Image source={{ uri: supPhotoUri }} style={{ width: rp(80), height: rp(80), borderRadius: rp(40), borderWidth: rp(2), borderColor: theme.colors.success }} />
                    <TouchableOpacity
                      onPress={() => { setSupPhotoUri(null); setSupPhoto(null); }}
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

              <FieldLabel>NAME <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.danger }}>*</Text></FieldLabel>
              <Field error={errors.name}>
                <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.name = el; }} value={supName} onChangeText={(t) => { setSupName(t); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })); }} placeholder="Full Name" style={fieldTextInputStyle} />
              </Field>
              {errors.name && <Text style={modalErrorText}>* {errors.name}</Text>}

              <FieldLabel>PHONE <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.danger }}>*</Text></FieldLabel>
              <Field error={errors.phone}>
                <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.phone = el; }} value={supPhone} onChangeText={(t) => { setSupPhone(t); if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined })); }} maxLength={10} placeholder="10-digit mobile" keyboardType="phone-pad" style={fieldTextInputStyle} />
              </Field>
              {errors.phone && <Text style={modalErrorText}>* {errors.phone}</Text>}

              <FieldLabel>GENDER <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.danger }}>*</Text></FieldLabel>
              <View style={{ flexDirection: 'row', gap: rp(10), marginBottom: rp(theme.spacing.lg) }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: rp(theme.spacing.md), borderRadius: rp(theme.spacing.md), borderWidth: rp(1), borderColor: errors.gender && !supGender ? theme.colors.danger : (supGender === 'male' ? theme.colors.info : theme.colors.border), backgroundColor: supGender === 'male' ? theme.colors.infoLight : theme.colors.surface, alignItems: 'center' }}
                  onPress={() => { setSupGender('male'); if (errors.gender) setErrors(prev => ({ ...prev, gender: undefined })); }}
                >
                  <Text style={{ fontFamily: theme.fontFamily.semibold, fontWeight: '600', color: supGender === 'male' ? theme.colors.info : theme.colors.textSecondary, fontSize: rp(14) }}>Male</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: rp(theme.spacing.md), borderRadius: rp(theme.spacing.md), borderWidth: rp(1), borderColor: errors.gender && !supGender ? theme.colors.danger : (supGender === 'female' ? theme.colors.info : theme.colors.border), backgroundColor: supGender === 'female' ? theme.colors.infoLight : theme.colors.surface, alignItems: 'center' }}
                  onPress={() => { setSupGender('female'); if (errors.gender) setErrors(prev => ({ ...prev, gender: undefined })); }}
                >
                  <Text style={{ fontFamily: theme.fontFamily.semibold, fontWeight: '600', color: supGender === 'female' ? theme.colors.info : theme.colors.textSecondary, fontSize: rp(14) }}>Female</Text>
                </TouchableOpacity>
              </View>
              {errors.gender && <Text style={modalErrorText}>* {errors.gender}</Text>}

              <FieldLabel>EMAIL <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.danger }}>*</Text></FieldLabel>
              <Field error={errors.email}>
                <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.email = el; }} value={supEmail} onChangeText={(t) => { setSupEmail(t); if (errors.email) setErrors(prev => ({ ...prev, email: undefined })); }} placeholder="supervisor@example.com" autoCapitalize="none" keyboardType="email-address" style={fieldTextInputStyle} />
              </Field>
              {errors.email && <Text style={modalErrorText}>* {errors.email}</Text>}

              <FieldLabel>PAN CARD NUMBER (OPTIONAL)</FieldLabel>
              <Field icon="card-outline" error={errors.pan}>
                <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.pan = el; }} value={supPan} onChangeText={(v) => { setSupPan(v.toUpperCase()); if (errors.pan) setErrors(prev => ({ ...prev, pan: undefined })); }} placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} style={fieldTextInputStyle} />
              </Field>
              {errors.pan && <Text style={modalErrorText}>* {errors.pan}</Text>}

              <FieldLabel>BANK ACCOUNT NUMBER (OPTIONAL)</FieldLabel>
              <Field icon="business-outline" error={errors.bankAccount}>
                <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.bankAccount = el; }} value={supBankAccount} onChangeText={(t) => { setSupBankAccount(t); if (errors.bankAccount) setErrors(prev => ({ ...prev, bankAccount: undefined })); }} placeholder="Account number" keyboardType="numeric" maxLength={18} style={fieldTextInputStyle} />
              </Field>
              {errors.bankAccount && <Text style={modalErrorText}>* {errors.bankAccount}</Text>}

              <FieldLabel>BANK IFSC CODE (OPTIONAL)</FieldLabel>
              <Field icon="business-outline" error={errors.bankIfsc}>
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
                }} placeholder="SBIN0001234" autoCapitalize="characters" maxLength={11} style={fieldTextInputStyle} />
              </Field>
              {errors.bankIfsc && <Text style={modalErrorText}>* {errors.bankIfsc}</Text>}

              {supIfscChecking && <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(theme.spacing.lg) }}>Checking IFSC...</Text>}
              {supIfscInfo === "unverified" && (
                <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.warning, fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(theme.spacing.lg) }}>
                  Couldn't verify IFSC right now — you can still continue
                </Text>
              )}
              {supIfscInfo && supIfscInfo !== "error" && (
                <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.success, fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(theme.spacing.lg) }}>
                  {supIfscInfo.bank} — {supIfscInfo.branch}, {supIfscInfo.city}
                </Text>
              )}
              {supIfscInfo === "error" && (
                <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.danger, fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(theme.spacing.lg) }}>
                  IFSC code not found
                </Text>
              )}

              <FieldLabel>AADHAR NUMBER <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.danger }}>*</Text></FieldLabel>
              <Field error={errors.aadharNumber}>
                <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.aadharNumber = el; }} value={supAadharNumber} onChangeText={(v) => { const digits = v.replace(/\D/g, "").slice(0, 12); setSupAadharNumber(digits); if (errors.aadharNumber) setErrors(prev => ({ ...prev, aadharNumber: undefined })); }} placeholder="Aadhar number" keyboardType="numeric" maxLength={12} style={fieldTextInputStyle} />
              </Field>
              {errors.aadharNumber && <Text style={modalErrorText}>* {errors.aadharNumber}</Text>}

              <TouchableOpacity ref={el => { if (fieldRefs.current) fieldRefs.current.aadharPhoto = el; }} onPress={() => { pickSupAadharPhoto(); if (errors.aadharPhoto) setErrors(prev => ({ ...prev, aadharPhoto: undefined })); }} style={{ alignItems: "center", marginBottom: rp(theme.spacing.lg) }}>
                <FieldLabel style={{ textAlign: "center" }}>Aadhar Photo <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.danger }}>*</Text></FieldLabel>
                {supAadharPhotoUri ? (
                  <View style={{ position: "relative" }}>
                    <Image source={{ uri: supAadharPhotoUri }} style={{ width: rp(120), height: rp(80), borderRadius: rp(theme.spacing.md), borderWidth: rp(2), borderColor: errors.aadharPhoto ? theme.colors.danger : theme.colors.success }} />
                    <TouchableOpacity
                      onPress={() => { setSupAadharPhotoUri(null); }}
                      style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                    >
                      <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ width: rp(120), height: rp(80), borderRadius: rp(theme.spacing.md), backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: errors.aadharPhoto ? theme.colors.danger : theme.colors.border, borderStyle: "dashed" }}>
                    <Ionicons name="document-outline" size={28} color={errors.aadharPhoto ? theme.colors.danger : theme.colors.textMuted} />
                  </View>
                )}
              </TouchableOpacity>
              {errors.aadharPhoto && <Text style={[modalErrorText, { fontFamily: theme.fontFamily.regular, textAlign: 'center' }]}>* {errors.aadharPhoto}</Text>}

              <Btn variant="primary" onPress={saveSupervisor} disabled={savingSup || loadingSup} style={{ height: rp(56), marginTop: rp(theme.spacing.xl) }}>
                {savingSup ? <ActivityIndicator color={theme.colors.surface} /> : (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="checkmark" size={rs(20)} color={theme.colors.surface} style={{ marginRight: rp(8) }} />
                    <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge) }}>Save Changes</Text>
                  </View>
                )}
              </Btn>


              <View style={{ marginTop: rp(theme.spacing.xxxl), borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: rp(theme.spacing.xl) }}>
                <Btn variant={supIsActive ? "outline" : "primary"} onPress={async () => {
                  const action = supIsActive ? "Deactivate" : "Activate";
                  confirmDialog.confirm(`${action} Supervisor`, `Are you sure you want to ${action.toLowerCase()} this supervisor?`, async () => {
                    try {
                      await api.patch(`/supervisors/${supervisorId}`, { is_active: !supIsActive });
                      router.replace("/(admin)/(tabs)/manage-employees?tab=supervisors");
                    } catch (e) {
                      confirmDialog.info("Operation failed", `Failed to ${action.toLowerCase()} supervisor`);
                    }
                  });
                }}>{supIsActive ? "Deactivate Supervisor" : "Activate Supervisor"}</Btn>
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
