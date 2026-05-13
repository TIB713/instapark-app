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
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { setItem } from "../../lib/secure";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

const { height: SCREEN_H } = Dimensions.get("window");

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

  const accent = tab === "admin" ? "#7C3AED" : "#059669";

  return (
    <View testID="login-screen" style={{ flex: 1, backgroundColor: "#7C3AED" }}>
      {/* Gradient overlay */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(79,70,229,0.5)",
        }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Top hero */}
            <View
              style={{
                minHeight: SCREEN_H * 0.36,
                paddingHorizontal: 32,
                paddingTop: 24,
                paddingBottom: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderRadius: 100,
                  padding: 22,
                  marginBottom: 18,
                }}
              >
                <Ionicons name="car-sport" size={52} color="#fff" />
              </View>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 36,
                  fontWeight: "900",
                  letterSpacing: 4,
                }}
              >
                INSTAPARK
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.75)",
                  marginTop: 8,
                  fontSize: 14,
                  letterSpacing: 1,
                }}
              >
                Valet Management System
              </Text>
            </View>

            {/* Bottom card */}
            <View
              style={{
                flex: 1,
                backgroundColor: "#fff",
                borderTopLeftRadius: 44,
                borderTopRightRadius: 44,
                paddingHorizontal: 24,
                paddingTop: 32,
                paddingBottom: 40,
              }}
            >
              {/* Tabs */}
              <View
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 1,
                  borderBottomColor: "#E5E7EB",
                  marginBottom: 24,
                }}
              >
                <TouchableOpacity
                  testID="tab-admin"
                  style={{ flex: 1, paddingBottom: 12, alignItems: "center" }}
                  onPress={() => {
                    setTab("admin");
                    setError("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontWeight: "800",
                      fontSize: 15,
                      letterSpacing: 2,
                      color: tab === "admin" ? "#7C3AED" : "#9CA3AF",
                    }}
                  >
                    ADMIN
                  </Text>
                  {tab === "admin" && (
                    <View
                      style={{
                        height: 3,
                        width: 56,
                        backgroundColor: "#7C3AED",
                        borderRadius: 99,
                        marginTop: 8,
                      }}
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  testID="tab-driver"
                  style={{ flex: 1, paddingBottom: 12, alignItems: "center" }}
                  onPress={() => {
                    setTab("driver");
                    setError("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontWeight: "800",
                      fontSize: 15,
                      letterSpacing: 2,
                      color: tab === "driver" ? "#059669" : "#9CA3AF",
                    }}
                  >
                    DRIVER
                  </Text>
                  {tab === "driver" && (
                    <View
                      style={{
                        height: 3,
                        width: 56,
                        backgroundColor: "#059669",
                        borderRadius: 99,
                        marginTop: 8,
                      }}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {error ? (
                <View
                  testID="login-error"
                  style={{
                    backgroundColor: "rgba(244,63,94,0.08)",
                    borderWidth: 1,
                    borderColor: "rgba(244,63,94,0.5)",
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 16,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="alert-circle" size={20} color="#F43F5E" />
                  <Text style={{ color: "#9F1239", marginLeft: 8, flex: 1, fontSize: 13 }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              {tab === "admin" ? (
                <View>
                  <Text style={styles.label}>EMAIL</Text>
                  <View style={styles.input}>
                    <Ionicons name="mail-outline" size={20} color={accent} />
                    <TextInput
                      testID="admin-email-input"
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.textInput}
                    />
                  </View>

                  <Text style={styles.label}>PASSWORD</Text>
                  <View style={styles.input}>
                    <Ionicons name="lock-closed-outline" size={20} color={accent} />
                    <TextInput
                      testID="admin-password-input"
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPwd}
                      style={styles.textInput}
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
                  <Text style={styles.label}>EMPLOYEE ID</Text>
                  <View style={styles.input}>
                    <Ionicons name="person-outline" size={20} color={accent} />
                    <TextInput
                      testID="driver-empid-input"
                      value={empId}
                      onChangeText={(v) => setEmpId(v.toUpperCase())}
                      placeholder="EMP-1234"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters"
                      style={styles.textInput}
                    />
                  </View>

                  <Text style={styles.label}>4-DIGIT PIN</Text>
                  <View style={styles.input}>
                    <Ionicons name="keypad-outline" size={20} color={accent} />
                    <TextInput
                      testID="driver-pin-input"
                      value={pin}
                      onChangeText={setPin}
                      placeholder="••••"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      maxLength={4}
                      keyboardType="numeric"
                      style={styles.textInput}
                    />
                  </View>
                </View>
              )}

              <TouchableOpacity
                testID="login-submit"
                onPress={submit}
                disabled={loading}
                activeOpacity={0.85}
                style={{
                  backgroundColor: accent,
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: "center",
                  marginTop: 8,
                  shadowColor: accent,
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "900",
                      fontSize: 15,
                      letterSpacing: 2,
                    }}
                  >
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

const styles = {
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    marginLeft: 12,
    fontSize: 15,
    color: "#111827",
  },
};
