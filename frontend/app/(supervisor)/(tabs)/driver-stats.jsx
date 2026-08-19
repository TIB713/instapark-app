import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { getItem } from '../../../lib/secure';

import { rs, rp } from '../../../utils/responsive';
import { theme } from '../../../utils/theme';
import { Screen, TopBar, Card, Btn, StatusPill, Chip, EmptyState } from '../../../components/valet/ui';
import api from '../../../lib/api';
import { confirmDialog } from '../../../lib/confirmDialog';

export default function DriverStats() {
  const router = useRouter();
  const { driverId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState(null);
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [downloading, setDownloading] = useState(false);

  const [eventsList, setEventsList] = useState([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPages, setEventsPages] = useState(1);
  const [eventsSearch, setEventsSearch] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [drvRes, statsRes, incRes] = await Promise.all([
          api.get(`/drivers/${driverId}`),
          api.get(`/drivers/${driverId}/profile-stats`),
          api.get(`/drivers/${driverId}/incidents`)
        ]);
        setDriver(drvRes.data);
        setStats(statsRes.data);
        setIncidents(incRes.data);
      } catch (err) {
        console.warn("Failed to fetch driver stats", err);
      } finally {
        setLoading(false);
      }
    };
    if (driverId) fetchData();
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;
    const fetchEvents = async () => {
      setEventsLoading(true);
      try {
        const res = await api.get(`/drivers/${driverId}/events-paginated?page=${eventsPage}&limit=5&search=${encodeURIComponent(eventsSearch)}`);
        setEventsList(res.data.events || []);
        setEventsTotal(res.data.total || 0);
        setEventsPages(res.data.pages || 1);
      } catch (e) {
        console.warn("Failed to fetch events page", e);
      } finally {
        setEventsLoading(false);
      }
    };
    
    const timeout = setTimeout(fetchEvents, 400);
    return () => clearTimeout(timeout);
  }, [driverId, eventsPage, eventsSearch]);

  const handleDownloadReport = async () => {
    try {
      setDownloading(true);
      const token = await getItem("auth_token");
      const fileUri = FileSystem.documentDirectory + `driver_report_${driverId}.csv`;
      const { uri, status } = await FileSystem.downloadAsync(
        `${api.defaults.baseURL}/drivers/${driverId}/report`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (status !== 200) {
        throw new Error(`Download failed with status ${status}`);
      }
      await Sharing.shareAsync(uri, { mimeType: "text/csv" });
    } catch (e) {
      confirmDialog.info("Couldn't download report", "Something went wrong downloading the report. Check your connection and try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading || !driver || !stats) {
    return (
      <Screen>
        <TopBar onBack={() => router.replace("/(supervisor)/(tabs)/team")} title="Loading..." />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const { is_active } = driver;
  const { recent, checked_in, retrieved, avg_retrieval_minutes, rating, incidents_count } = stats;

  return (
    <Screen scroll={false}>
      <TopBar 
        eyebrow="DRIVER PROFILE" 
        title={driver.name} 
        onBack={() => router.replace("/(supervisor)/(tabs)/team")}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rp(theme.spacing.sm), marginTop: rp(theme.spacing.xs), marginBottom: rp(theme.spacing.md), flexWrap: 'wrap' }}>
          <StatusPill 
            label={driver.is_verified ? "Verified" : "Unverified"} 
            tone={driver.is_verified ? "success" : "warning"} 
            icon={driver.is_verified ? "checkmark-circle" : "warning"} 
          />
          <StatusPill label={is_active ? "Active" : "Inactive"} tone={is_active ? "success" : "danger"} />
          <StatusPill label={driver.duty_status !== "offline" ? "On Duty" : "Off Duty"} tone={driver.duty_status !== "offline" ? "accent" : "neutral"} />
        </View>

        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: theme.radius.lg,
          padding: rp(theme.spacing.md),
        }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: rs(18), fontWeight: '900', color: '#FFFFFF' }}>{stats.total_events}</Text>
            <Text style={{ fontSize: rs(10), color: 'rgba(255,255,255,0.7)', marginTop: rp(4), fontWeight: '700', textTransform: 'uppercase' }}>Events</Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)', height: '100%' }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: rs(18), fontWeight: '900', color: incidents_count > 0 ? theme.colors.danger : '#FFFFFF' }}>{incidents_count}</Text>
            <Text style={{ fontSize: rs(10), color: 'rgba(255,255,255,0.7)', marginTop: rp(4), fontWeight: '700', textTransform: 'uppercase' }}>Incidents</Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)', height: '100%' }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: rp(2) }}>
              <Text style={{ fontSize: rs(18), fontWeight: '900', color: theme.colors.warning }}>{rating ?? "—"}</Text>
              <Ionicons name="star" size={12} color={theme.colors.warning} />
            </View>
            <Text style={{ fontSize: rs(10), color: 'rgba(255,255,255,0.7)', marginTop: rp(4), fontWeight: '700', textTransform: 'uppercase' }}>Rating</Text>
          </View>
        </View>
      </TopBar>

      <ScrollView contentContainerStyle={{ padding: rp(theme.spacing.lg), paddingBottom: rp(theme.spacing.xxxl) + (insets?.bottom || 0) + (tabBarHeight || 0) }}>
        {/* Quick Actions */}
        <View style={{ flexDirection: 'row', gap: rp(theme.spacing.md), marginBottom: rp(theme.spacing.xl) }}>
          <Btn 
            variant="outline" 
            style={{ flex: 1 }} 
            onPress={() => driver.phone && Linking.openURL(`tel:${driver.phone}`)}
            disabled={!driver.phone}
          >
            <Ionicons name="call" size={18} color={theme.colors.primary} style={{ marginRight: rp(8) }} />
            Call
          </Btn>
          <Btn 
            variant="outline" 
            style={{ flex: 1 }} 
            onPress={() => router.push({ pathname: "/(supervisor)/(tabs)/driver-edit", params: { driverId } })}
          >
            <Ionicons name="pencil" size={18} color={theme.colors.primary} style={{ marginRight: rp(8) }} />
            Edit
          </Btn>
        </View>

        {/* Performance Grid */}
        <Text style={sectionTitle}>Performance</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rp(theme.spacing.md), marginBottom: rp(theme.spacing.xl) }}>
          <MetricCard icon="checkmark-done-outline" label="Checked in" value={checked_in} />
          <MetricCard icon="car-sport-outline" label="Retrieved" value={retrieved} />
          <MetricCard icon="timer-outline" label="Avg retrieval" value={`${avg_retrieval_minutes} min`} />
          <MetricCard icon="star-outline" label="Rating" value={rating ?? "—"} iconColor={theme.colors.warning} />
          <MetricCard icon="time-outline" label="On-time %" value="No data yet" mutedValue />
          <MetricCard icon="hourglass-outline" label="Hours worked" value="No data yet" mutedValue />
        </View>

        {/* Details Card */}
        <Text style={sectionTitle}>Details</Text>
        <Card style={{ marginBottom: rp(theme.spacing.xl), padding: 0 }}>
          <DetailRow icon="call-outline" label="Mobile" value={driver.phone} />
          <View style={divider} />
          <DetailRow icon="card-outline" label="License number" value={driver.driving_license_number} />
          <View style={divider} />
          <DetailRow icon="calendar-outline" label="Joined date" value={driver.created_at ? new Date(driver.created_at).toLocaleDateString() : "—"} />
        </Card>

        {/* Events Involved */}
        <Text style={sectionTitle}>Events involved</Text>
        
        <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.sm), flexDirection: 'row', alignItems: 'center', marginBottom: rp(theme.spacing.md), borderWidth: 1, borderColor: theme.colors.border }}>
          <Ionicons name="search" size={20} color={theme.colors.textMuted} style={{ marginRight: rp(theme.spacing.sm) }} />
          <TextInput
            placeholder="Search events..."
            placeholderTextColor={theme.colors.textMuted}
            value={eventsSearch}
            onChangeText={(t) => { setEventsSearch(t); setEventsPage(1); }}
            style={{ flex: 1, color: theme.colors.textPrimary, fontSize: rs(16), fontWeight: '600', padding: 0 }}
          />
        </View>

        {eventsLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: rp(theme.spacing.xl) }} />
        ) : eventsList.length > 0 ? (
          <>
            {eventsList.map(e => (
              <TouchableOpacity key={e.event_id} onPress={() => router.push({ pathname: "/(supervisor)/(tabs)/event-detail", params: { eventId: e.event_id } })}>
                <Card style={{ marginBottom: rp(theme.spacing.md), padding: 0 }}>
                  <View style={{ padding: rp(theme.spacing.lg) }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: rp(theme.spacing.sm) }}>
                      <View style={{ flex: 1, paddingRight: rp(theme.spacing.md) }}>
                        <Text style={{ fontSize: rs(16), fontWeight: '800', color: theme.colors.textPrimary, marginBottom: rp(4) }}>{e.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: rp(6) }}>
                          <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
                          <Text style={{ fontSize: rs(13), color: theme.colors.textSecondary }}>{e.venue}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: rp(6), marginTop: rp(2) }}>
                          <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
                          <Text style={{ fontSize: rs(13), color: theme.colors.textSecondary }}>{e.date}</Text>
                        </View>
                      </View>
                      {e.rating !== null && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.warningLight, paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(99) }}>
                          <Ionicons name="star" size={12} color={theme.colors.warning} />
                          <Text style={{ marginLeft: rp(4), color: theme.colors.warning, fontSize: rs(12), fontWeight: '800' }}>{e.rating}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }}>
                    <View style={[eventStatCol, { borderRightWidth: 1, borderRightColor: theme.colors.border }]}>
                      <Text style={eventStatVal}>{e.checked_in}</Text>
                      <Text style={eventStatLbl}>CHECK-INS</Text>
                    </View>
                    <View style={[eventStatCol, { borderRightWidth: 1, borderRightColor: theme.colors.border }]}>
                      <Text style={eventStatVal}>{e.retrieved}</Text>
                      <Text style={eventStatLbl}>RETRIEVALS</Text>
                    </View>
                    <View style={[eventStatCol, { borderRightWidth: 1, borderRightColor: theme.colors.border }]}>
                      <Text style={eventStatVal}>{e.avg_retrieval_minutes}m</Text>
                      <Text style={eventStatLbl}>AVG TIME</Text>
                    </View>
                    <View style={eventStatCol}>
                      <Text style={[eventStatVal, e.incidents > 0 && { color: theme.colors.danger }]}>{e.incidents}</Text>
                      <Text style={eventStatLbl}>INCIDENTS</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: rp(theme.spacing.sm), marginBottom: rp(theme.spacing.xl) }}>
              <Btn 
                variant="outline" 
                disabled={eventsPage <= 1} 
                onPress={() => setEventsPage(p => p - 1)}
                style={{ minWidth: rp(100) }}
              >
                <Ionicons name="arrow-back" size={16} color={eventsPage <= 1 ? theme.colors.textMuted : theme.colors.primary} style={{ marginRight: rp(4) }} />
                Prev
              </Btn>
              <Text style={{ fontSize: rs(13), fontWeight: '700', color: theme.colors.textSecondary }}>
                Page {eventsPage} of {eventsPages}
              </Text>
              <Btn 
                variant="outline" 
                disabled={eventsPage >= eventsPages} 
                onPress={() => setEventsPage(p => p + 1)}
                style={{ minWidth: rp(100) }}
              >
                Next
                <Ionicons name="arrow-forward" size={16} color={eventsPage >= eventsPages ? theme.colors.textMuted : theme.colors.primary} style={{ marginLeft: rp(4) }} />
              </Btn>
            </View>
          </>
        ) : (
          <EmptyState 
            icon={<Ionicons name="calendar-outline" size={48} color={theme.colors.textMuted} />}
            title="No events found"
            body={eventsSearch ? "Try adjusting your search terms." : "This driver hasn't worked any events."}
            style={{ marginBottom: rp(theme.spacing.xl) }}
          />
        )}

        {/* Incidents Section */}
        <Text style={[sectionTitle, { marginTop: rp(theme.spacing.lg) }]}>Incidents</Text>
        {incidents.length > 0 ? (
          incidents.map(inc => (
            <Card key={inc.id} style={{ marginBottom: rp(theme.spacing.md), padding: rp(theme.spacing.lg), flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: rp(40), height: rp(40), borderRadius: rp(20), backgroundColor: theme.colors.dangerLight, alignItems: 'center', justifyContent: 'center', marginRight: rp(theme.spacing.md) }}>
                <Ionicons name="warning-outline" size={20} color={theme.colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rs(15), fontWeight: '700', color: theme.colors.textPrimary, marginBottom: rp(2) }}>{inc.type || "Incident"}</Text>
                <Text style={{ fontSize: rs(13), color: theme.colors.textSecondary }}>{inc.event_name || inc.plate || "Unknown Event"}</Text>
                <Text style={{ fontSize: rs(11), color: theme.colors.textMuted, marginTop: rp(4) }}>{new Date(inc.created_at).toLocaleString()}</Text>
              </View>
              <StatusPill label={inc.status || "OPEN"} tone={inc.status === "RESOLVED" ? "success" : "danger"} />
            </Card>
          ))
        ) : (
          <Card style={{ marginBottom: rp(theme.spacing.xl), padding: rp(theme.spacing.lg), backgroundColor: theme.colors.successLight, borderWidth: 1, borderColor: theme.colors.success, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} style={{ marginRight: rp(12) }} />
            <Text style={{ fontSize: rs(15), fontWeight: '700', color: theme.colors.success }}>All clear. No incidents reported.</Text>
          </Card>
        )}

        {/* Recent Activity */}
        {recent.length > 0 && (
          <>
            <Text style={[sectionTitle, { marginTop: rp(theme.spacing.lg) }]}>Recent activity</Text>
            <Card style={{ marginBottom: rp(theme.spacing.xl), padding: rp(theme.spacing.lg) }}>
              {recent.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i === recent.length - 1 ? 0 : rp(theme.spacing.md) }}>
                  <View style={{ width: rp(10), height: rp(10), borderRadius: rp(5), backgroundColor: r.type === "checked_in" ? theme.colors.primary : theme.colors.success, marginTop: rp(4), marginRight: rp(12) }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: rs(14), fontWeight: '600', color: theme.colors.textPrimary }}>
                      {r.type === "checked_in" ? "Checked in" : "Delivered"} {r.plate}
                    </Text>
                  </View>
                  <Text style={{ fontSize: rs(12), color: theme.colors.textMuted }}>
                    {new Date(r.at).toLocaleDateString([], { day: '2-digit', month: 'short' })} · {new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Bottom Report Card */}
        <Card style={{ backgroundColor: theme.colors.primary, marginTop: rp(theme.spacing.lg) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: rp(48), height: rp(48), borderRadius: rp(24), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: rp(theme.spacing.md) }}>
              <Ionicons name="document-text" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: rs(16), fontWeight: '800', marginBottom: rp(4) }}>Driver report</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rs(13), lineHeight: rs(18) }}>Download a detailed CSV export of this driver's entire history and performance metrics.</Text>
            </View>
          </View>
          <Btn 
            onPress={handleDownloadReport} 
            disabled={downloading}
            style={{ backgroundColor: '#fff', marginTop: rp(theme.spacing.lg) }}
          >
            {downloading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: rs(14) }}>DOWNLOAD CSV</Text>
            )}
          </Btn>
        </Card>

      </ScrollView>
    </Screen>
  );
}

const sectionTitle = { fontSize: rs(14), fontWeight: '800', color: theme.colors.textPrimary, marginBottom: rp(theme.spacing.md), textTransform: 'uppercase', letterSpacing: rs(1) };
const divider = { height: 1, backgroundColor: theme.colors.border };
const eventStatCol = { flex: 1, alignItems: 'center', paddingVertical: rp(12) };
const eventStatVal = { fontSize: rs(16), fontWeight: '800', color: theme.colors.textPrimary, marginBottom: rp(2) };
const eventStatLbl = { fontSize: rs(9), fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: rs(0.5) };

const MetricCard = ({ icon, label, value, iconColor = theme.colors.primary, mutedValue }) => (
  <Card style={{ width: '48%', padding: rp(theme.spacing.md) }}>
    <Ionicons name={icon} size={20} color={iconColor} style={{ marginBottom: rp(theme.spacing.sm) }} />
    <Text style={{ fontSize: rs(18), fontWeight: '800', color: mutedValue ? theme.colors.textMuted : theme.colors.textPrimary, marginBottom: rp(4) }}>{value}</Text>
    <Text style={{ fontSize: rs(11), fontWeight: '600', color: theme.colors.textSecondary }}>{label}</Text>
  </Card>
);

const DetailRow = ({ icon, label, value }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', padding: rp(theme.spacing.md) }}>
    <Ionicons name={icon} size={18} color={theme.colors.textSecondary} style={{ width: rp(24) }} />
    <Text style={{ fontSize: rs(14), color: theme.colors.textSecondary, flex: 1 }}>{label}</Text>
    <Text style={{ fontSize: rs(14), fontWeight: '700', color: theme.colors.textPrimary }}>{value || "—"}</Text>
  </View>
);
