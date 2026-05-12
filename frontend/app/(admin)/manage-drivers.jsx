import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../lib/api";

export default function ManageDrivers() {
  const router = useRouter();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchDrivers = async () => {
    try {
      const { data } = await api.get("/drivers");
      setDrivers(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchDrivers(); }, []);

  const save = async () => {
    if (!name.trim() || pin.length !== 4) {
      Alert.alert("Required", "Name and 4-digit PIN required");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/drivers", { name: name.trim(), phone: phone.trim(), pin });
      setShowModal(false);
      setName(""); setPhone(""); setPin("");
      Alert.alert("Driver Added!", `Name: ${data.name}\nEmployee ID: ${data.employee_id}\nPIN: ${data.pin}\n\nPlease note these down.`);
      fetchDrivers();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F9FAFB]" testID="manage-drivers-screen">
      <SafeAreaView edges={["top"]} className="bg-[#0F2044]">
        <View className="bg-[#0F2044] px-5 py-4 rounded-b-[30px] flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="bg-white/10 rounded-full p-2 mr-3">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black flex-1">Drivers</Text>
          <TouchableOpacity onPress={() => setShowModal(true)} testID="add-driver-btn" className="bg-white rounded-full w-10 h-10 items-center justify-center">
            <Ionicons name="add" size={24} color="#0F2044" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView className="flex-1 px-4 pt-4">
        {loading && <ActivityIndicator color="#0F2044" />}
        {drivers.map((d) => (
          <TouchableOpacity key={d.id} onPress={() => router.push({ pathname: "/(admin)/driver-stats", params: { driverId: d.id, driverName: d.name } })}
            activeOpacity={0.7} className="bg-white rounded-2xl p-4 mb-3 flex-row items-center">
            <View className="bg-[#0F2044] rounded-full w-12 h-12 items-center justify-center">
              <Text className="text-white font-black text-lg">{d.name?.[0]?.toUpperCase()}</Text>
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-black text-[#0F2044]">{d.name}</Text>
              <Text className="text-gray-500 text-xs">{d.employee_id}</Text>
              {d.phone && <Text className="text-gray-400 text-xs">{d.phone}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
        {!loading && drivers.length === 0 && <Text className="text-gray-400 text-center mt-10">No drivers yet</Text>}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-[30px] p-5">
              <View className="items-center mb-3"><View className="bg-gray-300 w-12 h-1 rounded-full" /></View>
              <Text className="text-xl font-black text-[#0F2044] mb-4">Add Driver</Text>
              <Text className="text-xs font-bold text-gray-500 tracking-widest mb-1">NAME</Text>
              <TextInput value={name} onChangeText={setName} testID="driver-name-input" className="bg-gray-50 rounded-2xl px-4 py-3 mb-3 border border-gray-200" />
              <Text className="text-xs font-bold text-gray-500 tracking-widest mb-1">PHONE (OPTIONAL)</Text>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" className="bg-gray-50 rounded-2xl px-4 py-3 mb-3 border border-gray-200" />
              <Text className="text-xs font-bold text-gray-500 tracking-widest mb-1">4-DIGIT PIN</Text>
              <TextInput value={pin} onChangeText={setPin} testID="driver-pin-input" keyboardType="numeric" maxLength={4} secureTextEntry className="bg-gray-50 rounded-2xl px-4 py-3 mb-5 border border-gray-200" />
              <TouchableOpacity onPress={save} disabled={saving} testID="save-driver-btn" className="bg-[#0F2044] rounded-2xl py-4 items-center">
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black tracking-widest">SAVE</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowModal(false)} className="py-3 items-center mt-2">
                <Text className="text-gray-500 font-bold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
