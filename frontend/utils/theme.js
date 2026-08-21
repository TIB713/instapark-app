// InstaPark Design System — theme.js
// Single source of truth for colors, typography, spacing, and radius.
// Import this in every screen instead of hardcoding hex values or raw numbers.
//
// Usage:
//   import { theme } from '../../utils/theme';
//   <View style={{ backgroundColor: theme.colors.primary }}>
//   <Text style={{ fontSize: theme.fontSize.title }}>
//
// Works alongside the existing rs()/rp() responsive scaling helpers in
// utils/responsive.js — theme values are the *base* numbers, rs()/rp()
// scale them for screen size. Example:
//   fontSize: rs(theme.fontSize.body)

export const theme = {
  colors: {
    // ---- Brand (ONE primary color, used everywhere: headers, primary
    // buttons, active tab, active nav state, links). Do not introduce
    // blue/navy/green as a second "brand" color anywhere in the app.
    primary: '#3F0163',
    primaryDark: '#2A0042',       // was primaryDark, now serves as "pressed/soft" state
    primaryLight: '#F4E6FA',      // tinted background behind purple content

    accent: '#FCBF00',            // NEW — brand accent (yellow), used for primary CTA buttons
    accentLight: '#FFF7D9',       // NEW — tinted background behind accent content
    accentForeground: '#3F0163',  // NEW — text/icon color to use on top of accent backgrounds

    // ---- Status colors (meaning, not decoration — never use these as
    // branding, only to indicate a state)
    success: '#20A464',
    successLight: '#E3F6EC',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    danger: '#D64545',
    dangerLight: '#FBEAEA',
    info: '#0284C7',
    infoLight: '#E0F2FE',

    // ---- Neutrals (text, borders, surfaces)
    textPrimary: '#1A1025',
    textSecondary: '#6F6A78',
    textMuted: '#9CA3AF',
    border: '#E7E3EC',
    surface: '#FFFFFF',        // cards
    surfaceAlt: '#FAF7F2',     // page background
    overlay: 'rgba(24,21,29,0.5)', // modal/bottom-sheet backdrop
  },

  // Type scale — 6 sizes only. Every screen's fontSize must come from
  // this list. If a design needs something not on this list, that's a
  // sign to reconsider, not to add a new one-off number.
  fontSize: {
    caption: 12,   // helper text, timestamps, field labels
    body: 14,      // default body text, input values
    bodyLarge: 16, // list item titles, button labels
    subtitle: 18,  // section headers within a screen
    title: 20,     // screen titles in header
    display: 24,   // stat numbers, hero numbers
  },

  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    headline: 'SpaceGrotesk_700Bold',
  },

  // Spacing scale — use for margin/padding/gap. Multiples of 4.
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // Corner radius
  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    pill: 999,
  },

  // Reusable component style rules (reference, not literal RN style
  // objects — apply these values inside each screen's StyleSheet).
  components: {
    primaryButton: {
      backgroundColor: 'colors.primary',
      textColor: '#FFFFFF',
      radius: 'radius.md',
      height: 52,
    },
    destructiveAction: {
      // THE single destructive-action pattern for the whole app.
      // Confirmed 3 competing variants exist today: pink-filled
      // (driver/supervisor Deactivate/Delete — this is the one to
      // keep), red-outline ("Unassign" on supervisor employee screen),
      // and plain red text. Converge everything on this pink-filled
      // version. (Note: icon-loading bug previously seen on timeline
      // screens was unrelated leftover code, already fixed — not a
      // theme/styling concern.)
      backgroundColor: 'colors.dangerLight',
      textColor: 'colors.danger',
      radius: 'radius.md',
    },
    card: {
      backgroundColor: 'colors.surface',
      radius: 'radius.md',
      padding: 'spacing.lg',
      border: 'none', // use elevation via background contrast, not shadows
    },
    statCard: {
      // Single stat-card style — replaces both the "colored left border"
      // style and the "pastel icon circle" style currently mixed in the
      // app. Pick ONE (icon-circle recommended, see chat mockup).
      backgroundColor: 'colors.surface',
      radius: 'radius.md',
      padding: 'spacing.lg',
      iconBackground: 'colors.primaryLight',
    },
    bottomSheet: {
      // ALL "add new record" actions use this pattern. No full-page
      // "Add X" screens (Add Hotel must be converted to match).
      radius: 'radius.lg', // top corners only
      backgroundColor: 'colors.surface',
    },
    emptyState: {
      iconSize: 48,
      titleSize: 'fontSize.bodyLarge',
      bodySize: 'fontSize.body',
      bodyColor: 'colors.textSecondary',
    },
  },
};
