import { Stack } from "expo-router";
import { SupervisorProvider, useSupervisorContext } from "../../context/SupervisorContext";
import { Modal, View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../utils/theme";
import { rs, rp } from "../../utils/responsive";
import { fmtDateTime } from "../../utils/time";

function GlobalSOSModal() {
  const { sos } = useSupervisorContext();
  if (!sos) return null; // Context not ready or sos not initialized

  const { forcedSOSAlert, resolvingForcedSOS, resolveForcedSOS } = sos;

  return (
    <Modal visible={!!forcedSOSAlert} transparent={false} animationType="fade" onRequestClose={() => { }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.textPrimary, padding: rp(24) }}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View style={{ alignItems: "center", marginBottom: rp(32) }}>
            <Text style={{ fontSize: rs(64), marginBottom: rp(12) }}>🚨</Text>
            <Text style={{ fontSize: rs(28), fontWeight: "900", color: theme.colors.danger, textAlign: "center", letterSpacing: rs(2) }}>SOS EMERGENCY</Text>
          </View>

          <View style={{ backgroundColor: theme.colors.textPrimary, borderRadius: rp(24), padding: rp(24), borderWidth: rp(2), borderColor: theme.colors.danger }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(16), borderBottomWidth: rp(1), borderBottomColor: theme.colors.textSecondary, paddingBottom: rp(16) }}>
              <Text style={{ color: "#FCA5A5", fontSize: rs(16), fontWeight: "800" }}>{forcedSOSAlert?.alert_type?.replace(/_/g, " ")}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: rs(12), fontWeight: "600" }}>{fmtDateTime(forcedSOSAlert?.created_at)}</Text>
            </View>

            <View style={{ gap: rp(12), marginBottom: rp(24) }}>
              <Text style={{ color: theme.colors.border, fontSize: rs(16), fontWeight: "600" }}>Driver: <Text style={{ color: theme.colors.surface, fontWeight: "800" }}>{forcedSOSAlert?.driver_name}</Text></Text>
              {forcedSOSAlert?.car_number ? (
                <Text style={{ color: theme.colors.border, fontSize: rs(16), fontWeight: "600" }}>Car: <Text style={{ color: theme.colors.surface, fontWeight: "800" }}>{forcedSOSAlert?.car_number}</Text></Text>
              ) : null}
              {forcedSOSAlert?.note ? (
                <View style={{ backgroundColor: theme.colors.textSecondary, padding: rp(12), borderRadius: rp(12), marginTop: rp(8) }}>
                  <Text style={{ color: theme.colors.border, fontSize: rs(14) }}>{forcedSOSAlert.note}</Text>
                </View>
              ) : null}
            </View>

            {forcedSOSAlert?.photo_url ? (
              <Image
                source={{ uri: forcedSOSAlert.photo_url }}
                style={{ width: "100%", height: rp(250), borderRadius: rp(16), marginBottom: rp(24) }}
                resizeMode="cover"
              />
            ) : null}

            <TouchableOpacity
              disabled={resolvingForcedSOS}
              onPress={() => resolveForcedSOS(forcedSOSAlert.id)}
              style={{ backgroundColor: theme.colors.success, borderRadius: rp(16), paddingVertical: rp(18), alignItems: "center" }}
            >
              {resolvingForcedSOS ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={{ color: theme.colors.surface, fontWeight: "900", fontSize: rs(16), letterSpacing: rs(2) }}>MARK RESOLVED</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function SupervisorLayout() {
  return (
    <SupervisorProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <GlobalSOSModal />
    </SupervisorProvider>
  );
}
