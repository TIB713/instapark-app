import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback } from "react";
import { rs, rp } from '../../../utils/responsive';
import { useEmployeeManagement } from '../../../hooks/useEmployeeManagement';
import { theme } from '../../../utils/theme';
import { Card, StatusPill, Screen, EmptyState } from '../../../components/valet/ui';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function SupervisorManageEmployees() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  
  const {
    drivers,
    loading,
    fetchAll,
    handleActivateDriver,
    handleDriverLongPress,
  } = useEmployeeManagement();

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const filteredDrivers = drivers.filter(d => d.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredDriversByMode = filteredDrivers.filter(d => filterMode === "all" || d.is_active);
  const activeCount = drivers.filter(d => d.is_active).length;
  const verifiedCount = drivers.filter(d => d.is_verified).length;
  const totalCount = drivers.length;

  return (
    <Screen scroll={false} testID="supervisor-team-screen">
      {/* 1. Hero Header */}
      <View style={{
        backgroundColor: theme.colors.primary,
        paddingHorizontal: rp(theme.spacing.xl),
        paddingBottom: rp(32),
        paddingTop: rp(theme.spacing.xl) + (insets.top || 0),
        borderBottomLeftRadius: rp(32),
        borderBottomRightRadius: rp(32),
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Soft Decorative Circles */}
        <View style={{ position: 'absolute', top: rp(-40), right: rp(-20), width: rp(150), height: rp(150), borderRadius: rp(75), backgroundColor: theme.colors.accent, opacity: 0.1 }} />
        <View style={{ position: 'absolute', bottom: rp(-50), left: rp(-30), width: rp(200), height: rp(200), borderRadius: rp(100), backgroundColor: theme.colors.primaryDark, opacity: 0.3 }} />
        
        <Text style={{ color: theme.colors.accent, fontSize: rs(12), fontWeight: '800', letterSpacing: 1, marginBottom: rp(4) }}>YOUR TEAM</Text>
        <Text style={{ color: theme.colors.surface, fontSize: rs(32), fontWeight: '900', marginBottom: rp(theme.spacing.sm) }}>Drivers</Text>
        
        <View style={{ alignSelf: 'flex-start', marginBottom: rp(theme.spacing.xl) }}>
          <StatusPill label={`${activeCount} available`} tone="success" />
        </View>

        {/* 3 Metrics Boxes */}
        <View style={{ flexDirection: 'row', gap: rp(8) }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.md), alignItems: 'center' }}>
            <Text style={{ color: theme.colors.surface, fontSize: rs(24), fontWeight: '900' }}>{totalCount}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: rs(10), fontWeight: '700', marginTop: rp(4) }}>DRIVERS</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.md), alignItems: 'center' }}>
            <Text style={{ color: theme.colors.surface, fontSize: rs(24), fontWeight: '900' }}>{activeCount}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: rs(10), fontWeight: '700', marginTop: rp(4) }}>ACTIVE</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.md), alignItems: 'center' }}>
            <Text style={{ color: theme.colors.surface, fontSize: rs(24), fontWeight: '900' }}>{verifiedCount}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: rs(10), fontWeight: '700', marginTop: rp(4) }}>VERIFIED</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: rp(theme.spacing.lg), paddingBottom: rp(100)  + tabBarHeight}}>
        
        {/* 2. Action Row */}
        <View style={{ flexDirection: 'row', gap: rp(theme.spacing.md), marginBottom: rp(theme.spacing.lg) }}>
          <TouchableOpacity 
            onPress={() => router.push("/(supervisor)/(tabs)/driver-new")}
            style={{ flex: 1, backgroundColor: theme.colors.accent, paddingVertical: rp(theme.spacing.md), borderRadius: rp(theme.radius.lg), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
          >
            <Ionicons name="person-add" size={18} color={theme.colors.accentForeground} style={{ marginRight: rp(8) }} />
            <Text style={{ color: theme.colors.accentForeground, fontWeight: '800', fontSize: rs(14) }}>ADD DRIVER</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push("/(supervisor)/(tabs)/driver-bulk")}
            style={{ flex: 1, backgroundColor: theme.colors.surface, paddingVertical: rp(theme.spacing.md), borderRadius: rp(theme.radius.lg), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.primary} style={{ marginRight: rp(8) }} />
            <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: rs(14) }}>BULK ADD</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Search Bar */}
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(99), flexDirection: "row", alignItems: "center", paddingHorizontal: rp(16), marginBottom: rp(theme.spacing.md), shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
          <Ionicons name="search-outline" size={20} color={theme.colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search drivers..."
            placeholderTextColor={theme.colors.textMuted}
            style={{ flex: 1, marginLeft: rp(12), paddingVertical: rp(14), fontSize: rs(15), color: theme.colors.textPrimary }}
          />
        </View>

        {/* 4. All / Available filter toggle */}
        <View style={{ flexDirection: "row", backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(99), padding: rp(4), marginBottom: rp(theme.spacing.xl) }}>
          <TouchableOpacity
            onPress={() => setFilterMode("all")}
            style={{ flex: 1, paddingVertical: rp(10), alignItems: "center", borderRadius: rp(99), backgroundColor: filterMode === "all" ? theme.colors.surface : "transparent", shadowColor: filterMode === "all" ? "#000" : "transparent", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: filterMode === "all" ? 2 : 0 }}
          >
            <Text style={{ fontWeight: "700", color: filterMode === "all" ? theme.colors.primary : theme.colors.textSecondary, fontSize: rs(13) }}>All Drivers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterMode("available")}
            style={{ flex: 1, paddingVertical: rp(10), alignItems: "center", borderRadius: rp(99), backgroundColor: filterMode === "available" ? theme.colors.surface : "transparent", shadowColor: filterMode === "available" ? "#000" : "transparent", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: filterMode === "available" ? 2 : 0 }}
          >
            <Text style={{ fontWeight: "700", color: filterMode === "available" ? theme.colors.primary : theme.colors.textSecondary, fontSize: rs(13) }}>Available</Text>
          </TouchableOpacity>
        </View>

        {/* 5. Driver List */}
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: rp(theme.spacing.xl) }} />
        ) : (
          <>
            {filteredDriversByMode.map(d => (
              <Card key={d.id} style={{ marginBottom: rp(theme.spacing.md), padding: 0, borderRadius: rp(theme.radius.xl), overflow: 'hidden' }}>
                {/* Top Section */}
                <TouchableOpacity 
                  onPress={() => router.push({ pathname: "/(admin)/driver-stats", params: { driverId: d.id, driverName: d.name } })}
                  onLongPress={() => handleDriverLongPress(d)}
                  activeOpacity={0.7}
                  style={{ padding: rp(theme.spacing.lg), flexDirection: "row", alignItems: "center" }}
                >
                  <View style={{ position: 'relative' }}>
                    <View style={{ backgroundColor: theme.colors.primaryLight, borderRadius: rp(14), width: rp(52), height: rp(52), alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: theme.colors.primary, fontWeight: "900", fontSize: rs(20) }}>{d.name?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ position: 'absolute', bottom: -2, right: -2, width: rp(14), height: rp(14), borderRadius: rp(7), backgroundColor: d.is_active ? theme.colors.success : theme.colors.textMuted, borderWidth: 2, borderColor: theme.colors.surface }} />
                  </View>
                  
                  <View style={{ flex: 1, marginLeft: rp(16) }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8), flexWrap: 'wrap' }}>
                      <Text style={{ fontWeight: "800", color: theme.colors.textPrimary, fontSize: rs(16) }}>{d.name}</Text>
                      {!d.is_active && (
                        <TouchableOpacity 
                          onPress={() => handleActivateDriver(d.id)}
                          style={{ backgroundColor: theme.colors.infoLight, borderRadius: rp(99), paddingHorizontal: rp(8), paddingVertical: rp(3) }}
                        >
                          <Text style={{ color: theme.colors.info, fontSize: rs(10), fontWeight: "800" }}>ACTIVATE</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: rs(13), marginTop: rp(4), fontWeight: '500' }}>
                      ID: {d.employee_id || "N/A"} {d.phone ? `· ${d.phone}` : ''}
                    </Text>
                  </View>
                  
                  <StatusPill 
                    label={d.is_active ? "Available" : "Busy"} 
                    tone={d.is_active ? "success" : "default"} 
                  />
                </TouchableOpacity>

                {/* Bottom Section - 4 column grid */}
                <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                  {/* Status */}
                  <View style={{ flex: 1, paddingVertical: rp(12), alignItems: "center", borderRightWidth: 1, borderRightColor: theme.colors.border }}>
                    <Ionicons name={d.is_active ? "checkmark-circle" : "close-circle"} size={16} color={d.is_active ? theme.colors.success : theme.colors.danger} style={{ marginBottom: rp(4) }} />
                    <Text style={{ fontSize: rs(10), fontWeight: "700", color: d.is_active ? theme.colors.success : theme.colors.danger }}>{d.is_active ? "ACTIVE" : "INACTIVE"}</Text>
                  </View>
                  {/* Verification */}
                  <View style={{ flex: 1, paddingVertical: rp(12), alignItems: "center", borderRightWidth: 1, borderRightColor: theme.colors.border }}>
                    <Ionicons name={d.is_verified ? "shield-checkmark" : "shield-half"} size={16} color={d.is_verified ? theme.colors.success : theme.colors.warning} style={{ marginBottom: rp(4) }} />
                    <Text style={{ fontSize: rs(10), fontWeight: "700", color: d.is_verified ? theme.colors.success : theme.colors.warning }}>{d.is_verified ? "VERIFIED" : "PENDING"}</Text>
                  </View>
                  {/* Call */}
                  <TouchableOpacity 
                    disabled={!d.phone}
                    onPress={() => Linking.openURL(`tel:${d.phone}`)}
                    style={{ flex: 1, paddingVertical: rp(12), alignItems: "center", borderRightWidth: 1, borderRightColor: theme.colors.border, opacity: d.phone ? 1 : 0.4 }}
                  >
                    <Ionicons name="call" size={16} color={theme.colors.primary} style={{ marginBottom: rp(4) }} />
                    <Text style={{ fontSize: rs(10), fontWeight: "700", color: theme.colors.primary }}>CALL</Text>
                  </TouchableOpacity>
                  {/* Edit */}
                  <TouchableOpacity 
                    onPress={() => router.push({ pathname: "/(supervisor)/(tabs)/driver-edit", params: { driverId: d.id } })}
                    style={{ flex: 1, paddingVertical: rp(12), alignItems: "center" }}
                  >
                    <Ionicons name="pencil" size={16} color={theme.colors.primary} style={{ marginBottom: rp(4) }} />
                    <Text style={{ fontSize: rs(10), fontWeight: "700", color: theme.colors.primary }}>EDIT</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}

            {filteredDriversByMode.length === 0 && (
              <EmptyState
                icon={<Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />}
                title="No drivers"
                body="Nobody matches that search right now."
                style={{ marginTop: rp(40) }}
              />
            )}
            
            {/* Footer Microcopy */}
            {filteredDriversByMode.length > 0 && (
              <Text style={{ textAlign: 'center', color: theme.colors.textMuted, fontSize: rs(12), marginTop: rp(theme.spacing.lg), paddingHorizontal: rp(theme.spacing.xl) }}>
                Add drivers one by one, or import a whole team from a spreadsheet.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
