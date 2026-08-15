import React, { useState } from 'react';
import { View, Text, Linking, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, TopBar, Card, Btn, StatusPill } from '../../../components/valet/ui';
import { theme } from '../../../utils/theme';
import { rs, rp } from '../../../utils/responsive';
import api from '../../../lib/api';
import { confirmDialog } from '../../../lib/confirmDialog';

const STATUS_CONFIG = {
  PARKED: { label: "Parked", color: theme.colors.success },
  RETRIEVAL_REQUESTED: { label: "Retrieval Requested", color: theme.colors.warning },
  BEING_FETCHED: { label: "Being Fetched", color: theme.colors.warning },
  DELIVERED: { label: "Delivered", color: theme.colors.info },
  AWAITING_REPARK: { label: "Awaiting Repark", color: theme.colors.danger },
};

export default function CarFound() {
  const router = useRouter();
  const { car_id, plate, guest_name, guest_phone, status } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);

  const config = STATUS_CONFIG[status] || { label: status, color: theme.colors.textMuted };

  const handleRequestRetrieval = () => {
    confirmDialog.confirm(
      "Request Retrieval",
      `Are you sure you want to request retrieval for ${plate}?`,
      async () => {
        try {
          setLoading(true);
          await api.patch(`/cars/${car_id}/request-retrieval`);
          router.replace({
            pathname: "/(supervisor)/(tabs)/retrieval-sent",
            params: {
              plate,
              guest_name,
              guest_phone,
              car_id,
            },
          });
        } catch (err) {
          const msg = err.response?.data?.detail || "Failed to request retrieval.";
          confirmDialog.info("Error", msg);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleCall = () => {
    if (guest_phone && guest_phone !== 'null') {
      Linking.openURL(`tel:${guest_phone}`);
    }
  };

  return (
    <Screen testID="car-found-screen">
      <TopBar title="Vehicle Found" />
      <View style={styles.container}>
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.plate}>{plate}</Text>
            <StatusPill label={config.label} color={config.color} />
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.detailText}>{(!guest_name || guest_name === 'null') ? "Unknown Guest" : guest_name}</Text>
          </View>

          {guest_phone && guest_phone !== 'null' ? (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={20} color={theme.colors.textSecondary} />
              <Text style={styles.detailText}>{guest_phone}</Text>
              <Btn variant="outline" onPress={handleCall} style={styles.callBtn}>
                Call Guest
              </Btn>
            </View>
          ) : null}
        </Card>
        <Btn variant="outline" onPress={() => router.push("/(supervisor)/(tabs)/car-log?plate=&car_id=")} style={{ marginBottom: rp(theme.spacing.lg) }}>
          View Full History
        </Btn>


        {status === "PARKED" && (
          <Btn 
            variant="accent" 
            onPress={handleRequestRetrieval} 
            loading={loading}
            style={styles.actionBtn}
          >
            Send Retrieval Request
          </Btn>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: rp(theme.spacing.xl),
    flex: 1,
  },
  card: {
    marginBottom: rp(theme.spacing.xl),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rp(theme.spacing.lg),
  },
  plate: {
    fontSize: rs(theme.fontSize.title),
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: rp(theme.spacing.md),
  },
  detailText: {
    fontSize: rs(theme.fontSize.bodyLarge),
    color: theme.colors.textPrimary,
    marginLeft: rp(theme.spacing.sm),
    flex: 1,
  },
  callBtn: {
    minWidth: 100,
    height: 36,
  },
  actionBtn: {
    marginTop: 'auto',
  },
});

