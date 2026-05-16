import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { colors } from '../../src/theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, IconName> = {
  dashboard: 'home-outline',
  pending: 'calendar-outline',
  transactions: 'swap-horizontal-outline',
  bets: 'football-outline',
  more: 'grid-outline',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name] ?? 'ellipse-outline'} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="pending" options={{ title: 'Pendientes' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="bets" options={{ title: 'Apuestas' }} />
      <Tabs.Screen name="more" options={{ title: 'Mas' }} />
    </Tabs>
  );
}
