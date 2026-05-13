import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { setItem } from "../../lib/secure";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

export default function Login() {
  const router = useRouter();
  const { setUser, setDriver, setToken } = useAppStore();
  const [tab, setTab] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [empId, setEmpId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      if (tab === "admin") {
        if (!email.trim() || !password) {
          setError("Email and password are required");
          setLoading(false);
          return;
        }
        const { data } = await api.post("/auth/admin/login", {
          email: email.trim(),
          password,
        });
        await setItem("auth_token", data.token);
        setToken(data.token);
        setUser(data.user);
        router.replace("/(admin)/dashboard");
      } else {
        if (!empId.trim() || pin.length !== 4) {
          setError("Employee ID and 4-digit PIN are required");
          setLoading(false);
          return;
        }
        const { data } = await api.post("/auth/driver/login", {
          employee_id: empId.trim().toUpperCase(),
          pin,
        });
        await setItem("auth_token", data.token);
        await AsyncStorage.setItem(
          "driver_session",
          JSON.stringify(data.driver)
        );
        setToken(data.token);
        setDriver(data.driver);
        router.replace("/(driver)");
      }
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Login failed";
      setError(typeof msg === "string" ? msg : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View testID="login-screen" className="flex-1 bg-[#7C3AED]">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 px-8 pt-12 pb-6 items-center justify-center">
              <View className="bg-white/10 rounded-full p-5 mb-4">
                <Ionicons name="car-sport" size={48} color="#fff" />
              </View>
              <Text className="text-white text-4xl font-black tracking-wider">
                INSTAPARK
              </Text>
              <Text className="text-white/70 mt-2 text-base">
                Valet Management System
              </Text>
            </View>

            <View className="bg-white rounded-t-[40px] px-6 pt-8 pb-12">
              <View className="flex-row border-b border-gray-200 mb-6">
                <TouchableOpacity
                  testID="tab-admin"
                  className="flex-1 pb-3 items-center"
                  onPress={() => {
                    setTab("admin");
                    setError("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`font-bold text-base ${
                      tab === "admin" ? "text-[#7C3AED]" : "text-gray-400"
                    }`}
                  >
                    ADMIN
                  </Text>
                  {tab === "admin" && (
                    <View className="h-1 w-12 bg-[#7C3AED] rounded-full mt-2" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  testID="tab-driver"
                  className="flex-1 pb-3 items-center"
                  onPress={() => {
                    setTab("driver");
                    setError("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`font-bold text-base ${
                      tab === "driver" ? "text-[#7C3AED]" : "text-gray-400"
                    }`}
                  >
                    DRIVER
                  </Text>
                  {tab === "driver" && (
                    <View className="h-1 w-12 bg-[#7C3AED] rounded-full mt-2" />
                  )}
                </TouchableOpacity>
              </View>

              {error ? (
                <View
                  testID="login-error"
                  className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-4 flex-row items-center"
                >
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color="#DC2626"
                  />
                  <Text className="text-red-700 ml-2 flex-1">{error}</Text>
                </View>
              ) : null}

              {tab === "admin" ? (
                <View>
                  <Text className="text-xs font-bold text-gray-500 tracking-widest mb-2">
                    EMAIL
                  </Text>
                  <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 mb-4 border border-gray-200">
                    <Ionicons name="mail-outline" size={20} color="#6B7280" />
                    <TextInput
                      testID="admin-email-input"
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      className="flex-1 ml-3 py-4 text-base text-gray-900"
                    />
                  </View>

                  <Text className="text-xs font-bold text-gray-500 tracking-widest mb-2">
                    PASSWORD
                  </Text>
                  <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 mb-6 border border-gray-200">
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#6B7280"
                    />
                    <TextInput
                      testID="admin-password-input"
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      secureTextEntry={!showPwd}
                      className="flex-1 ml-3 py-4 text-base text-gray-900"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPwd((s) => !s)}
                      testID="toggle-password"
                    >
                      <Ionicons
                        name={showPwd ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <Text className="text-xs font-bold text-gray-500 tracking-widest mb-2">
                    EMPLOYEE ID
                  </Text>
                  <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 mb-4 border border-gray-200">
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color="#6B7280"
                    />
                    <TextInput
                      testID="driver-empid-input"
                      value={empId}
                      onChangeText={(v) => setEmpId(v.toUpperCase())}
                      placeholder="EMP-1234"
                      autoCapitalize="characters"
                      className="flex-1 ml-3 py-4 text-base text-gray-900"
                    />
                  </View>

                  <Text className="text-xs font-bold text-gray-500 tracking-widest mb-2">
                    4-DIGIT PIN
                  </Text>
                  <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 mb-6 border border-gray-200">
                    <Ionicons
                      name="keypad-outline"
                      size={20}
                      color="#6B7280"
                    />
                    <TextInput
                      testID="driver-pin-input"
                      value={pin}
                      onChangeText={setPin}
                      placeholder="••••"
                      secureTextEntry
                      maxLength={4}
                      keyboardType="numeric"
                      className="flex-1 ml-3 py-4 text-base text-gray-900"
                    />
                  </View>
                </View>
              )}

              <TouchableOpacity
                testID="login-submit"
                onPress={submit}
                disabled={loading}
                activeOpacity={0.7}
                className="bg-[#7C3AED] rounded-2xl py-4 items-center"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-black text-base tracking-widest">
                    SIGN IN
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
