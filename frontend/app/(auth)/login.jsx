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
import { theme } from "../../utils/theme";
import Heading from "../../components/Heading";

const requestPushPermissions = async (role) => {
  if (role !== "driver" && role !== "supervisor") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === "granted") {
    }
  } catch { }
};

const { height: SCREEN_H } = Dimensions.get("window");

const {
  primary, primaryDark, accent, accentForeground, surface, border,
  textPrimary, textSecondary, textMuted, danger, dangerLight, success, successLight,
} = theme.colors;

// Reusable Field component — hoisted to module scope so it isn't recreated
// on every keystroke. Defining these inside Login() gave React a new
// component identity on every re-render, which remounted the TextInput
// and closed the keyboard after a single character.
const Field = ({ label, icon, value, onChangeText, placeholder, keyboardType, maxLength, editable, secureTextEntry, rightAccessory }) => (
  <View style={{ marginBottom: rp(theme.spacing.lg) }}>
    <View style={{
      borderColor: border,
      borderWidth: 1,
      borderRadius: rp(theme.radius.md),
      backgroundColor: editable === false ? theme.colors.surfaceAlt : surface,
      overflow: 'hidden'
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: rp(theme.spacing.md), paddingTop: rp(theme.spacing.md), paddingBottom: rp(theme.spacing.xs) }}>
        <Ionicons name={icon} size={16} color={primary} style={{ marginRight: rp(theme.spacing.sm) }} />
        <Text style={{ fontSize: rs(theme.fontSize.caption), fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: rp(theme.spacing.md), paddingBottom: rp(theme.spacing.md) }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={textMuted}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={editable}
          secureTextEntry={secureTextEntry}
          style={{ flex: 1, fontSize: rs(theme.fontSize.body), color: editable === false ? textSecondary : textPrimary, fontWeight: '500' }}
        />
        {rightAccessory}
      </View>
    </View>
  </View>
);

const PrimaryButton = ({ onPress, loading, text, style }) => (
  <TouchableOpacity
    style={[{
      backgroundColor: accent,
      borderRadius: rp(theme.radius.lg),
      height: rp(56),
      alignItems: "center",
      justifyContent: "center",
      shadowColor: accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    }, style]}
    onPress={onPress}
    disabled={loading}
  >
    {loading ? <ActivityIndicator color={accentForeground} /> : <Text style={{ color: accentForeground, fontSize: rs(theme.fontSize.bodyLarge), fontWeight: "800", letterSpacing: rs(1) }}>{text}</Text>}
  </TouchableOpacity>
);

const ErrorBanner = ({ error }) => {
  if (!error) return null;
  return (
    <View style={{ backgroundColor: dangerLight, borderColor: danger, borderWidth: 1, borderRadius: rp(theme.radius.sm), padding: rp(theme.spacing.md), marginBottom: rp(theme.spacing.lg) }}>
      <Text style={{ color: danger, fontSize: rs(theme.fontSize.body), textAlign: "center", fontWeight: "600" }}>{error}</Text>
    </View>
  );
};

const SuccessBanner = ({ success }) => {
  if (!success) return null;
  return (
    <View style={{ backgroundColor: successLight, borderColor: success, borderWidth: 1, borderRadius: rp(theme.radius.sm), padding: rp(theme.spacing.md), marginBottom: rp(theme.spacing.lg) }}>
      <Text style={{ color: success, fontSize: rs(theme.fontSize.body), textAlign: "center", fontWeight: "600" }}>{success}</Text>
    </View>
  );
};

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

  return (
    <View testID="login-screen" style={{ flex: 1, backgroundColor: primary }}>
      {/* Off-canvas blurs */}
      <View style={{ position: "absolute", top: -SCREEN_H * 0.1, left: -SCREEN_H * 0.1, width: SCREEN_H * 0.4, height: SCREEN_H * 0.4, borderRadius: SCREEN_H * 0.2, backgroundColor: primaryDark, opacity: 0.8, transform: [{ scale: 1.5 }] }} />
      <View style={{ position: "absolute", bottom: -SCREEN_H * 0.1, right: -SCREEN_H * 0.1, width: SCREEN_H * 0.4, height: SCREEN_H * 0.4, borderRadius: SCREEN_H * 0.2, backgroundColor: accent, opacity: 0.15, transform: [{ scale: 1.5 }] }} />
      
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ flex: 1, justifyContent: "center" }}>

            {/* Header / Brand Lockup */}
            <View style={{ minHeight: SCREEN_H * 0.35, paddingHorizontal: rp(theme.spacing.xxxl), paddingTop: rp(theme.spacing.xxl), paddingBottom: rp(theme.spacing.xxxl), alignItems: "center", justifyContent: "center" }}>
              <View style={{ backgroundColor: accent, borderRadius: rp(theme.radius.pill), padding: rp(theme.spacing.lg), marginBottom: rp(theme.spacing.sm), shadowColor: accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}>
                <Ionicons name="car-sport" size={rs(32)} color={accentForeground} />
              </View>
              <Text style={{ color: accent, fontSize: rs(theme.fontSize.caption), fontWeight: "800", letterSpacing: rs(2), marginBottom: rp(theme.spacing.sm) }}>INSTAPARK</Text>

              <Heading level="display" style={{ color: "#fff", fontSize: rs(theme.fontSize.display + 8), fontWeight: "900", textAlign: "center", marginBottom: rp(theme.spacing.xs) }}>
                {firstLoginMode
                  ? "Activate Account"
                  : forgotMode
                    ? (forgotStep === 1 ? "Reset password" : forgotStep === 2 ? "Verify & reset" : "Welcome back")
                    : "Welcome back"}
              </Heading>

              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: rs(theme.fontSize.body), textAlign: "center" }}>
                {firstLoginMode
                  ? "Set up your credentials to continue"
                  : forgotMode
                    ? (forgotStep === 1 ? "Enter your registered mobile number and we'll send you a code." : forgotStep === 2 ? "Enter the OTP sent to your number and create a new password." : "Valet Management System")
                    : "Valet Management System"}
              </Text>
            </View>

            {/* Form Card */}
            <View style={{ backgroundColor: surface, borderRadius: rp(theme.radius.xl), marginHorizontal: rp(theme.spacing.xl), paddingHorizontal: rp(theme.spacing.xxxl), paddingTop: rp(theme.spacing.xxxl), paddingBottom: rp(40), shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>

              {/* Login Flow */}
              {!firstLoginMode && !forgotMode && loginStep === 1 && (
                <View>
                  <Text style={{ color: textSecondary, fontSize: rs(theme.fontSize.body), textAlign: "center", marginBottom: rp(theme.spacing.xl) }}>
                    Enter your mobile number to continue
                  </Text>
                  <Field
                    label="Mobile Number"
                    icon="call"
                    value={phone}
                    onChangeText={(t) => { setPhone(t); setError(""); }}
                    placeholder="10-digit mobile number"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  <ErrorBanner error={error} />
                  <PrimaryButton onPress={checkPhone} loading={loading} text="CONTINUE" />
                </View>
              )}

              {!firstLoginMode && !forgotMode && loginStep === 2 && (
                <View>
                  <Field
                    label="Mobile Number"
                    icon="call"
                    value={phone}
                    editable={false}
                    rightAccessory={
                      <TouchableOpacity onPress={() => { setLoginStep(1); setError(); setCredential(""); }}>
                        <Text style={{ color: primary, fontSize: rs(theme.fontSize.caption), fontWeight: "700", textTransform: 'uppercase' }}>Change</Text>
                      </TouchableOpacity>
                    }
                  />

                  <Field
                    label={accountRole === "driver" ? "PIN" : "Password"}
                    icon="lock-closed"
                    value={credential}
                    onChangeText={(t) => { setCredential(t); setError(""); }}
                    placeholder="••••••••"
                    secureTextEntry={!showPwd}
                    keyboardType={accountRole === "driver" ? "numeric" : "default"}
                    maxLength={accountRole === "driver" ? 4 : undefined}
                    rightAccessory={
                      <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
                        <Ionicons name={showPwd ? "eye-off" : "eye"} size={20} color={textMuted} />
                      </TouchableOpacity>
                    }
                  />

                  <TouchableOpacity onPress={() => { setForgotPhone(phone); setForgotMode(true); }} style={{ alignSelf: "flex-end", marginBottom: rp(theme.spacing.xl) }}>
                    <Text style={{ color: primary, fontSize: rs(theme.fontSize.body), fontWeight: "700" }}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <ErrorBanner error={error} />
                  <PrimaryButton onPress={submit} loading={loading} text="SIGN IN" />
                </View>
              )}

              {/* First Login (Activation) Flow */}
              {firstLoginMode && (
                <View>
                  <SuccessBanner success={firstLoginSuccess} />
                  
                  <Field
                    label="OTP (from email)"
                    icon="keypad"
                    value={firstLoginOtp}
                    onChangeText={setFirstLoginOtp}
                    placeholder="6-digit OTP"
                    keyboardType="numeric"
                  />
                  
                  <Field
                    label={accountRole === "driver" ? "New PIN" : "New Password"}
                    icon="lock-closed"
                    value={newCredential}
                    onChangeText={setNewCredential}
                    placeholder="••••••••"
                    secureTextEntry={!showPwd}
                    keyboardType={accountRole === "driver" ? "numeric" : "default"}
                    maxLength={accountRole === "driver" ? 4 : undefined}
                    rightAccessory={
                      <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
                        <Ionicons name={showPwd ? "eye-off" : "eye"} size={20} color={textMuted} />
                      </TouchableOpacity>
                    }
                  />

                  <Field
                    label={accountRole === "driver" ? "Confirm PIN" : "Confirm Password"}
                    icon="lock-closed"
                    value={confirmCredential}
                    onChangeText={setConfirmCredential}
                    placeholder="••••••••"
                    secureTextEntry={!showPwd}
                    keyboardType={accountRole === "driver" ? "numeric" : "default"}
                    maxLength={accountRole === "driver" ? 4 : undefined}
                  />

                  <ErrorBanner error={firstLoginError} />

                  <PrimaryButton onPress={submitFirstLogin} loading={firstLoginLoading} text="ACTIVATE & LOGIN" style={{ marginBottom: rp(theme.spacing.lg) }} />

                  <TouchableOpacity onPress={cancelFirstLogin} style={{ alignItems: "center", paddingVertical: rp(theme.spacing.sm) }}>
                    <Text style={{ color: textSecondary, fontSize: rs(theme.fontSize.body), fontWeight: "600" }}>Cancel / Change Number</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Forgot Password Flow */}
              {forgotMode && (
                <View>
                  {forgotStep === 1 && (
                    <View>
                      <Field
                        label="Mobile Number"
                        icon="call"
                        value={forgotPhone}
                        onChangeText={setForgotPhone}
                        placeholder="10-digit mobile number"
                        keyboardType="numeric"
                        maxLength={10}
                        editable={loginStep === 1}
                      />
                      <ErrorBanner error={forgotError} />
                      <PrimaryButton onPress={sendForgotOtp} loading={forgotLoading} text="SEND OTP" style={{ marginBottom: rp(theme.spacing.lg) }} />

                      <TouchableOpacity onPress={resetForgotFlow} style={{ alignItems: "center", paddingVertical: rp(theme.spacing.sm) }}>
                        <Text style={{ color: textSecondary, fontSize: rs(theme.fontSize.body), fontWeight: "600" }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {forgotStep === 2 && (
                    <View>
                      <SuccessBanner success={forgotSuccess} />
                      
                      <Field
                        label="OTP"
                        icon="keypad"
                        value={forgotOtp}
                        onChangeText={setForgotOtp}
                        placeholder="6-digit OTP"
                        keyboardType="numeric"
                      />

                      <Field
                        label="New Password / PIN"
                        icon="lock-closed"
                        value={forgotNewSecret}
                        onChangeText={setForgotNewSecret}
                        placeholder="••••••••"
                        secureTextEntry={!showPwd}
                        keyboardType={accountRole === "driver" ? "numeric" : "default"}
                        maxLength={accountRole === "driver" ? 4 : undefined}
                        rightAccessory={
                          <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
                            <Ionicons name={showPwd ? "eye-off" : "eye"} size={20} color={textMuted} />
                          </TouchableOpacity>
                        }
                      />

                      <Field
                        label="Confirm Password / PIN"
                        icon="lock-closed"
                        value={forgotConfirmSecret}
                        onChangeText={setForgotConfirmSecret}
                        placeholder="••••••••"
                        secureTextEntry={!showPwd}
                        keyboardType={accountRole === "driver" ? "numeric" : "default"}
                        maxLength={accountRole === "driver" ? 4 : undefined}
                      />

                      <ErrorBanner error={forgotError} />
                      
                      <PrimaryButton onPress={verifyForgotOtp} loading={forgotLoading} text="RESET CREDENTIALS" style={{ marginBottom: rp(theme.spacing.lg) }} />

                      <TouchableOpacity onPress={resetForgotFlow} style={{ alignItems: "center", paddingVertical: rp(theme.spacing.sm) }}>
                        <Text style={{ color: textSecondary, fontSize: rs(theme.fontSize.body), fontWeight: "600" }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {forgotStep === 3 && (
                    <View style={{ alignItems: "center", paddingVertical: rp(theme.spacing.xxxl) }}>
                      <View style={{ width: rp(64), height: rp(64), borderRadius: rp(32), backgroundColor: successLight, alignItems: "center", justifyContent: "center", marginBottom: rp(theme.spacing.lg) }}>
                        <Ionicons name="checkmark" size={rs(32)} color={success} />
                      </View>
                      <Heading level="title" style={{ color: textPrimary, marginBottom: rp(theme.spacing.sm) }}>Success</Heading>
                      <Text style={{ color: textSecondary, fontSize: rs(theme.fontSize.body), textAlign: "center", marginBottom: rp(theme.spacing.xxl) }}>{forgotSuccess}</Text>
                      <PrimaryButton onPress={resetForgotFlow} text="BACK TO LOGIN" style={{ width: '100%' }} />
                    </View>
                  )}
                </View>
              )}

            </View>
            </View>
            <Text style={{ 
              textAlign: "center", 
              color: "rgba(255,255,255,0.4)", 
              fontSize: rs(11), 
              marginTop: rp(theme.spacing.sm),
              marginBottom: rp(theme.spacing.xs)
            }}>
              v{Constants.expoConfig?.version || "1.0.0"}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
