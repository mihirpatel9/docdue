import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import type { DocumentKind } from '@/db/types';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * The visual identity of each document kind: one glyph and one hue, held in a
 * single place so the icon on a list row, a detail header and a filter chip can
 * never drift apart.
 *
 * Each kind carries an explicit light and dark pair rather than one colour used
 * on both. A hue that reads as confident on white goes muddy on near-black, and
 * a computed lightening produces something that is technically legible and
 * visibly cheap.
 */
type KindStyle = {
  icon: IconName;
  light: { fg: string; bg: string };
  dark: { fg: string; bg: string };
};

export const KIND_STYLES: Record<DocumentKind, KindStyle> = {
  passport: {
    icon: 'passport',
    light: { fg: '#1D4ED8', bg: '#E4EDFD' },
    dark: { fg: '#7DABFF', bg: '#152134' },
  },
  drivers_license: {
    icon: 'card-account-details-outline',
    light: { fg: '#0F766E', bg: '#DFF2F0' },
    dark: { fg: '#5ED3C7', bg: '#0F2523' },
  },
  vehicle_registration: {
    icon: 'car',
    light: { fg: '#B45309', bg: '#FBEEDC' },
    dark: { fg: '#F0B462', bg: '#2A1E0D' },
  },
  insurance: {
    icon: 'shield-check-outline',
    light: { fg: '#4338CA', bg: '#E7E6FB' },
    dark: { fg: '#A5A0FF', bg: '#1B1934' },
  },
  warranty: {
    icon: 'wrench-outline',
    light: { fg: '#9333EA', bg: '#F3E7FD' },
    dark: { fg: '#C79BF5', bg: '#241333' },
  },
  membership: {
    icon: 'card-account-details-star-outline',
    light: { fg: '#BE185D', bg: '#FBE4EE' },
    dark: { fg: '#F58DB8', bg: '#2E1220' },
  },
  visa: {
    icon: 'airplane-takeoff',
    light: { fg: '#0369A1', bg: '#DFEEF8' },
    dark: { fg: '#63BCEA', bg: '#0C2130' },
  },
  certification: {
    icon: 'certificate-outline',
    light: { fg: '#15803D', bg: '#E2F3E8' },
    dark: { fg: '#63D68C', bg: '#0F2418' },
  },
  other: {
    icon: 'file-document-outline',
    light: { fg: '#52616F', bg: '#EAEDF0' },
    dark: { fg: '#A3B0BC', bg: '#1E2429' },
  },
};

export function kindStyle(kind: DocumentKind, scheme: 'light' | 'dark') {
  const style = KIND_STYLES[kind] ?? KIND_STYLES.other;
  return { icon: style.icon, ...style[scheme] };
}
