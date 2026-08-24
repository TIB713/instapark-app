import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import NetInfo from "@react-native-community/netinfo";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected);
    });
    return () => unsub();
  }, []);

  if (!offline) return null;
  return (
    <View
      testID="offline-banner"
      className="bg-amber-500 py-2 px-4"
      style={{ width: "100%" }}
    >
      <Text className="text-white text-center font-bold text-xs">
        ⚠ OFFLINE — actions will sync when reconnected
      </Text>
    </View>
  );
}
