import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getFailedQueue, clearFailedItem } from "../../lib/offline";

export default function FailedSyncs() {
  const router = useRouter();
  const [items, setItems] = useState([]);

  useEffect(() => {
    getFailedQueue().then(setItems);
  }, []);

  const dismiss = (idx) => {
    Alert.alert("Dismiss", "Remove this failed item? The check-in will not be saved.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await clearFailedItem(idx);
          const updated = await getFailedQueue();
          setItems(updated);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FEF2F2" }}>
      <View style={{ padding: 16, backgroundColor: "#B91C1C", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>Failed Syncs ({items.length})</Text>
      </View>
      <ScrollView style={{ padding: 16 }}>
        {items.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#6B7280", marginTop: 48 }}>No failed items 🎉</Text>
        ) : (
          items.map((item, idx) => (
            <View
              key={idx}
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderLeftWidth: 4,
                borderLeftColor: "#DC2626",
              }}
            >
              <Text style={{ fontWeight: "800", color: "#111827" }}>
                {item.type?.toUpperCase()} — {item.plate || item.carId}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
                Failed {item.retryCount} times · Last error: {item.lastError}
              </Text>
              <TouchableOpacity
                onPress={() => dismiss(idx)}
                style={{ marginTop: 12, backgroundColor: "#FEE2E2", padding: 8, borderRadius: 8, alignItems: "center" }}
              >
                <Text style={{ color: "#B91C1C", fontWeight: "700", fontSize: 12 }}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
