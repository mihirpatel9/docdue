import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The whole type scale, named by role rather than by size. A screen asks for a
 * `heading`, never for 22px — which is what stops the app from accumulating
 * nineteen slightly different headings.
 */
export type TextType =
  | 'display'
  | 'title'
  | 'subtitle'
  | 'heading'
  | 'default'
  | 'small'
  | 'smallBold'
  | 'label'
  | 'caption'
  | 'link'
  | 'linkPrimary'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />
  );
}

const styles = StyleSheet.create<Record<TextType, TextStyle>>({
  display: { fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '600', letterSpacing: -0.2 },
  default: { fontSize: 16, lineHeight: 23, fontWeight: '500' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  /**
   * Section captions and field labels. Uppercase with generous tracking, which
   * is the one place small caps earn their keep: it reads as structure rather
   * than as shouting.
   */
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  link: { fontSize: 14, lineHeight: 30 },
  linkPrimary: { fontSize: 14, lineHeight: 30, color: '#3c87f7' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 13,
  },
});
