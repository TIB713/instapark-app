import { useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Print from "expo-print";
import { Screen, TopBar, Btn } from "../../../components/valet/ui";
import { theme } from "../../../utils/theme";

export default function QRDisplayScreen() {
  const router = useRouter();
  const { carId, plate, checkinCode, token, returnTo } = useLocalSearchParams();
  const qrRef = useRef(null);
  const [printing, setPrinting] = useState(false);

  const handleDone = () => {
    if (returnTo) {
      router.replace(returnTo);
    } else {
      router.replace("/(supervisor)/(tabs)/add-car");
    }
  };

  const handlePrint = async () => {
    if (!token || token === "sync_pending" || printing) {
      if (token === "sync_pending") alert("Cannot print while offline sync is pending.");
      return;
    }
    setPrinting(true);

    const guestUrl = `${process.env.EXPO_PUBLIC_GUEST_URL || "https://app.instapark.co"}/v/${token}`;
    
    // We render the QR code URL dynamically using an external API for the HTML print out.
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(guestUrl)}&margin=1`;

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center; margin: 0; padding: 20px; color: #3F0163; }
            .plate { font-size: 48px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #E2E8F0; padding-bottom: 10px; }
            .code-title { font-size: 16px; color: #64748B; text-transform: uppercase; margin-top: 20px; }
            .code { font-size: 64px; font-weight: bold; letter-spacing: 10px; margin: 10px 0 30px; }
            .qr-container { display: flex; justify-content: center; margin-top: 20px; }
            .qr-box { text-align: center; }
            .qr-label { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
            img { width: 260px; height: 260px; }
            .footer { margin-top: 40px; font-size: 14px; color: #94A3B8; }
          </style>
        </head>
        <body>
          <div class="plate">${plate}</div>
          <div class="code-title">Check-In Code</div>
          <div class="code">${checkinCode}</div>
          
          <div class="qr-container">
            <img src="${qrImageUrl}" />
          </div>
          
          <div class="footer">Scan to retrieve your vehicle</div>
        </body>
      </html>
    `;

    try {
      await Print.printAsync({ html });
    } catch (err) {
      console.error("Print failed", err);
    } finally {
      setPrinting(false);
    }
  };

  const guestUrl = `${process.env.EXPO_PUBLIC_GUEST_URL || "https://app.instapark.co"}/v/${token}`;

  return (
    <Screen>
      <TopBar title="Check-In Complete" onBack={handleDone} />
      
      <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
        <Text style={styles.plate}>{plate}</Text>
        
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
          <Btn onPress={handlePrint} disabled={token === "sync_pending" || printing}>
            {printing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="print-outline" size={20} color="#FFFFFF" />
            )}
            <Text style={{ color: "#FFFFFF", fontWeight: "800", marginLeft: 8 }}>
              {printing ? "PRINTING..." : "PRINT SLIP"}
            </Text>
          </Btn>
          <Btn variant="secondary" onPress={handleDone}>
            <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>DONE</Text>
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
