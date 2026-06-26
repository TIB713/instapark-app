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
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { setItem } from "../../lib/secure";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import api from "../../lib/api";
import { registerForPushNotifications } from "../../lib/notifications";
import { useAppStore } from "../../lib/store";
import { rs, rp } from "../../utils/responsive";

const requestPushPermissions = async (role) => {
  if (role !== "driver" && role !== "supervisor") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === "granted") {
      const token = await Notifications.getExpoPushTokenAsync();
      await AsyncStorage.setItem("push_token", token.data);
      api.post("/drivers/push-token", { push_token: token.data }).catch(() => {});
    }
  } catch {}
};

const { height: SCREEN_H } = Dimensions.get("window");

export default function Login() {
  const router = useRouter();
  const { setUser, setDriver, setToken } = useAppStore();
  const [tab, setTab] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [supEmail, setSupEmail] = useState("");
  const [supPassword, setSupPassword] = useState("");
  const [showSupPwd, setShowSupPwd] = useState(false);
  const [empId, setEmpId] = useState("");
  const [pin, setPin] = useState("");
  const [showDriverPin, setShowDriverPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmpId, setForgotEmpId] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewSecret, setForgotNewSecret] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

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
        api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
        await setItem("auth_token", data.token);
        const { data: meData } = await api.get("/auth/me");
        setUser(meData);
        setToken(data.token);
        await setItem("last_known_role", meData.role);
        router.replace("/(admin)/dashboard");
        return;
      } else if (tab === "supervisor") {
        if (!supEmail.trim() || !supPassword) {
          setError("Email and password are required");
          setLoading(false);
          return;
        }
        const { data } = await api.post("/auth/supervisor/login", {
          email: supEmail.trim(),
          password: supPassword,
        });
        await setItem("auth_token", data.token);
        setToken(data.token);
        setUser(data.user);
        await setItem("last_known_role", "supervisor");
        try { registerForPushNotifications(api); } catch {}
        router.replace("/(supervisor)/dashboard");
        return;
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
        await setItem("last_known_role", "driver");
        try { registerForPushNotifications(api); } catch {}
        router.replace("/(driver)");
      }
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Login failed";
      setError(typeof msg === "string" ? msg : "Login failed");
      setToken(null);
      await setItem("last_known_role", "");
      delete api.defaults.headers.common["Authorization"];
    } finally {
      setLoading(false);
    }
  };

  const sendForgotOtp = async () => {
    setForgotError("");
    setForgotLoading(true);
    try {
      if (tab === "admin" || tab === "supervisor") {
        if (!forgotEmail.trim()) {
          setForgotError("Email is required");
          return;
        }
        await api.post("/auth/admin/forgot-password", {
          email: forgotEmail.trim()
        });
      } else {
        if (!forgotEmpId.trim()) {
          setForgotError("Employee ID is required");
          return;
        }
        await api.post("/auth/driver/forgot-pin", {
          employee_id: forgotEmpId.trim().toUpperCase()
        });
      }
      setForgotStep(2);
      setForgotSuccess(
        "OTP sent to your registered email address"
      );
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join(", ")
        : typeof detail === "string"
        ? detail
        : "Failed to send OTP. Please try again.";
      setForgotError(msg);
      setForgotEmail("");
      setForgotEmpId("");
    } finally {
      setForgotLoading(false);
    }
  };

  const verifyForgotOtp = async () => {
    setForgotError("");
    if (!forgotOtp.trim() || !forgotNewSecret.trim()) {
      setForgotError("OTP and new " +
        (tab === "driver" ? "PIN" : "password") +
        " are required");
      return;
    }
    if (tab === "admin" || tab === "supervisor") {
      if (forgotNewSecret.trim().length < 8) {
        setForgotError("Password must be at least 8 characters");
        return;
      }
    }
    if (tab === "driver") {
      if (forgotNewSecret.trim().length !== 4 || !/^\d{4}$/.test(forgotNewSecret.trim())) {
        setForgotError("Driver PIN must be exactly 4 digits");
        return;
      }
    }
    setForgotLoading(true);
    try {
      if (tab === "admin" || tab === "supervisor") {
        await api.post("/auth/admin/reset-password", {
          email: forgotEmail.trim(),
          otp: forgotOtp.trim(),
          new_password: forgotNewSecret.trim()
        });
      } else {
        await api.post("/auth/driver/reset-pin", {
          employee_id: forgotEmpId.trim().toUpperCase(),
          otp: forgotOtp.trim(),
          new_pin: forgotNewSecret.trim()
        });
      }
      setForgotSuccess(
        tab === "driver"
          ? "PIN reset successfully! Please login."
          : "Password reset successfully! Please login."
      );
      setForgotStep(3);
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join(", ")
        : typeof detail === "string"
        ? detail
        : "Failed to reset. Please try again.";
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgotFlow = () => {
    setForgotMode(false);
    setForgotStep(1);
    setForgotEmail("");
    setForgotEmpId("");
    setForgotOtp("");
    setForgotNewSecret("");
    setForgotError("");
    setForgotSuccess("");
  };

  const accent = tab === "admin" ? "#7C3AED" : tab === "supervisor" ? "#0F2044" : "#059669";

  return (
    <View testID="login-screen" style={{ flex: 1, backgroundColor: accent }}>
      {/* Gradient overlay */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.15)",
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
                paddingHorizontal: rp(32),
                paddingTop: rp(24),
                paddingBottom: rp(24),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderRadius: rp(100),
                  padding: rp(22),
                  marginBottom: rp(18),
                }}
              >
                <Ionicons name="car-sport" size={rs(52)} color="#fff" />
              </View>
              <Text
                style={{
                  color: "#fff",
                  fontSize: rs(36),
                  fontWeight: "900",
                  letterSpacing: rs(4),
                }}
              >
                INSTAPARK
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.75)",
                  marginTop: rp(8),
                  fontSize: rs(14),
                  letterSpacing: rs(1),
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
                borderTopLeftRadius: rp(44),
                borderTopRightRadius: rp(44),
                paddingHorizontal: rp(24),
                paddingTop: rp(32),
                paddingBottom: rp(40),
              }}
            >
              {/* Tabs */}
              <View
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 1,
                  borderBottomColor: "#E5E7EB",
                  marginBottom: rp(24),
                }}
              >
                <TouchableOpacity
                  testID="tab-admin"
                  style={{ flex: 1, paddingBottom: rp(12), alignItems: "center" }}
                  onPress={() => {
                    setTab("admin");
                    setError("");
                    setSupEmail("");
                    setSupPassword("");
                    setEmpId("");
                    setPin("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontWeight: "800",
                      fontSize: rs(15),
                      letterSpacing: rs(2),
                      color: tab === "admin" ? "#7C3AED" : "#9CA3AF",
                    }}
                  >
                    ADMIN
                  </Text>
                  {tab === "admin" && (
                    <View
                      style={{
                        height: rp(3),
                        width: rp(56),
                        backgroundColor: "#7C3AED",
                        borderRadius: rp(99),
                        marginTop: rp(8),
                      }}
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  testID="tab-supervisor"
                  style={{ flex: 1, paddingBottom: rp(12), alignItems: "center" }}
                  onPress={() => {
                    setTab("supervisor");
                    setError("");
                    setEmail("");
                    setPassword("");
                    setEmpId("");
                    setPin("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontWeight: "800",
                      fontSize: rs(15),
                      letterSpacing: rs(2),
                      color: tab === "supervisor" ? "#0F2044" : "#9CA3AF",
                    }}
                  >
                    SUPERVISOR
                  </Text>
                  {tab === "supervisor" && (
                    <View
                      style={{
                        height: rp(3),
                        width: rp(56),
                        backgroundColor: "#0F2044",
                        borderRadius: rp(99),
                        marginTop: rp(8),
                      }}
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  testID="tab-driver"
                  style={{ flex: 1, paddingBottom: rp(12), alignItems: "center" }}
                  onPress={() => {
                    setTab("driver");
                    setError("");
                    setEmail("");
                    setPassword("");
                    setSupEmail("");
                    setSupPassword("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontWeight: "800",
                      fontSize: rs(15),
                      letterSpacing: rs(2),
                      color: tab === "driver" ? "#059669" : "#9CA3AF",
                    }}
                  >
                    DRIVER
                  </Text>
                  {tab === "driver" && (
                    <View
                      style={{
                        height: rp(3),
                        width: rp(56),
                        backgroundColor: "#059669",
                        borderRadius: rp(99),
                        marginTop: rp(8),
                      }}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {tab === "admin" ? (
                <View>
                  <Text style={styles.label}>EMAIL</Text>
                  <View style={styles.input}>
                    <Ionicons name="mail-outline" size={20} color={accent} />
                    <TextInput
                      testID="admin-email-input"
                      value={email}
                      onChangeText={setEmail}
                      placeholder="your@email.com"
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
              ) : tab === "supervisor" ? (
                <View>
                  <Text style={styles.label}>EMAIL</Text>
                  <View style={styles.input}>
                    <Ionicons name="mail-outline" size={20} color={accent} />
                    <TextInput
                      testID="sup-email-input"
                      value={supEmail}
                      onChangeText={setSupEmail}
                      placeholder="your@email.com"
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
                      testID="sup-password-input"
                      value={supPassword}
                      onChangeText={setSupPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showSupPwd}
                      style={styles.textInput}
                    />
                    <TouchableOpacity
                      onPress={() => setShowSupPwd((s) => !s)}
                      testID="toggle-sup-password"
                    >
                      <Ionicons
                        name={showSupPwd ? "eye-off-outline" : "eye-outline"}
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
                      placeholder="DRV12345"
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
                      secureTextEntry={!showDriverPin}
                      maxLength={4}
                      keyboardType="numeric"
                      style={styles.textInput}
                    />
                    <TouchableOpacity
                      onPress={() => setShowDriverPin((s) => !s)}
                      testID="toggle-driver-pin"
                    >
                      <Ionicons
                        name={showDriverPin ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#059669"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {error ? (
                <View
                  testID="login-error"
                  style={{
                    backgroundColor: "rgba(244,63,94,0.08)",
                    borderWidth: 1,
                    borderColor: "rgba(244,63,94,0.5)",
                    borderRadius: rp(14),
                    padding: rp(12),
                    marginBottom: rp(16),
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="alert-circle" size={rs(20)} color="#F43F5E" />
                  <Text style={{ color: "#9F1239", marginLeft: rp(8), flex: 1, fontSize: rs(13) }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                testID="login-submit"
                onPress={submit}
                disabled={loading}
                activeOpacity={0.85}
                style={{
                  backgroundColor: accent,
                  borderRadius: rp(16),
                  paddingVertical: rp(16),
                  alignItems: "center",
                  marginTop: rp(8),
                  shadowColor: accent,
                  shadowOpacity: 0.3,
                  shadowRadius: rp(16),
                  shadowOffset: { width: 0, height: rp(6) },
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
                      fontSize: rs(15),
                      letterSpacing: rs(2),
                    }}
                  >
                    SIGN IN
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setForgotMode(true);
                  setForgotStep(1);
                  setForgotError("");
                  setForgotSuccess("");
                }}
                style={{ alignItems: "center", marginTop: rp(12) }}
              >
                <Text style={{ color: accent, fontSize: rs(13),
                  fontWeight: "700" }}>
                  {tab === "driver"
                    ? "Forgot PIN?"
                    : "Forgot Password?"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={forgotMode}
        animationType="slide"
        transparent
      >
        <View style={{ flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end" }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={{ backgroundColor: "#fff",
              borderTopLeftRadius: rp(36),
              borderTopRightRadius: rp(36),
              padding: rp(24) }}>

              {/* Handle */}
              <View style={{ alignItems: "center",
                marginBottom: rp(16) }}>
                <View style={{ backgroundColor: "#D1D5DB",
                  width: rp(48), height: rp(4), borderRadius: rp(99) }} />
              </View>

              {/* Header */}
              <View style={{ flexDirection: "row",
                alignItems: "center", marginBottom: rp(20) }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: rs(20), fontWeight: "900",
                    color: "#111827" }}>
                    {tab === "driver"
                      ? "Reset PIN" : "Reset Password"}
                  </Text>
                  <Text style={{ color: "#9CA3AF", fontSize: rs(13),
                    marginTop: rp(4) }}>
                    {forgotStep === 1
                      ? "We will send an OTP to your email"
                      : forgotStep === 2
                      ? "Enter the OTP from your email"
                      : "Done!"}
                  </Text>
                </View>
                <TouchableOpacity onPress={resetForgotFlow}>
                  <Ionicons name="close-circle" size={rs(28)}
                    color="#D1D5DB" />
                </TouchableOpacity>
              </View>

              {/* Step 1 — Enter email/employee ID */}
              {forgotStep === 1 && (
                <>
                  {tab === "admin" || tab === "supervisor" ? (
                    <>
                      <Text style={{ fontSize: rs(11),
                        fontWeight: "800", color: "#6B7280",
                        letterSpacing: rs(2), marginBottom: rp(8) }}>
                        YOUR EMAIL ADDRESS
                      </Text>
                      <View style={{ backgroundColor: "#F9FAFB",
                        borderRadius: rp(14), borderWidth: 1,
                        borderColor: "#E5E7EB",
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: rp(14), marginBottom: rp(16) }}>
                        <Ionicons name="mail-outline" size={rs(18)}
                          color={accent} />
                        <TextInput
                          value={forgotEmail}
                          onChangeText={(v) => {
                            setForgotEmail(v);
                            setForgotError("");
                          }}
                          placeholder="your@email.com"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          style={{ flex: 1, paddingVertical: rp(14),
                            paddingLeft: rp(10), fontSize: rs(15),
                            color: "#111827" }}
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: rs(11),
                        fontWeight: "800", color: "#6B7280",
                        letterSpacing: rs(2), marginBottom: rp(8) }}>
                        YOUR EMPLOYEE ID
                      </Text>
                      <View style={{ backgroundColor: "#F9FAFB",
                        borderRadius: rp(14), borderWidth: 1,
                        borderColor: "#E5E7EB",
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: rp(14), marginBottom: rp(16) }}>
                        <Ionicons name="id-card-outline" size={rs(18)}
                          color="#059669" />
                        <TextInput
                          value={forgotEmpId}
                          onChangeText={(v) => {
                            setForgotEmpId(v);
                            setForgotError("");
                          }}
                          placeholder="DRV12345"
                          placeholderTextColor="#9CA3AF"
                          autoCapitalize="characters"
                          style={{ flex: 1, paddingVertical: rp(14),
                            paddingLeft: rp(10), fontSize: rs(15),
                            color: "#111827" }}
                        />
                      </View>
                    </>
                  )}
                  {forgotError ? (
                    <Text style={{ color: "#EF4444", fontSize: rs(13),
                      marginBottom: rp(12) }}>{forgotError}</Text>
                  ) : null}
                  <TouchableOpacity
                    onPress={sendForgotOtp}
                    disabled={forgotLoading}
                    style={{ backgroundColor: accent,
                      borderRadius: rp(16), paddingVertical: rp(16),
                      alignItems: "center" }}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff",
                        fontWeight: "900", letterSpacing: rs(2) }}>
                        SEND OTP
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Step 2 — Enter OTP + new secret */}
              {forgotStep === 2 && (
                <>
                  {forgotSuccess ? (
                    <View style={{ backgroundColor: accent + "1A",
                      borderRadius: rp(12), padding: rp(12),
                      marginBottom: rp(16) }}>
                      <Text style={{ color: accent,
                        fontWeight: "700", fontSize: rs(13) }}>
                        {forgotSuccess}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ fontSize: rs(11), fontWeight: "800",
                    color: "#6B7280", letterSpacing: rs(2),
                    marginBottom: rp(8) }}>
                    6-DIGIT OTP
                  </Text>
                  <View style={{ backgroundColor: "#F9FAFB",
                    borderRadius: rp(14), borderWidth: 1,
                    borderColor: "#E5E7EB", flexDirection: "row",
                    alignItems: "center", paddingHorizontal: rp(14),
                    marginBottom: rp(16) }}>
                    <Ionicons name="shield-checkmark-outline"
                      size={rs(18)}
                      color={accent} />
                    <TextInput
                      value={forgotOtp}
                      onChangeText={setForgotOtp}
                      placeholder="123456"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={6}
                      style={{ flex: 1, paddingVertical: rp(14),
                        paddingLeft: rp(10), fontSize: rs(18),
                        color: "#111827", fontWeight: "900",
                        letterSpacing: rs(6) }}
                    />
                  </View>
                  <Text style={{ fontSize: rs(11), fontWeight: "800",
                    color: "#6B7280", letterSpacing: rs(2),
                    marginBottom: rp(8) }}>
                    {tab === "driver"
                      ? "NEW 4-DIGIT PIN" : "NEW PASSWORD"}
                  </Text>
                  <View style={{ backgroundColor: "#F9FAFB",
                    borderRadius: rp(14), borderWidth: 1,
                    borderColor: "#E5E7EB", flexDirection: "row",
                    alignItems: "center", paddingHorizontal: rp(14),
                    marginBottom: rp(16) }}>
                    <Ionicons name="lock-closed-outline"
                      size={rs(18)}
                      color={accent} />
                    <TextInput
                      value={forgotNewSecret}
                      onChangeText={setForgotNewSecret}
                      placeholder={tab === "driver"
                        ? "4 digits" : "Min 6 characters"}
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      keyboardType={tab === "driver"
                        ? "number-pad" : "default"}
                      maxLength={tab === "driver" ? 4 : 50}
                      style={{ flex: 1, paddingVertical: rp(14),
                        paddingLeft: rp(10), fontSize: rs(15),
                        color: "#111827" }}
                    />
                  </View>
                  {forgotError ? (
                    <Text style={{ color: "#EF4444", fontSize: rs(13),
                      marginBottom: rp(12) }}>{forgotError}</Text>
                  ) : null}
                  <TouchableOpacity
                    onPress={verifyForgotOtp}
                    disabled={forgotLoading}
                    style={{ backgroundColor: accent,
                      borderRadius: rp(16), paddingVertical: rp(16),
                      alignItems: "center" }}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff",
                        fontWeight: "900", letterSpacing: rs(2) }}>
                        RESET {tab === "driver"
                          ? "PIN" : "PASSWORD"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Step 3 — Success */}
              {forgotStep === 3 && (
                <>
                  <View style={{ alignItems: "center",
                    paddingVertical: rp(20) }}>
                    <Ionicons name="checkmark-circle"
                      size={rs(64)}
                      color={accent} />
                    <Text style={{ fontSize: rs(18),
                      fontWeight: "900", color: "#111827",
                      marginTop: rp(16), textAlign: "center" }}>
                      {tab === "driver"
                        ? "PIN Reset!" : "Password Reset!"}
                    </Text>
                    <Text style={{ color: "#6B7280", fontSize: rs(14),
                      marginTop: rp(8), textAlign: "center" }}>
                      You can now login with your new
                      {tab === "driver" ? " PIN" : " password"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={resetForgotFlow}
                    style={{ backgroundColor: accent,
                      borderRadius: rp(16), paddingVertical: rp(16),
                      alignItems: "center", marginTop: rp(8) }}
                  >
                    <Text style={{ color: "#fff",
                      fontWeight: "900", letterSpacing: rs(2) }}>
                      BACK TO LOGIN
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={{ height: rp(20) }} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  label: {
    fontSize: rs(11),
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: rs(3),
    textTransform: "uppercase",
    marginBottom: rp(8),
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: rp(16),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: rp(16),
    marginBottom: rp(16),
  },
  textInput: {
    flex: 1,
    paddingVertical: rp(16),
    marginLeft: rp(12),
    fontSize: rs(15),
    color: "#111827",
  },
};
