import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, TopBar, Card, Btn, StatusPill } from '../../../components/valet/ui';
import { theme } from '../../../utils/theme';
import { rs, rp } from '../../../utils/responsive';

export default function RetrievalSent() {
  const router = useRouter();
  const { plate, guest_name, guest_phone, car_id } = useLocalSearchParams();

  return (
    <Screen testID="retrieval-sent-screen">
      <TopBar title="Retrieval Sent" showBack={false} />
      
      <View style={styles.container}>
        {/* Success Indicator */}
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
          <Text style={styles.successTitle}>Retrieval Request Sent</Text>
        </View>

        {/* Details Card */}
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.plate}>{plate}</Text>
            <StatusPill label="Retrieval Requested" color={theme.colors.warning} />
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.detailText}>{(!guest_name || guest_name === 'null') ? "Unknown Guest" : guest_name}</Text>
          </View>

          <Text style={styles.bodyText}>
            Marked as requested by you (Supervisor scan).
          </Text>
        </Card>

        <View style={styles.actionsContainer}>
          <Btn 
            variant="accent" 
            onPress={() => router.replace("/(supervisor)/(tabs)/scan")} 
            style={styles.actionBtn}
          >
            Scan Another Card
          </Btn>

          <Btn 
            variant="outline" 
            onPress={() => router.replace("/(supervisor)/(tabs)/index")} 
            style={styles.actionBtn}
          >
            Done
          </Btn>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: rp(theme.spacing.xl),
    flex: 1,
  },
  successContainer: {
    alignItems: 'center',
    marginTop: rp(theme.spacing.xl),
    marginBottom: rp(theme.spacing.xxxl),
  },
  successTitle: {
    fontSize: rs(theme.fontSize.title),
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginTop: rp(theme.spacing.md),
  },
  card: {
    marginBottom: rp(theme.spacing.xxl),
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
    marginBottom: rp(theme.spacing.lg),
  },
  detailText: {
    fontSize: rs(theme.fontSize.bodyLarge),
    color: theme.colors.textPrimary,
    marginLeft: rp(theme.spacing.sm),
    flex: 1,
  },
  bodyText: {
    fontSize: rs(theme.fontSize.body),
    color: theme.colors.textSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: rp(theme.spacing.md),
  },
  actionsContainer: {
    marginTop: 'auto',
    gap: rp(theme.spacing.md),
  },
  actionBtn: {
    width: '100%',
  },
});
