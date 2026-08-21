import { confirmDialog } from "../../lib/confirmDialog";
import { useState, useEffect } from "react";
import { rs, rp } from '../../utils/responsive';
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getFailedQueue, clearFailedItem } from "../../lib/offline";
import Heading from "../../components/Heading";

export default function FailedSyncs() {
  const router = useRouter();
  const [items, setItems] = useState([]);

  useEffect(() => {
    getFailedQueue().then(setItems);
  }, []);

  const dismiss = (idx) => {
    confirmDialog.destructiveConfirm("Dismiss", "Remove this failed item? The check-in will not be saved.", async () => {
          await clearFailedItem(idx);
          const updated = await getFailedQueue();
          setItems(updated);
        }, "Remove");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FEF2F2" }}>
      <View style={{ padding: rp(16), backgroundColor: "#B91C1C", flexDirection: "row", alignItems: "center", gap: rp(12) }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Heading level="subtitle" style={{ color: "#fff" }}>Failed Syncs ({items.length})</Heading>
      </View>
      <ScrollView style={{ padding: rp(16) }}>
        {items.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#6B7280", marginTop: rp(48) }}>No failed items 🎉</Text>
        ) : (
          items.map((item, idx) => (
            <View
              key={idx}
              style={{
                backgroundColor: "#fff",
                borderRadius: rp(16),
                padding: rp(16),
                marginBottom: rp(12),
                borderLeftWidth: rp(4),
                borderLeftColor: "#DC2626",
              }}
            >
              <Text style={{ fontWeight: "800", color: "#111827" }}>
                {item.type?.toUpperCase()} — {item.plate || item.carId}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(4) }}>
                Failed {item.retryCount} times · Last error: {item.lastError}
              </Text>
              <TouchableOpacity
                onPress={() => dismiss(idx)}
                style={{ marginTop: rp(12), backgroundColor: "#FEE2E2", padding: rp(8), borderRadius: rp(8), alignItems: "center" }}
              >
                <Text style={{ color: "#B91C1C", fontWeight: "700", fontSize: rs(12) }}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
