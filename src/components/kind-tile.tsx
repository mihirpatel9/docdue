import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-theme';
import type { DocumentKind } from '@/db/types';
import { kindStyle } from '@/lib/kinds';

/**
 * The rounded glyph tile that identifies a document kind at a glance. The
 * scanning job on the home screen is "which of these is my passport", and a
 * shape plus a hue answers that faster than reading nine similar titles.
 */
export function KindTile({
  kind,
  size = 44,
  style,
}: {
  kind: DocumentKind;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scheme = useResolvedScheme();
  const { icon, fg, bg } = kindStyle(kind, scheme);

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg },
        style,
      ]}>
      <Icon name={icon} size={size * 0.5} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium },
});
