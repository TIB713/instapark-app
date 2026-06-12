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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import api from "../../lib/api";

const cardShadow = {
  shadowColor: "#0F2044",
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function ManageEmployees() {
  const router = useRouter();
  const [tab, setTab] = useState("supervisors"); // "supervisors" or "drivers"
  const [supervisors, setSupervisors] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState(null);

  // Supervisor Form State
  const [showSupModal, setShowSupModal] = useState(false);
  const [supName, setSupName] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supPassword, setSupPassword] = useState("");
  const [savingSup, setSavingSup] = useState(false);
  const [supPan, setSupPan] = useState("");
  const [supBankAccount, setSupBankAccount] = useState("");
  const [supBankIfsc, setSupBankIfsc] = useState("");
  const [supPhoto, setSupPhoto] = useState(null);
  const [supPhotoUri, setSupPhotoUri] = useState(null);

  // Driver Form State
  const [showDrvModal, setShowDrvModal] = useState(false);
  const [drvName, setDrvName] = useState("");
  const [drvEmail, setDrvEmail] = useState("");
  const [drvPhone, setDrvPhone] = useState("");
  const [drvPassword, setDrvPassword] = useState("");
  const [drvPhoto, setDrvPhoto] = useState(null);
  const [drvPhotoUri, setDrvPhotoUri] = useState(null);
  const [drvLicenseNumber, setDrvLicenseNumber] = useState("");
  const [drvLicensePhoto, setDrvLicensePhoto] = useState(null);
  const [drvLicensePhotoUri, setDrvLicensePhotoUri] = useState(null);
  const [drvPan, setDrvPan] = useState("");
  const [drvBankAccount, setDrvBankAccount] = useState("");
  const [drvBankIfsc, setDrvBankIfsc] = useState("");
  const [savingDrv, setSavingDrv] = useState(false);

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
    setSupName(""); setSupEmail(""); setSupPhone(""); setSupPassword("");
    setSupPan(""); setSupBankAccount(""); setSupBankIfsc("");
    setSupPhoto(null); setSupPhotoUri(null);
  };

  const resetDrvForm = () => {
    setDrvName("");
    setDrvEmail("");
    setDrvPhone("");
    setDrvPassword("");
    setDrvPhoto(null);
    setDrvPhotoUri(null);
    setDrvLicenseNumber("");
    setDrvLicensePhoto(null);
    setDrvLicensePhotoUri(null);
    setDrvPan("");
    setDrvBankAccount("");
    setDrvBankIfsc("");
  };

  const pickDriverPhoto = async () => {
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
      setDrvPhotoUri(result.assets[0].uri);
      setDrvPhoto(result.assets[0].uri);
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
      setDrvLicensePhotoUri(result.assets[0].uri);
      setDrvLicensePhoto(result.assets[0].uri);
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

  const saveSupervisor = async () => {
    if (!supName.trim() || !supEmail.trim() || !supPassword.trim()) {
      Alert.alert("Required", "Name, email and password are required");
      return;
    }
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
      await api.post("/supervisors", {
        name: supName.trim(),
        email: supEmail.trim().toLowerCase(),
        phone: supPhone.trim() || undefined,
        password: supPassword,
        pan_number: supPan.trim() || undefined,
        bank_account_number: supBankAccount.trim() || undefined,
        bank_ifsc: supBankIfsc.trim() || undefined,
        supervisor_photo: photoUrl || undefined,
      });
      setShowSupModal(false);
      resetSupForm();
      fetchAll();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to add supervisor");
    } finally {
      setSavingSup(false);
    }
  };

  const saveDriver = async () => {
    if (!drvName.trim() || !drvEmail.trim() || !drvPassword.trim()) {
      Alert.alert("Required", "Name, email and PIN are required");
      return;
    }
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
      await api.post("/drivers", {
        name: drvName.trim(),
        email: drvEmail.trim().toLowerCase(),
        phone: drvPhone.trim() || undefined,
        pin: drvPassword,
        photo_url: photoUrl || undefined,
        pan_number: drvPan.trim() || undefined,
        bank_account_number: drvBankAccount.trim() || undefined,
        bank_ifsc: drvBankIfsc.trim() || undefined,
        driving_license_number: drvLicenseNumber.trim() || undefined,
        driving_license_photo: licensePhotoUrl || undefined,
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
                    <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(15) }}>{s.name}</Text>
                    <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>{s.email}</Text>
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
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, maxHeight: "90%" }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: rp(20), paddingBottom: rp(32) }}>
                <View style={{ alignItems: "center", marginBottom: rp(12) }}><View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} /></View>
                <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#7C3AED", marginBottom: rp(16) }}>Add Supervisor</Text>

                <TouchableOpacity onPress={async () => {
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
                    setSupPhotoUri(result.assets[0].uri);
                    setSupPhoto(result.assets[0].uri);
                  }
                }} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Supervisor Photo (optional)</Text>
                  {supPhotoUri ? (
                    <Image source={{ uri: supPhotoUri }} style={{ width: rp(80), height: rp(80), borderRadius: rp(40), borderWidth: rp(2), borderColor: "#7C3AED" }} />
                  ) : (
                    <View style={{ width: rp(80), height: rp(80), borderRadius: rp(40), backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: "#E5E7EB", borderStyle: "dashed" }}>
                      <Ionicons name="person" size={32} color="#9CA3AF" />
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={modalLabel}>NAME</Text>
                <TextInput value={supName} onChangeText={setSupName} placeholder="Full Name" style={modalInput} />
                <Text style={modalLabel}>EMAIL</Text>
                <TextInput value={supEmail} onChangeText={setSupEmail} placeholder="email@example.com" autoCapitalize="none" style={modalInput} />
                <Text style={modalLabel}>PHONE (OPTIONAL)</Text>
                <TextInput value={supPhone} onChangeText={setSupPhone} placeholder="10-digit mobile" keyboardType="phone-pad" style={modalInput} />
                <Text style={modalLabel}>PASSWORD</Text>
                <TextInput value={supPassword} onChangeText={setSupPassword} placeholder="Min 6 characters" secureTextEntry style={modalInput} />
                <Text style={modalLabel}>PAN CARD NUMBER (OPTIONAL)</Text>
                <TextInput value={supPan} onChangeText={(v) => setSupPan(v.toUpperCase())} placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} style={modalInput} />
                <Text style={modalLabel}>BANK ACCOUNT NUMBER (OPTIONAL)</Text>
                <TextInput value={supBankAccount} onChangeText={setSupBankAccount} placeholder="Account number" keyboardType="numeric" style={modalInput} />
                <Text style={modalLabel}>BANK IFSC CODE (OPTIONAL)</Text>
                <TextInput value={supBankIfsc} onChangeText={(v) => setSupBankIfsc(v.toUpperCase())} placeholder="SBIN0001234" autoCapitalize="characters" style={modalInput} />

                <TouchableOpacity onPress={saveSupervisor} disabled={savingSup} style={{ backgroundColor: "#7C3AED", borderRadius: rp(16), paddingVertical: rp(16), alignItems: "center", marginTop: rp(8) }}>
                  {savingSup ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>SAVE SUPERVISOR</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { resetSupForm(); setShowSupModal(false); }} style={{ paddingVertical: rp(12), alignItems: "center" }}>
                  <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Driver Modal */}
      <Modal visible={showDrvModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, maxHeight: "90%" }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: rp(20), paddingBottom: rp(32) }}>
                <View style={{ alignItems: "center", marginBottom: rp(12) }}><View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} /></View>
                <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#059669", marginBottom: rp(16) }}>Add Driver</Text>

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

                <Text style={modalLabel}>NAME</Text>
                <TextInput value={drvName} onChangeText={setDrvName} placeholder="Full Name" style={modalInput} />
                <Text style={modalLabel}>PHONE (OPTIONAL)</Text>
                <TextInput value={drvPhone} onChangeText={setDrvPhone} placeholder="10-digit mobile" keyboardType="phone-pad" style={modalInput} />
                <Text style={modalLabel}>4-DIGIT PIN</Text>
                <TextInput value={drvPassword} onChangeText={setDrvPassword} placeholder="e.g. 1234" keyboardType="numeric" maxLength={4} style={modalInput} />
                <Text style={modalLabel}>EMAIL</Text>
                <TextInput value={drvEmail} onChangeText={setDrvEmail} placeholder="driver@example.com" autoCapitalize="none" keyboardType="email-address" style={modalInput} />
                <Text style={modalLabel}>PAN CARD NUMBER (OPTIONAL)</Text>
                <TextInput value={drvPan} onChangeText={(v) => setDrvPan(v.toUpperCase())} placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} style={modalInput} />
                <Text style={modalLabel}>BANK ACCOUNT NUMBER (OPTIONAL)</Text>
                <TextInput value={drvBankAccount} onChangeText={setDrvBankAccount} placeholder="Account number" keyboardType="numeric" style={modalInput} />
                <Text style={modalLabel}>BANK IFSC CODE (OPTIONAL)</Text>
                <TextInput value={drvBankIfsc} onChangeText={(v) => setDrvBankIfsc(v.toUpperCase())} placeholder="SBIN0001234" autoCapitalize="characters" style={modalInput} />
                <Text style={modalLabel}>DRIVING LICENCE NUMBER (OPTIONAL)</Text>
                <TextInput value={drvLicenseNumber} onChangeText={(v) => setDrvLicenseNumber(v.toUpperCase())} placeholder="DL number" autoCapitalize="characters" style={modalInput} />

                <TouchableOpacity onPress={pickLicensePhoto} style={{ alignItems: "center", marginBottom: rp(16) }}>
                  <Text style={[modalLabel, { textAlign: "center" }]}>Licence Photo (optional)</Text>
                  {drvLicensePhotoUri ? (
                    <Image source={{ uri: drvLicensePhotoUri }} style={{ width: rp(120), height: rp(80), borderRadius: rp(12), borderWidth: rp(2), borderColor: "#059669" }} />
                  ) : (
                    <View style={{ width: rp(120), height: rp(80), borderRadius: rp(12), backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: rp(2), borderColor: "#E5E7EB", borderStyle: "dashed" }}>
                      <Ionicons name="document-outline" size={28} color="#9CA3AF" />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={saveDriver} disabled={savingDrv} style={{ backgroundColor: "#059669", borderRadius: rp(16), paddingVertical: rp(16), alignItems: "center" }}>
                  {savingDrv ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>SAVE DRIVER</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { resetDrvForm(); setShowDrvModal(false); }} style={{ paddingVertical: rp(12), alignItems: "center" }}>
                  <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const modalLabel = { fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(2), marginBottom: rp(8) };
const modalInput = { backgroundColor: "#F9FAFB", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", padding: rp(14), color: "#111827", marginBottom: rp(16), fontSize: rs(15), fontWeight: "700" };
