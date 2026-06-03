import { useEffect, useState } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../lib/api";

const cardShadow = {
  shadowColor: "#0F2044",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export default function ManageSupervisors() {
  const router = useRouter();
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  
  const [selectedSup, setSelectedSup] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchSupervisors = async () => {
    try {
      const { data } = await api.get("/supervisors");
      setSupervisors(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchSupervisors(); }, []);

  const filteredSupervisors = supervisors.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
  };

  const save = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Required", "Name, email and password are required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/supervisors", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password: password,
      });
      setShowModal(false);
      resetForm();
      Alert.alert("Supervisor Added!", `${name} has been added successfully.`);
      fetchSupervisors();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to add supervisor");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!selectedSup) return;
    setUpdatingStatus(true);
    try {
      const newStatus = selectedSup.status === "active" ? "inactive" : "active";
      await api.patch(`/supervisors/${selectedSup.id}`, { status: newStatus });
      setSelectedSup({ ...selectedSup, status: newStatus });
      fetchSupervisors();
    } catch (e) {
      Alert.alert("Error", "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="manage-supervisors-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#0F2044" }}>
        <View
          style={{
            backgroundColor: "#0F2044",
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99, padding: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 12, flex: 1 }}>
              Supervisors
            </Text>
            <View style={{ backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{supervisors.length}</Text>
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
          <Ionicons name="search-outline" size={18} color="#0F2044" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or email"
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
        {loading && <ActivityIndicator color="#0F2044" />}
        {filteredSupervisors.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => {
              setSelectedSup(s);
              setShowDetailModal(true);
            }}
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
                backgroundColor: "#0F2044",
                borderRadius: 99,
                width: 52,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>
                {s.name?.[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>{s.name}</Text>
              <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{s.email}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                <View
                  style={{
                    backgroundColor: s.status === "active" ? "#D1FAE5" : "#F3F4F6",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 99,
                  }}
                >
                  <Text style={{ color: s.status === "active" ? "#059669" : "#9CA3AF", fontSize: 10, fontWeight: "800" }}>
                    {s.status?.toUpperCase()}
                  </Text>
                </View>
                {s.phone ? (
                  <Text style={{ color: "#9CA3AF", fontSize: 11, marginLeft: 8 }}>{s.phone}</Text>
                ) : null}
              </View>
            </View>
            <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
        {filteredSupervisors.length === 0 && search.length > 0 && (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={{ fontSize: 40 }}>🔍</Text>
            <Text style={{ color: "#111827", fontWeight: "800", marginTop: 8 }}>No supervisors found</Text>
          </View>
        )}
        {!loading && supervisors.length === 0 && (
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 64 }}>🛡️</Text>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16, marginTop: 8 }}>No supervisors yet</Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Tap + to add a supervisor</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        activeOpacity={0.85}
        style={{
          position: "absolute",
          bottom: 28,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: 99,
          backgroundColor: "#0F2044",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#0F2044",
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { resetForm(); setShowModal(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20 }}>
              <View style={{ alignItems: "center", marginBottom: 12 }}>
                <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#0F2044", marginBottom: 18 }}>Add Supervisor</Text>

              <Text style={modalLabel}>NAME</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Full Name" placeholderTextColor="#9CA3AF" style={modalInput} />

              <Text style={modalLabel}>EMAIL</Text>
              <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="email@example.com" placeholderTextColor="#9CA3AF" style={modalInput} />

              <Text style={modalLabel}>PHONE (OPTIONAL)</Text>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit mobile" placeholderTextColor="#9CA3AF" style={modalInput} />

              <Text style={modalLabel}>PASSWORD</Text>
              <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Min 6 characters" placeholderTextColor="#9CA3AF" style={modalInput} />

              <TouchableOpacity
                onPress={save}
                disabled={saving}
                style={{ backgroundColor: "#0F2044", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>SAVE SUPERVISOR</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { resetForm(); setShowModal(false); }}
                style={{ paddingVertical: 12, alignItems: "center", marginTop: 4 }}
              >
                <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail/Status Modal */}
      <Modal visible={showDetailModal} transparent animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20 }}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
            </View>
            {selectedSup && (
              <>
                <Text style={{ fontSize: 22, fontWeight: "900", color: "#0F2044", marginBottom: 4 }}>{selectedSup.name}</Text>
                <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 20 }}>{selectedSup.email}</Text>

                <View style={{ backgroundColor: "#F9FAFB", borderRadius: 20, padding: 16, marginBottom: 20 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <Text style={{ fontWeight: "700", color: "#374151" }}>Status</Text>
                    <View style={{ backgroundColor: selectedSup.status === "active" ? "#D1FAE5" : "#FEE2E2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
                      <Text style={{ color: selectedSup.status === "active" ? "#059669" : "#EF4444", fontWeight: "800", fontSize: 11 }}>
                        {selectedSup.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontWeight: "700", color: "#374151" }}>Phone</Text>
                    <Text style={{ color: "#6B7280" }}>{selectedSup.phone || "Not provided"}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={toggleStatus}
                  disabled={updatingStatus}
                  style={{
                    backgroundColor: selectedSup.status === "active" ? "#FEE2E2" : "#D1FAE5",
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: "center",
                  }}
                >
                  {updatingStatus ? (
                    <ActivityIndicator color={selectedSup.status === "active" ? "#EF4444" : "#059669"} />
                  ) : (
                    <Text style={{ color: selectedSup.status === "active" ? "#EF4444" : "#059669", fontWeight: "900", letterSpacing: 1 }}>
                      {selectedSup.status === "active" ? "DEACTIVATE SUPERVISOR" : "ACTIVATE SUPERVISOR"}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowDetailModal(false)}
                  style={{ paddingVertical: 16, alignItems: "center" }}
                >
                  <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
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
  backgroundColor: "#F9FAFB",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  paddingHorizontal: 14,
  paddingVertical: 12,
  marginBottom: 16,
  fontSize: 15,
  color: "#111827",
  fontWeight: "600",
};
