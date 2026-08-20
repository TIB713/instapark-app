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
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import api from "../../lib/api";
import { registerForPushNotifications } from "../../lib/notifications";
import { useAppStore } from "../../lib/store";
import { rs, rp } from "../../utils/responsive";
import { getRouteForRole } from "../../lib/routeForRole";

const requestPushPermissions = async (role) => {
  if (role !== "driver" && role !== "supervisor") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === "granted") {
    }
  } catch { }
};

const { height: SCREEN_H } = Dimensions.get("window");

export default function Login() {
  const router = useRouter();
  const { setUser, setDriver, setToken } = useAppStore();

  const [loginStep, setLoginStep] = useState(1); // 1 = Phone, 2 = Credential
  const [phone, setPhone] = useState("");
  const [credential, setCredential] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accountRole, setAccountRole] = useState(""); // store role for Step 2 UI

  // First Login (Activation) State
  const [firstLoginMode, setFirstLoginMode] = useState(false);
  const [firstLoginOtp, setFirstLoginOtp] = useState("");
  const [newCredential, setNewCredential] = useState("");
  const [confirmCredential, setConfirmCredential] = useState("");
  const [firstLoginLoading, setFirstLoginLoading] = useState(false);
  const [firstLoginError, setFirstLoginError] = useState("");
  const [firstLoginSuccess, setFirstLoginSuccess] = useState("");

  // Forgot Password State
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewSecret, setForgotNewSecret] = useState("");
  const [forgotConfirmSecret, setForgotConfirmSecret] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  const handleLoginSuccess = async (data) => {
    api.defaults.headers.common["Authorization"] = "Bearer " + data.token;
    await setItem("auth_token", data.token);
    await AsyncStorage.setItem("auth_token", data.token);
    await AsyncStorage.setItem("api_url", process.env.EXPO_PUBLIC_API_URL || "");

    setToken(data.token);

    if (data.user.role === "driver") {
      await AsyncStorage.setItem("driver_session", JSON.stringify(data.user));
      setDriver(data.user);
    } else {
      await AsyncStorage.setItem("admin_session", JSON.stringify(data.user));
      setUser(data.user);
    }
    await setItem("last_known_role", data.user.role);
    try { registerForPushNotifications(api); } catch { }

    if (data.user.role === "driver") {
      await useAppStore.getState().fetchEvents();
    }

    const route = getRouteForRole(data.user.role);
    router.replace(route);
  };

  const checkPhone = async () => {
    setError("");
    if (!/^\d{10}$/.test(phone.trim())) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/check-phone", { phone: phone.trim() });
      if (!data.exists) {
        setError("No account found with this number");
        setLoading(false);
        return;
      }

      setAccountRole(data.role);

      if (data.is_verified) {
        setLoginStep(2);
      } else {
        try {
          await api.post("/auth/first-login/send-otp", { phone: phone.trim() });
          setFirstLoginMode(true);
          setFirstLoginSuccess("OTP sent to your email/phone to activate your account.");
        } catch (err) {
          setError("Failed to send OTP for activation.");
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to verify phone number");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!credential) {
      setError("Password/PIN is required");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        phone: phone.trim(),
        password: credential,
      });
      await handleLoginSuccess(data);
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Login failed";
      setError(typeof msg === "string" ? msg : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const submitFirstLogin = async () => {
    setFirstLoginError("");
    if (!firstLoginOtp.trim() || !newCredential || !confirmCredential) {
      setFirstLoginError("All fields are required");
      return;
    }
    if (newCredential !== confirmCredential) {
      setFirstLoginError("Passwords/PINs do not match");
      return;
    }

    setFirstLoginLoading(true);
    try {
      const { data } = await api.post("/auth/first-login/verify", {
        phone: phone.trim(),
        otp: firstLoginOtp.trim(),
        new_credential: newCredential,
        confirm_credential: confirmCredential
      });
      await handleLoginSuccess(data);
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(d => d.msg).join(", ") : (typeof detail === "string" ? detail : "Failed to activate account");
      setFirstLoginError(msg);
    } finally {
      setFirstLoginLoading(false);
    }
  };

  const sendForgotOtp = async () => {
    setForgotError("");
    setForgotLoading(true);
    try {
      if (!/^\d{10}$/.test(forgotPhone.trim())) {
        setForgotError("A valid 10-digit phone number is required");
        return;
      }
      await api.post("/auth/forgot-password", { phone: forgotPhone.trim() });
      setForgotStep(2);
      setForgotSuccess("OTP sent to your registered email or phone");
    } catch (e) {
      const detail = e.response?.data?.detail;
      setForgotError(typeof detail === "string" ? detail : "Failed to send OTP.");
    } finally {
      setForgotLoading(false);
    }
  };

  const verifyForgotOtp = async () => {
    setForgotError("");
    if (!forgotOtp.trim() || !forgotNewSecret || !forgotConfirmSecret) {
      setForgotError("All fields are required");
      return;
    }
    if (forgotNewSecret !== forgotConfirmSecret) {
      setForgotError("Passwords/PINs do not match");
      return;
    }
    setForgotLoading(true);
    try {
      await api.post("/auth/reset-password", {
        phone: forgotPhone.trim(),
        otp: forgotOtp.trim(),
        new_credential: forgotNewSecret,
        confirm_credential: forgotConfirmSecret
      });
      setForgotSuccess("Reset successfully! Please login.");
      setForgotStep(3);
    } catch (e) {
      const detail = e.response?.data?.detail;
      setForgotError(typeof detail === "string" ? detail : "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgotFlow = () => {
    setForgotMode(false);
    setForgotStep(1);
    setForgotPhone(phone); // initialize with current phone
    setForgotOtp("");
    setForgotNewSecret("");
    setForgotConfirmSecret("");
    setForgotError("");
    setForgotSuccess("");
  };

  const cancelFirstLogin = () => {
    setFirstLoginMode(false);
    setLoginStep(1);
    setFirstLoginOtp("");
    setNewCredential("");
    setConfirmCredential("");
    setFirstLoginError("");
    setFirstLoginSuccess("");
  };

  const accent = "#0F2044";

  return (
    <View testID="login-screen" style={{ flex: 1, backgroundColor: accent }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.15)" }} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ minHeight: SCREEN_H * 0.36, paddingHorizontal: rp(32), paddingTop: rp(24), paddingBottom: rp(24), alignItems: "center", justifyContent: "center" }}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: rp(100), padding: rp(22), marginBottom: rp(18) }}>
                <Ionicons name="car-sport" size={rs(52)} color="#fff" />
              </View>
              <Text style={{ color: "#fff", fontSize: rs(36), fontWeight: "900", letterSpacing: rs(4) }}>INSTAPARK</Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", marginTop: rp(8), fontSize: rs(14), letterSpacing: rs(1) }}>Valet Management System</Text>
            </View>

            <View style={{ flex: 1, backgroundColor: "#fff", borderTopLeftRadius: rp(44), borderTopRightRadius: rp(44), paddingHorizontal: rp(24), paddingTop: rp(32), paddingBottom: rp(40) }}>

              {!firstLoginMode && !forgotMode && loginStep === 1 && (
                <View>
                  <Text style={{ fontSize: rs(22), fontWeight: "800", color: accent, marginBottom: rp(24), textAlign: "center" }}>LOGIN</Text>

                  <Text style={styles.label}>MOBILE NUMBER</Text>
                  <View style={styles.input}>
                    <Ionicons name="call-outline" size={20} color={accent} />
                    <TextInput
                      value={phone}
                      onChangeText={(t) => { setPhone(t); setError(""); }}
                      placeholder="10-digit mobile number"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      maxLength={10}
                      style={styles.textInput}
                    />
                  </View>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity style={[styles.button, { backgroundColor: accent, marginTop: rp(8) }]} onPress={checkPhone} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>CONTINUE</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {!firstLoginMode && !forgotMode && loginStep === 2 && (
                <View>
                  <Text style={{ fontSize: rs(22), fontWeight: "800", color: accent, marginBottom: rp(24), textAlign: "center" }}>LOGIN</Text>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(8) }}>
                    <Text style={[styles.label, { marginBottom: 0 }]}>MOBILE NUMBER</Text>
                    <TouchableOpacity onPress={() => { setLoginStep(1); setError(); setCredential(""); }}>
                      <Text style={{ color: accent, fontSize: rs(12), fontWeight: "700" }}>CHANGE</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.input, { backgroundColor: "#F9FAFB", opacity: 0.7 }]}>
                    <Ionicons name="call-outline" size={20} color={accent} />
                    <TextInput
                      value={phone}
                      editable={false}
                      style={[styles.textInput, { color: "#6B7280" }]}
                    />
                  </View>

                  <Text style={styles.label}>{accountRole === "driver" ? "PIN" : "PASSWORD"}</Text>
                  <View style={styles.input}>
                    <Ionicons name="lock-closed-outline" size={20} color={accent} />
                    <TextInput
                      value={credential}
                      onChangeText={(t) => { setCredential(t); setError(""); }}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPwd}
                      keyboardType={accountRole === "driver" ? "numeric" : "default"}
                      maxLength={accountRole === "driver" ? 4 : undefined}
                      style={styles.textInput}
                    />
                    <TouchableOpacity onPress={() => setShowPwd((s) => !s)}>
                      <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={() => { setForgotPhone(phone); setForgotMode(true); }} style={{ alignSelf: "flex-end", marginBottom: rp(24) }}>
                    <Text style={{ color: accent, fontSize: rs(14), fontWeight: "600" }}>Forgot Password?</Text>
                  </TouchableOpacity>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={submit} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>SIGN IN</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {firstLoginMode && (
                <View>
                  <Text style={{ fontSize: rs(22), fontWeight: "800", color: accent, marginBottom: rp(8), textAlign: "center" }}>ACTIVATE ACCOUNT</Text>
                  <Text style={{ color: "#6B7280", fontSize: rs(14), textAlign: "center", marginBottom: rp(24) }}>Please set your {accountRole === "driver" ? "PIN" : "Password"} to activate your account.</Text>

                  {firstLoginSuccess ? <Text style={styles.successText}>{firstLoginSuccess}</Text> : null}

                  <Text style={styles.label}>OTP (from email)</Text>
                  <View style={styles.input}>
                    <Ionicons name="keypad-outline" size={20} color={accent} />
                    <TextInput
                      value={firstLoginOtp}
                      onChangeText={setFirstLoginOtp}
                      placeholder="6-digit OTP"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      style={styles.textInput}
                    />
                  </View>

                  <Text style={styles.label}>NEW {accountRole === "driver" ? "PIN" : "PASSWORD"}</Text>
                  <View style={styles.input}>
                    <Ionicons name="lock-closed-outline" size={20} color={accent} />
                    <TextInput
                      value={newCredential}
                      onChangeText={setNewCredential}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPwd}
                      keyboardType={accountRole === "driver" ? "numeric" : "default"}
                      maxLength={accountRole === "driver" ? 4 : undefined}
                      style={styles.textInput}
                    />
                    <TouchableOpacity onPress={() => setShowPwd((s) => !s)}>
                      <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>CONFIRM {accountRole === "driver" ? "PIN" : "PASSWORD"}</Text>
                  <View style={styles.input}>
                    <Ionicons name="lock-closed-outline" size={20} color={accent} />
                    <TextInput
                      value={confirmCredential}
                      onChangeText={setConfirmCredential}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPwd}
                      keyboardType={accountRole === "driver" ? "numeric" : "default"}
                      maxLength={accountRole === "driver" ? 4 : undefined}
                      style={styles.textInput}
                    />
                  </View>

                  {firstLoginError ? <Text style={styles.errorText}>{firstLoginError}</Text> : null}

                  <TouchableOpacity style={[styles.button, { backgroundColor: accent, marginBottom: rp(16) }]} onPress={submitFirstLogin} disabled={firstLoginLoading}>
                    {firstLoginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ACTIVATE & LOGIN</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={cancelFirstLogin} style={{ alignItems: "center" }}>
                    <Text style={{ color: "#6B7280", fontSize: rs(14), fontWeight: "600" }}>Cancel / Change Number</Text>
                  </TouchableOpacity>
                </View>
              )}

              {forgotMode && (
                <View>
                  {forgotStep === 1 && (
                    <View>
                      <Text style={{ fontSize: rs(22), fontWeight: "800", color: accent, marginBottom: rp(8), textAlign: "center" }}>RESET PASSWORD</Text>
                      <Text style={{ color: "#6B7280", fontSize: rs(14), textAlign: "center", marginBottom: rp(24) }}>Enter your registered mobile number.</Text>

                      <Text style={styles.label}>MOBILE NUMBER</Text>
                      <View style={styles.input}>
                        <Ionicons name="call-outline" size={20} color={accent} />
                        <TextInput
                          value={forgotPhone}
                          onChangeText={setForgotPhone}
                          placeholder="10-digit mobile number"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                          maxLength={10}
                          style={styles.textInput}
                          editable={loginStep === 1}
                        />
                      </View>

                      {forgotError ? <Text style={styles.errorText}>{forgotError}</Text> : null}

                      <TouchableOpacity style={[styles.button, { backgroundColor: accent, marginBottom: rp(16) }]} onPress={sendForgotOtp} disabled={forgotLoading}>
                        {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>SEND OTP</Text>}
                      </TouchableOpacity>
                    </View>
                  )}

                  {forgotStep === 2 && (
                    <View>
                      <Text style={{ fontSize: rs(22), fontWeight: "800", color: accent, marginBottom: rp(8), textAlign: "center" }}>ENTER OTP & NEW PIN/PASSWORD</Text>

                      {forgotSuccess ? <Text style={styles.successText}>{forgotSuccess}</Text> : null}

                      <Text style={styles.label}>OTP</Text>
                      <View style={styles.input}>
                        <Ionicons name="keypad-outline" size={20} color={accent} />
                        <TextInput
                          value={forgotOtp}
                          onChangeText={setForgotOtp}
                          placeholder="6-digit OTP"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                          style={styles.textInput}
                        />
                      </View>

                      <Text style={styles.label}>NEW PASSWORD / PIN</Text>
                      <View style={styles.input}>
                        <Ionicons name="lock-closed-outline" size={20} color={accent} />
                        <TextInput
                          value={forgotNewSecret}
                          onChangeText={setForgotNewSecret}
                          placeholder="••••••••"
                          placeholderTextColor="#9CA3AF"
                          secureTextEntry={!showPwd}
                          keyboardType={accountRole === "driver" ? "numeric" : "default"}
                          maxLength={accountRole === "driver" ? 4 : undefined}
                          style={styles.textInput}
                        />
                        <TouchableOpacity onPress={() => setShowPwd((s) => !s)}>
                          <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color="#6B7280" />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.label}>CONFIRM PASSWORD / PIN</Text>
                      <View style={styles.input}>
                        <Ionicons name="lock-closed-outline" size={20} color={accent} />
                        <TextInput
                          value={forgotConfirmSecret}
                          onChangeText={setForgotConfirmSecret}
                          placeholder="••••••••"
                          placeholderTextColor="#9CA3AF"
                          secureTextEntry={!showPwd}
                          keyboardType={accountRole === "driver" ? "numeric" : "default"}
                          maxLength={accountRole === "driver" ? 4 : undefined}
                          style={styles.textInput}
                        />
                      </View>

                      {forgotError ? <Text style={styles.errorText}>{forgotError}</Text> : null}

                      <TouchableOpacity style={[styles.button, { backgroundColor: accent, marginBottom: rp(16) }]} onPress={verifyForgotOtp} disabled={forgotLoading}>
                        {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>RESET CREDENTIALS</Text>}
                      </TouchableOpacity>
                    </View>
                  )}

                  {forgotStep === 3 && (
                    <View style={{ alignItems: "center", paddingVertical: rp(24) }}>
                      <View style={{ width: rp(64), height: rp(64), borderRadius: rp(32), backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center", marginBottom: rp(16) }}>
                        <Ionicons name="checkmark-circle" size={rs(40)} color="#059669" />
                      </View>
                      <Text style={{ fontSize: rs(18), fontWeight: "700", color: "#111827", marginBottom: rp(8) }}>Success</Text>
                      <Text style={{ color: "#6B7280", fontSize: rs(14), textAlign: "center", marginBottom: rp(24) }}>{forgotSuccess}</Text>
                    </View>
                  )}

                  <TouchableOpacity onPress={resetForgotFlow} style={{ alignItems: "center" }}>
                    <Text style={{ color: "#6B7280", fontSize: rs(14), fontWeight: "600" }}>
                      {forgotStep === 3 ? "Back to Login" : "Cancel"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

            </View>
            <Text style={{ 
              textAlign: "center", 
              color: "rgba(255,255,255,0.4)", 
              fontSize: rs(11), 
              marginTop: rp(8),
              marginBottom: rp(4)
            }}>
              v{Constants.expoConfig?.version || "1.0.0"}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = {
  label: {
    fontSize: rs(12),
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: rp(8),
    letterSpacing: rs(0.5),
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: rp(12),
    paddingHorizontal: rp(16),
    height: rp(52),
    marginBottom: rp(20),
  },
  textInput: {
    flex: 1,
    marginLeft: rp(12),
    fontSize: rs(15),
    color: "#111827",
    fontWeight: "500",
  },
  button: {
    height: rp(52),
    borderRadius: rp(12),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: rs(15),
    fontWeight: "800",
    letterSpacing: rs(1),
  },
  errorText: {
    color: "#DC2626",
    fontSize: rs(13),
    marginBottom: rp(16),
    textAlign: "center",
  },
  successText: {
    color: "#059669",
    fontSize: rs(13),
    marginBottom: rp(16),
    textAlign: "center",
    backgroundColor: "#ECFDF5",
    padding: rp(12),
    borderRadius: rp(8),
  }
};
