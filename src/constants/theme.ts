/**
 * The app's design tokens. Everything visual resolves through here — screens
 * and components never hardcode a hex value, so light and dark stay in step and
 * a palette change is one edit rather than a search-and-replace.
 *
 * Colors are semantic (`danger`, `border`, `onTint`) rather than literal
 * (`red`, `grey200`). A literal name is a lie the moment dark mode inverts it.
 */

import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#5A6772',
    textTertiary: '#8B95A1',

    background: '#F6F7F9',
    backgroundElevated: '#FFFFFF',
    backgroundElement: '#EFF1F4',
    backgroundSelected: '#DFE3E8',

    border: '#E3E7EC',
    borderStrong: '#CBD2DA',

    /** Brand. Matches the splash screen so launch and first frame agree. */
    tint: '#0A6FD8',
    tintSurface: '#E6F0FC',
    onTint: '#FFFFFF',

    danger: '#C2261C',
    dangerSurface: '#FDECEA',
    warning: '#B24A04',
    warningSurface: '#FDEFE3',
    caution: '#8A6100',
    cautionSurface: '#FBF3DE',
    success: '#15803D',
    successSurface: '#E7F6EC',

    overlay: 'rgba(9, 15, 22, 0.45)',
    shadow: '#0B1620',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#9BA5B0',
    textTertiary: '#6C7783',

    background: '#0C0F12',
    backgroundElevated: '#15191D',
    backgroundElement: '#1D2226',
    backgroundSelected: '#2A3137',

    border: '#252B31',
    borderStrong: '#39424A',

    tint: '#4D9BFF',
    tintSurface: '#122436',
    onTint: '#04121F',

    danger: '#FF6B5E',
    dangerSurface: '#2C1512',
    warning: '#FF9448',
    warningSurface: '#2B1A0C',
    caution: '#E5B84B',
    cautionSurface: '#2A2210',
    success: '#4ADE80',
    successSurface: '#0F2418',

    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = Record<ThemeColor, string>;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** One radius scale, so a card and the button inside it visibly agree. */
export const Radius = {
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 22,
  pill: 999,
} as const;

/**
 * Elevation as a token rather than per-component shadow props.
 *
 * Three renderers, three vocabularies: Android reads `elevation` and ignores
 * the rest, iOS reads the shadow quadruple, and react-native-web now warns that
 * `shadow*` is deprecated in favour of CSS `boxShadow`. One helper keeps that
 * split in a single place instead of in every card.
 */
function elevation(opacity: number, blur: number, offsetY: number, android: number): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${offsetY}px ${blur}px rgba(11, 22, 32, ${opacity})` },
    default: {
      shadowColor: '#0B1620',
      shadowOpacity: opacity,
      shadowRadius: blur,
      shadowOffset: { width: 0, height: offsetY },
      elevation: android,
    },
  }) as ViewStyle;
}

export const Elevation = {
  card: elevation(0.06, 10, 3, 2),
  raised: elevation(0.16, 18, 8, 8),
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
