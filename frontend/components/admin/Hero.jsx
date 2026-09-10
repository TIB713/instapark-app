import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../utils/theme';
import { rs, rp } from '../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Hero({
  eyebrow,
  title,
  badges = [], 
  rightAction, 
  onBack,
  stats = [], 
  align = 'left',
  children
}) {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.heroContainer, { paddingTop: insets.top + rp(theme.spacing.lg) }]}>

      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={rs(20)} color={theme.colors.primaryLight} />
          </TouchableOpacity>
        ) : null}

        <View style={[styles.textBlock, align === 'center' && { alignItems: 'center' }]}>
          {eyebrow && <Text style={[styles.eyebrow, align === 'center' && { textAlign: 'center' }]}>{eyebrow}</Text>}
          <Text style={[styles.title, align === 'center' && { textAlign: 'center' }]} numberOfLines={1}>{title}</Text>

          {badges.length > 0 && (
            <View style={[styles.badgeRow, align === 'center' && { justifyContent: 'center', marginTop: rp(4) }]}>
              {badges.map((b, i) => (
                <View key={i} style={[styles.badge, { backgroundColor: b.tone === 'primary' ? theme.colors.primaryLight : theme.colors.warningLight }]}>
                  <Text style={[styles.badgeText, { color: b.tone === 'primary' ? theme.colors.primary : theme.colors.warning }]}>{b.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {rightAction && (
          <TouchableOpacity onPress={rightAction.onPress} style={[styles.rightBtn, rightAction.tone === 'accent' && { backgroundColor: theme.colors.accent }]} activeOpacity={0.7}>
            {rightAction.icon && <Ionicons name={rightAction.icon} size={rs(20)} color={theme.colors.primary} />}
            {rightAction.text && <Text style={[styles.rightBtnText, rightAction.tone === 'accent' && { color: theme.colors.primary }]}>{rightAction.text}</Text>}
          </TouchableOpacity>
        )}
      </View>

      {stats.length > 0 && (
        <View style={styles.statsRow}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statBox}>
              <Text style={styles.statValue} numberOfLines={1}>{s.value !== null ? s.value : '—'}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
      
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: rp(32),
    borderBottomRightRadius: rp(32),
    paddingBottom: rp(theme.spacing.xxl),
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: rp(theme.spacing.xl),
    gap: rp(theme.spacing.sm),
    marginBottom: rp(theme.spacing.xl),
  },
  textBlock: {
    flex: 1,
  },
  backBtn: {
    width: rp(40),
    height: rp(40),
    borderRadius: rp(12),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  rightBtn: {
    width: rp(40),
    height: rp(40),
    borderRadius: rp(12),
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  rightBtnText: {
    color: theme.colors.primary,
    fontSize: rs(theme.fontSize.bodyLarge),
    fontWeight: theme.fontWeight.bold,
    fontFamily: theme.fontFamily.bold,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: rs(theme.fontSize.caption),
    fontWeight: theme.fontWeight.bold,
    fontFamily: theme.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: rp(4),
  },
  title: {
    color: '#FFFFFF',
    fontSize: rs(32),
    fontWeight: theme.fontWeight.bold,
    fontFamily: theme.fontFamily.headline,
    letterSpacing: -0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: rp(theme.spacing.sm),
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: rp(10),
    paddingVertical: rp(4),
    borderRadius: rp(theme.radius.pill),
  },
  badgeText: {
    fontSize: rs(10),
    fontWeight: theme.fontWeight.bold,
    fontFamily: theme.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: rp(theme.spacing.xl),
    gap: rp(theme.spacing.sm),
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: rp(theme.radius.md),
    paddingVertical: rp(theme.spacing.md),
    paddingHorizontal: rp(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: rs(theme.fontSize.display),
    fontWeight: theme.fontWeight.bold,
    fontFamily: theme.fontFamily.bold,
    marginBottom: rp(2),
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: rs(9),
    fontWeight: theme.fontWeight.bold,
    fontFamily: theme.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
