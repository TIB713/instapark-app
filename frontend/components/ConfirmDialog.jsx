import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { theme } from '../utils/theme';

// react-native-safe-area-context does not always report correct insets for
// content rendered inside a <Modal> on Android — the Modal opens in its own
// native window, separate from the Activity's main window, and insets.bottom
// can come back as 0 even when a nav bar is actually covering that area.
// Rather than depend on insets alone, we also reserve a fixed minimum on
// Android so the buttons are guaranteed to clear the nav bar either way.
const ANDROID_MIN_BOTTOM_RESERVE = 32;

export default function ConfirmDialog({
  visible,
  title,
  message,
  variant = 'info',
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel = 'Cancel',
}) {
  const insets = useSafeAreaInsets();
  const bottomReserve = Platform.OS === 'android'
    ? Math.max(insets?.bottom || 0, ANDROID_MIN_BOTTOM_RESERVE)
    : (insets?.bottom || 0);

  const getConfirmLabel = () => {
    if (confirmLabel) return confirmLabel;
    return variant === 'info' ? 'OK' : 'Confirm';
  };

  const renderButtons = () => {
    if (variant === 'info') {
      return (
        <TouchableOpacity style={styles.primaryButton} onPress={onConfirm} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>{getConfirmLabel()}</Text>
        </TouchableOpacity>
      );
    }

    if (variant === 'destructive') {
      return (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.ghostButton} onPress={onCancel} activeOpacity={0.8}>
            <Text style={styles.ghostButtonText}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.destructiveButton} onPress={onConfirm} activeOpacity={0.8}>
            <Text style={styles.destructiveButtonText}>{getConfirmLabel()}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // confirm
    return (
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.ghostButton} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.ghostButtonText}>{cancelLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={onConfirm} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>{getConfirmLabel()}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: theme.spacing.xxl + bottomReserve }]}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.buttonContainer}>
            {renderButtons()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.xxl,
  },
  title: {
    fontSize: theme.fontSize.subtitle,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  message: {
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  buttonContainer: {
    marginTop: theme.spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  primaryButton: {
    flex: 1,
    height: 52, // from theme.components.primaryButton.height
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: theme.fontSize.bodyLarge,
    fontWeight: theme.fontWeight.semibold,
  },
  ghostButton: {
    flex: 1,
    height: 52,
    backgroundColor: 'transparent',
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.bodyLarge,
    fontWeight: theme.fontWeight.semibold,
  },
  destructiveButton: {
    flex: 1,
    height: 52,
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveButtonText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.bodyLarge,
    fontWeight: theme.fontWeight.semibold,
  },
});
