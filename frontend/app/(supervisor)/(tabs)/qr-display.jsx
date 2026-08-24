import { useRef } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Screen, TopBar, Btn } from "../../../components/valet/ui";
import { theme } from "../../../utils/theme";

export default function QRDisplayScreen() {
  const router = useRouter();
  const { carId, plate, checkinCode, token, returnTo, keyTagNumber } = useLocalSearchParams();
  const qrRef = useRef(null);

  const handleDone = () => {
    if (returnTo) {
      router.replace(returnTo);
    } else {
      router.replace("/(supervisor)/(tabs)/add-car");
    }
  };

  const guestUrl = `${process.env.EXPO_PUBLIC_GUEST_URL || "https://app.instapark.co"}/v/${token}`;

  return (
    <Screen>
      <TopBar title="Check-In Complete" onBack={handleDone} />
      
      <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
        <Text style={styles.plate}>{plate}</Text>
        
        {keyTagNumber ? (
          <Text style={styles.keyTag}>Key Tag #{keyTagNumber}</Text>
        ) : null}
        
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Check-In Code</Text>
          <Text style={styles.code}>{checkinCode}</Text>
        </View>

        {token !== "sync_pending" ? (
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View style={[styles.qrWrapper, { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }]}>
              <QRCode value={guestUrl} size={200} getRef={(c) => (qrRef.current = c)} />
            </View>
          </View>
        ) : (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.border} />
            <Text style={{ marginTop: 10, color: theme.colors.textLight, textAlign: 'center' }}>
              Checked in offline. QR codes will be available when connection is restored.
            </Text>
          </View>
        )}

        <View style={{ width: '100%', marginTop: 30, gap: 12 }}>
          <Btn onPress={handleDone}>
            <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>DONE</Text>
          </Btn>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plate: {
    fontSize: 40,
    color: theme.colors.textDark,
    marginBottom: 8,
    textAlign: "center",
  },
  keyTag: {
    fontSize: 24,
    color: theme.colors.primary,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  codeContainer: {
    alignItems: "center",
    backgroundColor: theme.colors.bgLight,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    marginBottom: 30,
    width: '100%',
  },
  codeLabel: {
    fontSize: 14,
    color: theme.colors.textLight,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  code: {
    fontSize: 48,
    color: theme.colors.primary,
    letterSpacing: 8,
  },
  qrRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: '100%',
    gap: 16,
  },
  qrBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  qrLabel: {
    fontSize: 14,
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  qrWrapper: {
    padding: 8,
    backgroundColor: "white",
  },
});
