import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteItem as secureDelete } from '../../../lib/secure';
import { useAppStore } from '../../../lib/store';
import { theme } from '../../../utils/theme';
import { Card, Btn, Screen, TopBar, StatusPill } from '../../../components/valet/ui';
import { rs, rp } from '../../../utils/responsive';
import { useSupervisorEvents } from '../../../hooks/useSupervisorEvents';
import { useEmployeeManagement } from '../../../hooks/useEmployeeManagement';

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAppStore();
  
  const { events, fetchAll: fetchEvents, loading: eventsLoading } = useSupervisorEvents();
  const { drivers, fetchAll: fetchDrivers, loading: driversLoading } = useEmployeeManagement();

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
      fetchDrivers();
    }, [fetchEvents, fetchDrivers])
  );

  const handleSignOut = async () => {
    try {
      await useAppStore.getState().signOut();
      router.replace('/(auth)/login');
    } catch (e) {
      console.log('logout err', e);
    }
  };

  const activeEventsCount = events.filter(e => e.status === "active").length;
  const isLoading = eventsLoading || driversLoading;

  return (
    <Screen testID="profile-screen" scroll={true}>
      <TopBar 
        eyebrow="ACCOUNT"
        title={user?.name || "Supervisor"} 
        subtitle={<StatusPill label={user?.role || "SUPERVISOR"} tone="accent" style={{ alignSelf: 'center', marginTop: rp(4) }} />}
        showBack={false}
      >
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: theme.radius.lg,
          padding: rp(theme.spacing.md),
          marginTop: rp(theme.spacing.sm),
        }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: rs(18), fontWeight: '900', color: '#FFFFFF' }}>{events.length}</Text>
            )}
            <Text style={{ fontSize: rs(10), color: 'rgba(255,255,255,0.7)', marginTop: rp(4), fontWeight: '700', textTransform: 'uppercase' }}>Events</Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)', height: '100%' }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: rs(18), fontWeight: '900', color: theme.colors.success }}>{activeEventsCount}</Text>
            )}
            <Text style={{ fontSize: rs(10), color: 'rgba(255,255,255,0.7)', marginTop: rp(4), fontWeight: '700', textTransform: 'uppercase' }}>Live now</Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)', height: '100%' }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: rs(18), fontWeight: '900', color: '#FFFFFF' }}>{drivers.length}</Text>
            )}
            <Text style={{ fontSize: rs(10), color: 'rgba(255,255,255,0.7)', marginTop: rp(4), fontWeight: '700', textTransform: 'uppercase' }}>Drivers</Text>
          </View>
        </View>
      </TopBar>

      <View style={{ paddingHorizontal: rp(theme.spacing.lg), paddingTop: rp(theme.spacing.xl), flex: 1, paddingBottom: rp(80) }}>
        
        <Text style={{
          fontSize: rs(11),
          fontWeight: "700",
          color: theme.colors.textSecondary,
          letterSpacing: rs(1.5),
          textTransform: "uppercase",
          marginBottom: rp(theme.spacing.sm),
        }}>
          MANAGE
        </Text>
        
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: rp(theme.spacing.xxl) }}>
          <TouchableOpacity 
            onPress={() => router.push("/(supervisor)/(tabs)/events")}
            style={{ flexDirection: 'row', alignItems: 'center', padding: rp(theme.spacing.lg), borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
          >
            <View style={{ backgroundColor: theme.colors.primaryLight, padding: rp(8), borderRadius: rp(8), marginRight: rp(theme.spacing.md) }}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
            </View>
            <Text style={{ flex: 1, fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>All events</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => router.push("/(supervisor)/(tabs)/team")}
            style={{ flexDirection: 'row', alignItems: 'center', padding: rp(theme.spacing.lg) }}
          >
            <View style={{ backgroundColor: theme.colors.primaryLight, padding: rp(8), borderRadius: rp(8), marginRight: rp(theme.spacing.md) }}>
              <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
            </View>
            <Text style={{ flex: 1, fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Team drivers</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </Card>

        <Btn variant="danger" onPress={handleSignOut} style={{ marginTop: rp(40) }}>
          Sign Out
        </Btn>

      </View>
    </Screen>
  );
}
