import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  /**
   * iOS gets the platform's own tab bar metrics, which already account for the
   * home indicator. Android and web default to a 49pt bar that leaves about
   * five pixels under the label — enough to render, not enough to look
   * deliberate — so those two are sized explicitly.
   */
  const bar =
    Platform.OS === 'ios'
      ? {}
      : {
          // 50pt of content is what the stock bar gives an icon plus its label;
          // the padding is added on top of that, not carved out of it, or the
          // label gets squeezed to a one-pixel sliver.
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 10,
        };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...bar,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Documents',
          tabBarIcon: ({ color, size }) => (
            <Icon name="file-multiple-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Icon name="cog-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
