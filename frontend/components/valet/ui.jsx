import React from 'react';
import { View, Text, TouchableOpacity, Modal as RNModal, StyleSheet, TouchableWithoutFeedback, Platform, Animated, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../utils/theme';
import { rs, rp } from '../../utils/responsive';

export function Btn({ variant = 'primary', disabled = false, onPress, children, style }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  let bgColor = theme.colors.primary;
  let textColor = '#FFFFFF';
  let borderColor = 'transparent';

  switch (variant) {
    case 'accent':
      bgColor = theme.colors.accent;
      textColor = theme.colors.accentForeground;
      break;
    case 'dark':
      bgColor = theme.colors.textPrimary;
      break;
    case 'outline':
      bgColor = 'transparent';
      textColor = theme.colors.primary;
      borderColor = theme.colors.primary;
      break;
    case 'ghost':
      bgColor = 'transparent';
      textColor = theme.colors.primary;
      break;
    case 'danger':
      bgColor = theme.colors.dangerLight;
      textColor = theme.colors.danger;
      break;
    case 'secondary':
      bgColor = theme.colors.primaryLight;
      textColor = theme.colors.primary;
      break;
    case 'success':
      bgColor = theme.colors.success;
      break;
    case 'primary':
    default:
      bgColor = theme.colors.primary;
      break;
  }

  if (disabled) {
    bgColor = theme.colors.textMuted;
    textColor = '#FFFFFF';
    borderColor = 'transparent';
  }

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
      onPress={onPress}
      style={style}
    >
      <Animated.View
        style={[
          styles.btn,
          { backgroundColor: bgColor, borderColor, borderWidth: variant === 'outline' && !disabled ? 1 : 0, transform: [{ scale }] },
          style,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          {React.Children.map(children, child => {
            if (typeof child === 'string' || typeof child === 'number') {
              return <Text style={[styles.btnText, { color: textColor }]}>{child}</Text>;
            }
            return child;
          })}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function Card({ children, style, onPress }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  if (onPress) {
    return (
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
        onPress={onPress}
      >
        <Animated.View style={[styles.card, style, { transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function TopBar({ eyebrow, title, subtitle, onBack, rightNode, style, children, align = "center" }) {
  return (
    <View style={[styles.topBar, style]}>
      <SafeAreaView edges={['top']} />
      <View style={styles.topBarContent}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.topBarBack}>
            <Ionicons name="arrow-back" size={rs(24)} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBarBack} />
        )}
        <View style={[styles.topBarCenter, align === "left" && { alignItems: "flex-start" }]}>
          {eyebrow ? <Text style={[styles.topBarEyebrow, align === "left" && { textAlign: "left" }]}>{eyebrow}</Text> : null}
          <Text style={[styles.topBarTitle, align === "left" && { textAlign: "left" }]} numberOfLines={1}>{title}</Text>
          {subtitle ? (typeof subtitle === 'string' ? <Text style={[styles.topBarSubtitle, align === "left" && { textAlign: "left" }]} numberOfLines={1}>{subtitle}</Text> : subtitle) : null}
        </View>
        <View style={styles.topBarRight}>
          {rightNode}
        </View>
      </View>
      {children && <View style={styles.topBarChildren}>{children}</View>}
    </View>
  );
}

export function Sheet({ open, onClose, children }) {
  return (
    <RNModal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.sheetOverlay} />
      </TouchableWithoutFeedback>
      <View style={styles.sheetContent}>
        <View style={styles.sheetHandleContainer}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity
            onPress={onClose}
            style={styles.sheetCloseButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </RNModal>
  );
}

export function StatusPill({ label, tone = 'primary', style, icon }) {
  let bgColor = theme.colors.primaryLight;
  let textColor = theme.colors.primary;

  switch (tone) {
    case 'accent':
      bgColor = theme.colors.accentLight;
      textColor = theme.colors.accentForeground;
      break;
    case 'success':
      bgColor = theme.colors.successLight;
      textColor = theme.colors.success;
      break;
    case 'danger':
      bgColor = theme.colors.dangerLight;
      textColor = theme.colors.danger;
      break;
    case 'warning':
      bgColor = theme.colors.warningLight;
      textColor = theme.colors.warning;
      break;
    case 'neutral':
      bgColor = theme.colors.surfaceAlt;
      textColor = theme.colors.textSecondary;
      break;
    case 'onDark':
      bgColor = 'rgba(255,255,255,0.15)';
      textColor = '#FFFFFF';
      break;
    case 'primary':
    default:
      bgColor = theme.colors.primaryLight;
      textColor = theme.colors.primary;
      break;
  }

  return (
    <View style={[styles.statusPill, { backgroundColor: bgColor }, style]}>
      {icon && <Ionicons name={icon} size={12} color={textColor} style={{ marginRight: 4 }} />}
      <Text style={[styles.statusPillText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function Plate({ value, style }) {
  return (
    <View style={[styles.plate, style]}>
      <Text style={styles.plateText}>{value}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, cta, style }) {
  return (
    <View style={[styles.emptyState, style]}>
      {icon && (
        <View style={styles.emptyStateIcon}>
          {icon}
        </View>
      )}
      <Text style={styles.emptyStateTitle}>{title}</Text>
      {body ? <Text style={styles.emptyStateBody}>{body}</Text> : null}
      {cta && <View style={styles.emptyStateCta}>{cta}</View>}
    </View>
  );
}

export function ProgressBar({ value = 0, label, style }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.progressBarContainer, style]}>
      {label && <Text style={styles.progressBarLabel}>{label}</Text>}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${clamped}%` }]} />
      </View>
    </View>
  );
}

function useSafeTabBarHeight() {
  try {
    return useBottomTabBarHeight();
  } catch {
    return 0;
  }
}

export function Screen({ children, scroll = true, style }) {
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.screen, style]}>
      <Wrapper style={styles.screenWrapper} contentContainerStyle={scroll ? styles.screenContent : undefined}>
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <View style={styles.sectionTitleContainer}>
      <Text style={styles.sectionTitleText}>{children}</Text>
      {action && <View>{action}</View>}
    </View>
  );
}

export function Modal({ open, onClose, title, children }) {
  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay} />
      </TouchableWithoutFeedback>
      <View style={styles.modalContentContainer} pointerEvents="box-none">
        <View style={styles.modalContent}>
          {title && <Text style={styles.modalTitle}>{title}</Text>}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

export function Chip({ label, active, onPress, style, textStyle }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive, style]}
    >
      <Text
        numberOfLines={1}
        style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive, textStyle]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    minHeight: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rp(theme.spacing.lg),
  },
  btnText: {
    fontSize: rs(theme.fontSize.bodyLarge),
    fontWeight: theme.fontWeight.semibold,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: rp(theme.spacing.lg),
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  topBar: {
    backgroundColor: theme.colors.primary,
    paddingBottom: rp(theme.spacing.xl),
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: rp(44),
    paddingHorizontal: rp(theme.spacing.md),
    paddingTop: rp(theme.spacing.sm),
  },
  topBarBack: {
    width: rp(40),
    height: rp(40),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarEyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: rs(theme.fontSize.caption),
    fontWeight: theme.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: rp(4),
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: rs(theme.fontSize.subtitle),
    fontWeight: theme.fontWeight.semibold,
  },
  topBarSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: rs(theme.fontSize.caption),
    marginTop: rp(4),
  },
  topBarRight: {
    width: rp(40),
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topBarChildren: {
    paddingHorizontal: rp(theme.spacing.lg),
    paddingTop: rp(theme.spacing.md),
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  sheetContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingBottom: rp(theme.spacing.xxxl), // safe area buffer
    maxHeight: '90%',
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingVertical: rp(theme.spacing.md),
    position: 'relative',
  },
  sheetHandle: {
    width: rp(40),
    height: rp(4),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
  },
  sheetCloseButton: {
    position: 'absolute',
    right: rp(theme.spacing.md),
    top: rp(theme.spacing.sm),
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: rp(theme.spacing.sm),
    paddingVertical: rp(theme.spacing.xs),
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPillText: {
    fontSize: rs(theme.fontSize.caption),
    fontWeight: theme.fontWeight.semibold,
  },
  plate: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingHorizontal: rp(theme.spacing.sm),
    paddingVertical: rp(theme.spacing.xs),
    borderRadius: theme.radius.sm,
  },
  plateText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: rs(theme.fontSize.body),
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: rp(theme.spacing.xl),
  },
  emptyStateIcon: {
    marginBottom: rp(theme.spacing.md),
  },
  emptyStateTitle: {
    fontSize: rs(theme.fontSize.bodyLarge),
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: rp(theme.spacing.xs),
  },
  emptyStateBody: {
    fontSize: rs(theme.fontSize.body),
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: rp(theme.spacing.lg),
  },
  emptyStateCta: {
    width: '100%',
  },
  progressBarContainer: {
    width: '100%',
  },
  progressBarLabel: {
    fontSize: rs(theme.fontSize.caption),
    color: theme.colors.textSecondary,
    marginBottom: rp(theme.spacing.xs),
  },
  progressBarTrack: {
    height: rp(8),
    backgroundColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
  },
  screen: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  screenWrapper: {
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: rp(theme.spacing.md),
  },
  sectionTitleText: {
    fontSize: rs(theme.fontSize.caption),
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  modalContentContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: rp(theme.spacing.xl),
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: rp(theme.spacing.xl),
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  modalTitle: {
    fontSize: rs(theme.fontSize.subtitle),
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginBottom: rp(theme.spacing.md),
  },
  chip: {
    paddingHorizontal: rp(theme.spacing.lg),
    paddingVertical: rp(theme.spacing.sm),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    marginRight: rp(theme.spacing.sm),
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipInactive: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  chipText: {
    fontSize: rs(theme.fontSize.body),
    fontWeight: theme.fontWeight.medium,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: theme.colors.textSecondary,
  },
});
