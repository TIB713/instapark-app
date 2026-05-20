import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import api from "../../lib/api";

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export default function ManageDrivers() {
  const router = useRouter();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [driverPhoto, setDriverPhoto] = useState(null);
  const [uploadingDriverPhoto, setUploadingDriverPhoto] = useState(false);
  const [email, setEmail] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licensePhoto, setLicensePhoto] = useState(null);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const pickDriverPhoto = async () => { 
    const [libPerm, camPerm] = await Promise.all([ 
      ImagePicker.requestMediaLibraryPermissionsAsync(), 
      ImagePicker.requestCameraPermissionsAsync(), 
    ]); 
    const canGallery = libPerm.granted; 
    const canCamera = camPerm.granted; 
    if (!canGallery && !canCamera) { 
      Alert.alert("Permission needed", "Please allow camera or photo library access in settings."); 
      return; 
    } 
    const options = []; 
    if (canCamera) options.push({ 
      text: "Camera", onPress: async () => { 
        const r = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] }); 
        if (!r.canceled) setDriverPhoto(r.assets[0].uri); 
      } 
    }); 
    if (canGallery) options.push({ 
      text: "Gallery", onPress: async () => { 
        const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1], mediaTypes: ImagePicker.MediaTypeOptions.Images }); 
        if (!r.canceled) setDriverPhoto(r.assets[0].uri); 
      } 
    }); 
    options.push({ text: "Cancel", style: "cancel" }); 
    Alert.alert("Driver Photo", "Choose source", options); 
  }; 

  const pickLicensePhoto = async () => { 
    const [libPerm, camPerm] = await Promise.all([ 
      ImagePicker.requestMediaLibraryPermissionsAsync(), 
      ImagePicker.requestCameraPermissionsAsync(), 
    ]); 
    const canGallery = libPerm.granted; 
    const canCamera = camPerm.granted; 
    if (!canGallery && !canCamera) { 
      Alert.alert("Permission needed", "Please allow camera or photo library access in settings."); 
      return; 
    } 
    const options = []; 
    if (canCamera) options.push({ 
      text: "Camera", onPress: async () => { 
        const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true }); 
        if (!r.canceled) setLicensePhoto(r.assets[0].uri); 
      } 
    }); 
    if (canGallery) options.push({ 
      text: "Gallery", onPress: async () => { 
        const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, mediaTypes: ImagePicker.MediaTypeOptions.Images }); 
        if (!r.canceled) setLicensePhoto(r.assets[0].uri); 
      } 
    }); 
    options.push({ text: "Cancel", style: "cancel" }); 
    Alert.alert("License Photo", "Choose source", options); 
  }; 


  const filteredDrivers = drivers.filter(
    (d) =>
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  const fetchDrivers = async () => {
    try {
      const { data } = await api.get("/drivers");
      setDrivers(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchDrivers(); }, []);

  const resetForm = () => { 
    setName(""); 
    setPhone(""); 
    setPin(""); 
    setEmail(""); 
    setPanNumber(""); 
    setBankAccount(""); 
    setBankIfsc(""); 
    setLicenseNumber(""); 
    setLicensePhoto(null); 
    setDriverPhoto(null); 
    setStep(1); 
  }; 

  const save = async () => { 
    if (!name.trim() || pin.length !== 4) { 
      Alert.alert("Required", "Name and 4-digit PIN required"); 
      return; 
    } 
    setSaving(true); 
    try { 
      let driverPhotoUrl = null; 
      if (driverPhoto) { 
        setUploadingDriverPhoto(true); 
        try { 
          const fd = new FormData(); 
          fd.append("file", { uri: driverPhoto, type: "image/jpeg", name: "driver_photo.jpg" }); 
          fd.append("folder", "driver_photos"); 
          const up = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }); 
          driverPhotoUrl = up.data.url; 
        } catch { } finally { setUploadingDriverPhoto(false); } 
      } 

      let licensePhotoUrl = null; 
      if (licensePhoto) { 
        setUploadingLicense(true); 
        try { 
          const fd = new FormData(); 
          fd.append("file", { uri: licensePhoto, type: "image/jpeg", name: "license.jpg" }); 
          fd.append("folder", "driving_licenses"); 
          const up = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }); 
          licensePhotoUrl = up.data.url; 
        } catch { } finally { setUploadingLicense(false); } 
      } 

      const { data } = await api.post("/drivers", { 
        name: name.trim(), 
        phone: phone.trim(), 
        pin, 
        driver_photo: driverPhotoUrl || undefined, 
        email: email.trim(), 
        pan_number: panNumber.trim() || undefined, 
        bank_account_number: bankAccount.trim() || undefined, 
        bank_ifsc: bankIfsc.trim().toUpperCase() || undefined, 
        driving_license_number: licenseNumber.trim() || undefined, 
        driving_license_photo: licensePhotoUrl || undefined, 
      }); 

      setShowModal(false); 
      resetForm(); 
      Alert.alert("Driver Added!", `Name: ${data.name}\nEmployee ID: ${data.employee_id}\nPIN: ${data.pin}\n\nPlease note these down.`); 
      fetchDrivers(); 
    } catch (e) { 
      Alert.alert("Error", e.response?.data?.detail || "Failed"); 
    } finally { 
      setSaving(false); 
    } 
  }; 


  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="manage-drivers-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
        <View
          style={{
            backgroundColor: "#7C3AED",
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 24,
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
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99, padding: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 12, flex: 1 }}>
              Drivers
            </Text>
            <View style={{ backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{drivers.length}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 2,
          }}
        >
          <Ionicons name="search-outline" size={18} color="#7C3AED" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or employee ID"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 10, paddingVertical: 12, fontSize: 14, color: "#111827" }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        {loading && <ActivityIndicator color="#7C3AED" />}
        {filteredDrivers.map((d) => (
          <TouchableOpacity
            key={d.id}
            onPress={() => router.push({ pathname: "/(admin)/driver-stats", params: { driverId: d.id, driverName: d.name } })}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: 16,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              ...cardShadow,
            }}
          >
            <View
              style={{
                backgroundColor: "#7C3AED",
                borderRadius: 99,
                width: 52,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>
                {d.name?.[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>{d.name}</Text>
              <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{d.employee_id}</Text>
              {d.phone ? (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                  <Ionicons name="call-outline" size={11} color="#9CA3AF" />
                  <Text style={{ color: "#9CA3AF", fontSize: 11, marginLeft: 4 }}>{d.phone}</Text>
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
        {filteredDrivers.length === 0 && search.length > 0 && (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={{ fontSize: 40 }}>🔍</Text>
            <Text style={{ color: "#111827", fontWeight: "800", marginTop: 8 }}>No drivers found</Text>
            <Text style={{ color: "#6B7280", marginTop: 4, fontSize: 13 }}>Try a different name or ID</Text>
          </View>
        )}
        {!loading && drivers.length === 0 && (
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 64 }}>👥</Text>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 8 }}>No drivers yet</Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Tap + to add a driver</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        testID="add-driver-btn"
        activeOpacity={0.85}
        style={{
          position: "absolute",
          bottom: 28,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: 99,
          backgroundColor: "#7C3AED",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#7C3AED",
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { resetForm(); setShowModal(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20 }}>
              <View style={{ alignItems: "center", marginBottom: 12 }}>
                <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
              </View>
              {/* Step indicator */}
              <Text style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", fontWeight: "700", letterSpacing: 2, marginBottom: 4 }}>
                STEP {step} OF 2
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#7C3AED", marginBottom: 18 }}>
                {step === 1 ? "Basic Info" : "Documents"}
              </Text>

              {step === 1 ? (
                <>
                  {/* Driver photo picker */}
                  <TouchableOpacity
                    onPress={pickDriverPhoto}
                    style={{
                      alignSelf: "center",
                      width: 80, height: 80, borderRadius: 40,
                      backgroundColor: "#F3F0FF",
                      borderWidth: 2, borderColor: "#7C3AED",
                      borderStyle: "dashed",
                      alignItems: "center", justifyContent: "center",
                      marginBottom: 16, overflow: "hidden"
                    }}
                  >
                    {driverPhoto ? (
                      <Image source={{ uri: driverPhoto }}
                        style={{ width: 80, height: 80, borderRadius: 40 }} />
                    ) : (
                      <>
                        <Ionicons name="person-outline" size={28} color="#7C3AED" />
                        <Text style={{ fontSize: 9, color: "#7C3AED", fontWeight: "800", marginTop: 2 }}>
                          ADD PHOTO
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <Text style={modalLabel}>NAME</Text>
                  <View style={modalInput}>
                    <Ionicons name="person-outline" size={18} color="#7C3AED" />
                    <TextInput value={name} onChangeText={setName} testID="driver-name-input" placeholder="John Doe" placeholderTextColor="#9CA3AF" style={modalInputText} />
                  </View>
                  <Text style={modalLabel}>PHONE (OPTIONAL)</Text>
                  <View style={modalInput}>
                    <Ionicons name="call-outline" size={18} color="#7C3AED" />
                    <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 9876543210" placeholderTextColor="#9CA3AF" style={modalInputText} />
                  </View>
                  <Text style={modalLabel}>4-DIGIT PIN</Text>
                  <View style={modalInput}>
                    <Ionicons name="keypad-outline" size={18} color="#7C3AED" />
                    <TextInput value={pin} onChangeText={setPin} testID="driver-pin-input" keyboardType="numeric" maxLength={4} secureTextEntry placeholder="••••" placeholderTextColor="#9CA3AF" style={modalInputText} />
                  </View>
                  <Text style={modalLabel}>EMAIL <Text style={{ color: "#EF4444" }}>*</Text></Text> 
                  <View style={[modalInput, { borderColor: email.trim() ? "#E5E7EB" : "#E5E7EB" }]}> 
                    <Ionicons name="mail-outline" size={18} color="#7C3AED" /> 
                    <TextInput 
                      value={email} 
                      onChangeText={setEmail} 
                      keyboardType="email-address" 
                      autoCapitalize="none" 
                      placeholder="driver@example.com" 
                      placeholderTextColor="#9CA3AF" 
                      style={modalInputText} 
                    /> 
                  </View> 
                  <TouchableOpacity
                    onPress={() => {
                      if (!name.trim() || pin.length !== 4) {
                        Alert.alert("Required", "Name and 4-digit PIN required");
                        return;
                      }
                      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { 
                        Alert.alert("Required", "Please enter a valid email address"); 
                        return; 
                      } 
                      setStep(2);
                    }}
                    style={{ backgroundColor: "#7C3AED", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>NEXT →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { resetForm(); setShowModal(false); }} 
                    style={{ paddingVertical: 12, alignItems: "center", marginTop: 4 }}
                  >
                    <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => setStep(1)} style={{ marginBottom: 16 }}>
                    <Text style={{ color: "#7C3AED", fontWeight: "800" }}>← Back</Text>
                  </TouchableOpacity>
                  <Text style={modalLabel}>PAN CARD NUMBER</Text>
                  <View style={modalInput}>
                    <Ionicons name="card-outline" size={18} color="#7C3AED" />
                    <TextInput value={panNumber} onChangeText={v => setPanNumber(v.toUpperCase())} autoCapitalize="characters" maxLength={10} placeholder="ABCDE1234F" placeholderTextColor="#9CA3AF" style={modalInputText} />
                  </View>
                  <Text style={modalLabel}>BANK ACCOUNT NUMBER</Text>
                  <View style={modalInput}>
                    <Ionicons name="business-outline" size={18} color="#7C3AED" />
                    <TextInput value={bankAccount} onChangeText={setBankAccount} keyboardType="numeric" placeholder="Account number" placeholderTextColor="#9CA3AF" style={modalInputText} />
                  </View>
                  <Text style={modalLabel}>BANK IFSC CODE</Text>
                  <View style={modalInput}>
                    <Ionicons name="business-outline" size={18} color="#7C3AED" />
                    <TextInput value={bankIfsc} onChangeText={v => setBankIfsc(v.toUpperCase())} autoCapitalize="characters" maxLength={11} placeholder="SBIN0001234" placeholderTextColor="#9CA3AF" style={modalInputText} />
                  </View>
                  <Text style={modalLabel}>DRIVING LICENSE NUMBER</Text>
                  <View style={modalInput}>
                    <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
                    <TextInput value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" placeholder="DL number" placeholderTextColor="#9CA3AF" style={modalInputText} />
                  </View>
                  <Text style={modalLabel}>DRIVING LICENSE PHOTO</Text>
                  <TouchableOpacity
                    onPress={pickLicensePhoto}
                    style={{
                      width: "100%", height: 90, borderRadius: 16,
                      borderWidth: 2, borderStyle: "dashed", borderColor: "#7C3AED",
                      alignItems: "center", justifyContent: "center",
                      backgroundColor: "#F3F0FF", marginBottom: 16, overflow: "hidden"
                    }}
                  >
                    {licensePhoto ? (
                      <Image source={{ uri: licensePhoto }} style={{ width: "100%", height: 90, resizeMode: "cover" }} />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={24} color="#7C3AED" />
                        <Text style={{ fontSize: 11, color: "#7C3AED", fontWeight: "800", marginTop: 4 }}>
                          TAP TO UPLOAD LICENSE PHOTO
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={save}
                    disabled={saving}
                    testID="save-driver-btn"
                    style={{ backgroundColor: "#7C3AED", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 }}
                  >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>SAVE DRIVER</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { resetForm(); setShowModal(false); }} 
                    style={{ paddingVertical: 12, alignItems: "center", marginTop: 4 }}
                  >
                    <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const modalLabel = {
  fontSize: 11,
  fontWeight: "800",
  color: "#6B7280",
  letterSpacing: 3,
  marginBottom: 8,
};
const modalInput = {
  backgroundColor: "#fff",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 14,
  marginBottom: 16,
};
const modalInputText = {
  flex: 1,
  paddingVertical: 14,
  marginLeft: 10,
  fontSize: 15,
  color: "#111827",
};
