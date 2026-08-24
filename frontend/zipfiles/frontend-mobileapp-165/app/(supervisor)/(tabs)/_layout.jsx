import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

export default function SupervisorTabsLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.primary,
          borderTopWidth: 0,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 0 : 10),
          paddingTop: 10,
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          position: 'absolute',
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
      }}
    >
      <Tabs.Screen
        name="event-detail"
        options={{
          href: null,
          title: "Event Details"
        }}
      />
      <Tabs.Screen
        name="add-car"
        options={{
          href: null,
          title: "Add Car"
        }}
      />
      <Tabs.Screen
        name="car-log"
        options={{
          href: null,
          title: "Car Log"
        }}
      />
      <Tabs.Screen
        name="qr-display"
        options={{
          href: null,
          title: "QR Display"
        }}
      />
      <Tabs.Screen name="car-found" options={{ href: null }} />
      <Tabs.Screen name="retrieval-sent" options={{ href: null }} />
      <Tabs.Screen name="driver-new" options={{ href: null }} />
      <Tabs.Screen name="driver-edit" options={{ href: null }} />
      <Tabs.Screen name="driver-stats" options={{ href: null, title: "Driver Profile" }} />
      <Tabs.Screen name="driver-bulk" options={{ href: null }} />
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "grid" : "grid-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: "Team",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "qr-code" : "qr-code-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "shield-checkmark" : "shield-checkmark-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
