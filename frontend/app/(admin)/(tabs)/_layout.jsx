import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

export default function AdminTabsLayout() {
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
      {/* Visible Tabs */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "grid" : "grid-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="hotels"
        options={{
          title: "Hotels",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "business" : "business-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="all-events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage-employees"
        options={{
          title: "Team",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={24} color={color} />
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

      {/* Hidden Screens */}
      <Tabs.Screen name="add-driver" options={{ href: null, title: "Add Driver" }} />
      <Tabs.Screen name="edit-driver" options={{ href: null, title: "Edit Driver" }} />
      <Tabs.Screen name="add-supervisor" options={{ href: null, title: "Add Supervisor" }} />
      <Tabs.Screen name="edit-supervisor" options={{ href: null, title: "Edit Supervisor" }} />
      <Tabs.Screen name="bulk-add-driver" options={{ href: null, title: "Bulk Add Drivers" }} />
      <Tabs.Screen name="car-log" options={{ href: null, title: "Car Log" }} />
      <Tabs.Screen name="create-event" options={{ href: null, title: "Create Event" }} />
      <Tabs.Screen name="edit-event" options={{ href: null, title: "Edit Event" }} />
      <Tabs.Screen name="event-detail" options={{ href: null, title: "Event Detail" }} />
      <Tabs.Screen name="hotel-detail" options={{ href: null, title: "Hotel Detail" }} />
      <Tabs.Screen name="driver-stats" options={{ href: null, title: "Driver Stats" }} />
      <Tabs.Screen name="driver-event-cars" options={{ href: null, title: "Driver Cars" }} />
      <Tabs.Screen name="pre-register-qr" options={{ href: null, title: "QR Codes" }} />
      <Tabs.Screen name="qr-display" options={{ href: null, title: "QR Display" }} />
      <Tabs.Screen name="supervisor-detail" options={{ href: null, title: "Supervisor Detail" }} />
    </Tabs>
  );
}
