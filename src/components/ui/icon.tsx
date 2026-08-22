import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';

import type { IconName } from '@/lib/kinds';

export type { IconName };

/**
 * One icon family across the whole app. Mixing sets is the fastest way to make
 * an interface look assembled rather than designed — the stroke weights never
 * quite match.
 */
export function Icon({
  name,
  size = 20,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}
