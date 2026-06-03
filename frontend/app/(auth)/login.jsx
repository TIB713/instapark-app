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
        let data;
        let role;
        try {
          const res = await api.post("/auth/admin/login", {
            email: email.trim(),
            password,
          });
          data = res.data;
          role = data.user?.role;
        } catch {
          try {
            const res = await api.post("/auth/supervisor/login", {
              email: email.trim(),
              password,
            });
            data = res.data;
            role = "supervisor";
          } catch (e2) {
            const msg =
              e2.response?.data?.detail || "Invalid email or password";
            setError(typeof msg === "string" ? msg : "Login failed");
            setLoading(false);
            return;
          }
        }
        await setItem("auth_token", data.token);
        setToken(data.token);
        setUser(data.user);
        if (role === "supervisor") {
          router.replace("/(supervisor)/dashboard");
        } else {
          router.replace("/(admin)/dashboard");
        }
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
        router.replace("/(driver)");
      }
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Login failed";
      setError(typeof msg === "string" ? msg : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const sendForgotOtp = async () => {
    setForgotError("");
    setForgotLoading(true);
    try {
      if (tab === "admin") {
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
      setForgotError(
        e.response?.data?.detail || "Failed to send OTP"
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const verifyForgotOtp = async () => {
    setForgotError("");
    if (!forgotOtp.trim() || !forgotNewSecret.trim()) {
      setForgotError("OTP and new " +
        (tab === "admin" ? "password" : "PIN") +
        " are required");
      return;
    }
    setForgotLoading(true);
    try {
      if (tab === "admin") {
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
        tab === "admin"
          ? "Password reset successfully! Please login."
          : "PIN reset successfully! Please login."
      );
      setForgotStep(3);
    } catch (e) {
      setForgotError(
        e.response?.data?.detail || "Invalid or expired OTP"
      );
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
              <TouchableOpacity
                onPress={() => {
                  setForgotMode(true);
                  setForgotStep(1);
                  setForgotError("");
                  setForgotSuccess("");
                }}
                style={{ alignItems: "center", marginTop: 12 }}
              >
                <Text style={{ color: "#7C3AED", fontSize: 13,
                  fontWeight: "700" }}>
                  {tab === "admin"
                    ? "Forgot Password?"
                    : "Forgot PIN?"}
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
              borderTopLeftRadius: 36,
              borderTopRightRadius: 36,
              padding: 24 }}>

              {/* Handle */}
              <View style={{ alignItems: "center",
                marginBottom: 16 }}>
                <View style={{ backgroundColor: "#D1D5DB",
                  width: 48, height: 4, borderRadius: 99 }} />
              </View>

              {/* Header */}
              <View style={{ flexDirection: "row",
                alignItems: "center", marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: "900",
                    color: "#111827" }}>
                    {tab === "admin"
                      ? "Reset Password" : "Reset PIN"}
                  </Text>
                  <Text style={{ color: "#9CA3AF", fontSize: 13,
                    marginTop: 4 }}>
                    {forgotStep === 1
                      ? "We will send an OTP to your email"
                      : forgotStep === 2
                      ? "Enter the OTP from your email"
                      : "Done!"}
                  </Text>
                </View>
                <TouchableOpacity onPress={resetForgotFlow}>
                  <Ionicons name="close-circle" size={28}
                    color="#D1D5DB" />
                </TouchableOpacity>
              </View>

              {/* Step 1 — Enter email/employee ID */}
              {forgotStep === 1 && (
                <>
                  {tab === "admin" ? (
                    <>
                      <Text style={{ fontSize: 11,
                        fontWeight: "800", color: "#6B7280",
                        letterSpacing: 2, marginBottom: 8 }}>
                        YOUR EMAIL ADDRESS
                      </Text>
                      <View style={{ backgroundColor: "#F9FAFB",
                        borderRadius: 14, borderWidth: 1,
                        borderColor: "#E5E7EB",
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 14, marginBottom: 16 }}>
                        <Ionicons name="mail-outline" size={18}
                          color="#7C3AED" />
                        <TextInput
                          value={forgotEmail}
                          onChangeText={setForgotEmail}
                          placeholder="your@email.com"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          style={{ flex: 1, paddingVertical: 14,
                            paddingLeft: 10, fontSize: 15,
                            color: "#111827" }}
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 11,
                        fontWeight: "800", color: "#6B7280",
                        letterSpacing: 2, marginBottom: 8 }}>
                        YOUR EMPLOYEE ID
                      </Text>
                      <View style={{ backgroundColor: "#F9FAFB",
                        borderRadius: 14, borderWidth: 1,
                        borderColor: "#E5E7EB",
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 14, marginBottom: 16 }}>
                        <Ionicons name="id-card-outline" size={18}
                          color="#059669" />
                        <TextInput
                          value={forgotEmpId}
                          onChangeText={setForgotEmpId}
                          placeholder="DRV12345"
                          placeholderTextColor="#9CA3AF"
                          autoCapitalize="characters"
                          style={{ flex: 1, paddingVertical: 14,
                            paddingLeft: 10, fontSize: 15,
                            color: "#111827" }}
                        />
                      </View>
                    </>
                  )}
                  {forgotError ? (
                    <Text style={{ color: "#EF4444", fontSize: 13,
                      marginBottom: 12 }}>{forgotError}</Text>
                  ) : null}
                  <TouchableOpacity
                    onPress={sendForgotOtp}
                    disabled={forgotLoading}
                    style={{ backgroundColor:
                      tab === "admin" ? "#7C3AED" : "#059669",
                      borderRadius: 16, paddingVertical: 16,
                      alignItems: "center" }}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff",
                        fontWeight: "900", letterSpacing: 2 }}>
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
                    <View style={{ backgroundColor: "#ECFDF5",
                      borderRadius: 12, padding: 12,
                      marginBottom: 16 }}>
                      <Text style={{ color: "#059669",
                        fontWeight: "700", fontSize: 13 }}>
                        {forgotSuccess}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ fontSize: 11, fontWeight: "800",
                    color: "#6B7280", letterSpacing: 2,
                    marginBottom: 8 }}>
                    6-DIGIT OTP
                  </Text>
                  <View style={{ backgroundColor: "#F9FAFB",
                    borderRadius: 14, borderWidth: 1,
                    borderColor: "#E5E7EB", flexDirection: "row",
                    alignItems: "center", paddingHorizontal: 14,
                    marginBottom: 16 }}>
                    <Ionicons name="shield-checkmark-outline"
                      size={18}
                      color={tab === "admin"
                        ? "#7C3AED" : "#059669"} />
                    <TextInput
                      value={forgotOtp}
                      onChangeText={setForgotOtp}
                      placeholder="123456"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={6}
                      style={{ flex: 1, paddingVertical: 14,
                        paddingLeft: 10, fontSize: 18,
                        color: "#111827", fontWeight: "900",
                        letterSpacing: 6 }}
                    />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: "800",
                    color: "#6B7280", letterSpacing: 2,
                    marginBottom: 8 }}>
                    {tab === "admin"
                      ? "NEW PASSWORD" : "NEW 4-DIGIT PIN"}
                  </Text>
                  <View style={{ backgroundColor: "#F9FAFB",
                    borderRadius: 14, borderWidth: 1,
                    borderColor: "#E5E7EB", flexDirection: "row",
                    alignItems: "center", paddingHorizontal: 14,
                    marginBottom: 16 }}>
                    <Ionicons name="lock-closed-outline"
                      size={18}
                      color={tab === "admin"
                        ? "#7C3AED" : "#059669"} />
                    <TextInput
                      value={forgotNewSecret}
                      onChangeText={setForgotNewSecret}
                      placeholder={tab === "admin"
                        ? "Min 6 characters" : "4 digits"}
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      keyboardType={tab === "driver"
                        ? "number-pad" : "default"}
                      maxLength={tab === "driver" ? 4 : 50}
                      style={{ flex: 1, paddingVertical: 14,
                        paddingLeft: 10, fontSize: 15,
                        color: "#111827" }}
                    />
                  </View>
                  {forgotError ? (
                    <Text style={{ color: "#EF4444", fontSize: 13,
                      marginBottom: 12 }}>{forgotError}</Text>
                  ) : null}
                  <TouchableOpacity
                    onPress={verifyForgotOtp}
                    disabled={forgotLoading}
                    style={{ backgroundColor:
                      tab === "admin" ? "#7C3AED" : "#059669",
                      borderRadius: 16, paddingVertical: 16,
                      alignItems: "center" }}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff",
                        fontWeight: "900", letterSpacing: 2 }}>
                        RESET {tab === "admin"
                          ? "PASSWORD" : "PIN"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Step 3 — Success */}
              {forgotStep === 3 && (
                <>
                  <View style={{ alignItems: "center",
                    paddingVertical: 20 }}>
                    <Ionicons name="checkmark-circle"
                      size={64}
                      color={tab === "admin"
                        ? "#7C3AED" : "#059669"} />
                    <Text style={{ fontSize: 18,
                      fontWeight: "900", color: "#111827",
                      marginTop: 16, textAlign: "center" }}>
                      {tab === "admin"
                        ? "Password Reset!" : "PIN Reset!"}
                    </Text>
                    <Text style={{ color: "#6B7280", fontSize: 14,
                      marginTop: 8, textAlign: "center" }}>
                      You can now login with your new
                      {tab === "admin" ? " password" : " PIN"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={resetForgotFlow}
                    style={{ backgroundColor:
                      tab === "admin" ? "#7C3AED" : "#059669",
                      borderRadius: 16, paddingVertical: 16,
                      alignItems: "center", marginTop: 8 }}
                  >
                    <Text style={{ color: "#fff",
                      fontWeight: "900", letterSpacing: 2 }}>
                      BACK TO LOGIN
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={{ height: 20 }} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
