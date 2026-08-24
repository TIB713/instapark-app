import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableWithoutFeedback } from 'react-native';
import { theme } from '../../utils/theme';
import { rs, rp } from '../../utils/responsive';
import { Btn } from './ui';
import { Ionicons } from '@expo/vector-icons';

export default function AlreadyCheckedInModal({ visible, plate, carType, onDismiss }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
      <View style={styles.contentContainer} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={rs(32)} color={theme.colors.warning} />
          </View>
          
          <Text style={styles.title}>Vehicle Already Checked In</Text>
          
          <View style={styles.plateContainer}>
            <Text style={styles.plateText}>{plate || 'UNKNOWN'}</Text>
          </View>
          
          {carType && (
            <Text style={styles.carType}>{carType.toUpperCase()}</Text>
          )}
          
          <Text style={styles.message}>
            This vehicle is already checked in.
          </Text>
          
          <Btn onPress={onDismiss} style={styles.button}>
            OK
          </Btn>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: rp(theme.spacing.lg),
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: rp(theme.spacing.xl),
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  iconContainer: {
    width: rp(64),
    height: rp(64),
    borderRadius: rp(32),
    backgroundColor: theme.colors.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rp(theme.spacing.lg),
  },
  title: {
    fontSize: rs(theme.fontSize.title),
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginBottom: rp(theme.spacing.md),
    textAlign: 'center',
  },
  plateContainer: {
    backgroundColor: theme.colors.background,
    paddingVertical: rp(theme.spacing.sm),
    paddingHorizontal: rp(theme.spacing.lg),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: rp(theme.spacing.sm),
  },
  plateText: {
    fontSize: rs(theme.fontSize.display),
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  carType: {
    fontSize: rs(theme.fontSize.body),
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
    marginBottom: rp(theme.spacing.md),
  },
  message: {
    fontSize: rs(theme.fontSize.bodyLarge),
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: rp(theme.spacing.xl),
  },
  button: {
    width: '100%',
  },
});
