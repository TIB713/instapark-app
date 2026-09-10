import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { rs, rp } from '../../../utils/responsive';
import { theme } from '../../../utils/theme';
import { Screen, Card, Btn, StatusPill, EmptyState } from '../../../components/valet/ui';
import { Hero } from '../../../components/admin/Hero';
import api from '../../../lib/api';
import { confirmDialog } from '../../../lib/confirmDialog';

const cardShadow = {
  shadowColor: theme.colors.primary,
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

const sectionTitle = { fontFamily: theme.fontFamily.bold, fontSize: rs(14), fontWeight: '800', color: theme.colors.textPrimary, marginBottom: rp(theme.spacing.md), textTransform: 'uppercase', letterSpacing: rs(1) };
const divider = { height: 1, backgroundColor: theme.colors.border };

const DetailRow = ({ icon, label, value }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', padding: rp(theme.spacing.md) }}>
    <Ionicons name={icon} size={18} color={theme.colors.textSecondary} style={{ width: rp(24) }} />
    <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(14), color: theme.colors.textSecondary, flex: 1 }}>{label}</Text>
    <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(14), fontWeight: '700', color: theme.colors.textPrimary }}>{value || "—"}</Text>
  </View>
);

export default function AdminDriverStats() {
  const router = useRouter();
  const { driverId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState(null);
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [tab, setTab] = useState("overview");

  const [eventsList, setEventsList] = useState([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPages, setEventsPages] = useState(1);
  const [eventsSearch, setEventsSearch] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
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
    }, [driverId])
  );

  useFocusEffect(
    useCallback(() => {
      if (!driverId) return;
      const fetchEvents = async () => {
        setEventsLoading(true);
        try {
          const res = await api.get(`/drivers/${driverId}/events-paginated?page=${eventsPage}&limit=5&search=${encodeURIComponent(eventsSearch)}`);
          setEventsList(res.data.events || []);
          setEventsPages(res.data.pages || 1);
        } catch (e) {
          console.warn("Failed to fetch events page", e);
        } finally {
          setEventsLoading(false);
        }
      };
      
      const timeout = setTimeout(fetchEvents, 400);
      return () => clearTimeout(timeout);
    }, [driverId, eventsPage, eventsSearch])
  );

  const toggleActive = async () => {
    try {
      await api.patch(`/drivers/${driverId}`, { is_active: !driver.is_active });
      setDriver({ ...driver, is_active: !driver.is_active });
    } catch {
      confirmDialog.info("Couldn't update status", "Something went wrong updating the driver. Check your connection and try again.");
    }
  };

  const handleDelete = async () => {
    confirmDialog.destructiveConfirm(
      "Delete driver",
      "WARNING: This will permanently delete this driver and cannot be undone. Are you sure?",
      async () => {
        try {
          await api.delete(`/superadmin/drivers/${driverId}/permanent`);
          confirmDialog.info("Deleted", "Driver permanently deleted");
          router.back();
        } catch {
          confirmDialog.info("Couldn't delete driver", "Something went wrong deleting the account. Check your connection and try again.");
        }
      },
      "Delete"
    );
  };

  const exportPDF = async () => {
    if (!driver) return;
    setExportingPDF(true);
    try {
      const { data: report } = await api.get(`/drivers/${driverId}/report`);
      const reportIncidents = report.incidents || incidents || [];

      // Fetch more events for the report if needed, or use loaded
      let pdfEvents = eventsList;
      try {
        const res = await api.get(`/drivers/${driverId}/events-paginated?page=1&limit=50`);
        if (res.data && res.data.events) {
          pdfEvents = res.data.events;
        }
      } catch (e) {}

      const eventRows = pdfEvents.map(e => `
        <tr>
          <td>${e.name}</td>
          <td>${e.venue || "—"}</td>
          <td>${e.date}</td>
          <td>${(e.checked_in || 0) + (e.retrieved || 0)}</td>
          <td>${e.status?.toUpperCase() || "—"}</td>
        </tr>
      `).join("");

      const incidentRows = reportIncidents.length > 0
        ? reportIncidents.map(i => `
          <tr>
            <td>${new Date(i.created_at).toLocaleDateString("en-IN", { timeZone: 'Asia/Kolkata' })}</td>
            <td>${i.plate || "—"}</td>
            <td>${i.description || i.type || "—"}</td>
          </tr>
        `).join("")
        : '<tr><td colspan="3" style="text-align:center;color:' + theme.colors.textMuted + ';">No incidents recorded</td></tr>';

      const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,sans-serif;color:${theme.colors.textPrimary};font-size:12px;line-height:1.5;}
        .header{background:${theme.colors.primary};color:white;padding:24px 28px;}
        .header h1{font-size:22px;font-weight:900;}
        .header p{opacity:0.8;margin-top:3px;font-size:12px;}
        .section{padding:20px 28px;border-bottom:1px solid ${theme.colors.surfaceAlt};}
        .section h2{font-size:11px;font-weight:800;color:${theme.colors.primary};letter-spacing:3px;margin-bottom:12px;text-transform:uppercase;}
        .stats{display:flex;gap:12px;flex-wrap:wrap;}
        .stat{background:${theme.colors.surfaceAlt};border-radius:10px;padding:12px 16px;text-align:center;min-width:110px;}
        .stat-val{font-size:22px;font-weight:900;color:${theme.colors.textPrimary};}
        .stat-lbl{font-size:9px;color:${theme.colors.textSecondary};text-transform:uppercase;letter-spacing:1px;margin-top:3px;}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;}
        th{padding:8px;text-align:left;background:${theme.colors.surfaceAlt};font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${theme.colors.textSecondary};font-weight:700;border-bottom:1px solid ${theme.colors.border};}
        td{padding:8px;border-bottom:1px solid ${theme.colors.border};}
        .footer{padding:16px 28px;text-align:center;color:${theme.colors.textMuted};font-size:10px;}
      </style></head><body>
      <div class="header">
        <h1>Driver Performance Report</h1>
        <p>${driver.name} · ${driver.employee_id || "ID: —"}</p>
        <p style="margin-top:6px;font-size:10px;opacity:0.6;">Generated ${new Date().toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</p>
      </div>
      <div class="section">
        <h2>Driver Information</h2>
        <p><strong>Name:</strong> ${driver.name}</p>
        <p><strong>Employee ID:</strong> ${driver.employee_id || "—"}</p>
        <p><strong>Phone:</strong> ${driver.phone || "—"}</p>
        <p><strong>Email:</strong> ${driver.email || "—"}</p>
      </div>
      <div class="section">
        <h2>Lifetime Stats Summary</h2>
        <div class="stats">
          <div class="stat"><div class="stat-val">${stats?.total_events || 0}</div><div class="stat-lbl">Total Events</div></div>
          <div class="stat"><div class="stat-val">${stats?.checked_in || 0}</div><div class="stat-lbl">Total Check-ins</div></div>
          <div class="stat"><div class="stat-val">${stats?.retrieved || 0}</div><div class="stat-lbl">Total Retrievals</div></div>
          <div class="stat"><div class="stat-val" style="color:${reportIncidents.length > 0 ? theme.colors.danger : theme.colors.textPrimary}">${reportIncidents.length}</div><div class="stat-lbl">Incidents</div></div>
        </div>
      </div>
      <div class="section">
        <h2>Events History</h2>
        <table><thead><tr><th>Event</th><th>Venue</th><th>Date</th><th>Cars</th><th>Status</th></tr></thead>
        <tbody>${eventRows}</tbody></table>
      </div>
      <div class="section">
        <h2>Incidents List</h2>
        <table><thead><tr><th>Date</th><th>Plate</th><th>Description</th></tr></thead>
        <tbody>${incidentRows}</tbody></table>
      </div>
      <div class="footer">InstaPark — Driver Performance Report · ${driver.name}</div>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const filename = `${driver.name.replace(/\s+/g, "_")}_stats.pdf`;
      const dest = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      await Sharing.shareAsync(dest, { mimeType: "application/pdf", dialogTitle: `${driver.name} — Performance Report` });
    } catch (e) {
      console.error(e);
      confirmDialog.info("Couldn't generate PDF", "Something went wrong creating the file. Please try again.");
    } finally {
      setExportingPDF(false);
    }
  };

  return (
    <Screen scroll={false}>
      <Hero
        eyebrow="Driver"
        title={driver?.name || "Loading..."}
        onBack={() => router.back()}
        badges={[
          driver ? { label: driver.is_verified ? "VERIFIED" : "UNVERIFIED", tone: driver.is_verified ? "success" : "warning" } : null,
          driver ? { label: driver.is_active ? "ACTIVE" : "INACTIVE", tone: driver.is_active ? "success" : "danger" } : null,
          driver?.duty_status && driver.duty_status !== "offline" ? { label: "ON DUTY", tone: "accent" } : null,
        ].filter(Boolean)}
        stats={[
          { value: stats?.total_events || 0, label: "EVENTS" },
          { value: stats?.checked_in || 0, label: "CHECKED IN" },
          { value: stats?.retrieved || 0, label: "RETRIEVED" },
          { value: stats?.incidents_count || 0, label: "INCIDENTS" },
        ]}
      />

      {driver && (
        <View>
          <View style={{ paddingHorizontal: rp(theme.spacing.lg), paddingTop: rp(theme.spacing.lg) }}>
            <View style={{ flexDirection: 'row', gap: rp(theme.spacing.md), marginBottom: rp(theme.spacing.sm) }}>
              <View style={{ flex: 1 }}>
                <Btn 
                  variant="outline" 
                  onPress={() => driver.phone && Linking.openURL(`tel:${driver.phone}`)}
                  disabled={!driver.phone}
                >
                  <Ionicons name="call" size={18} color={theme.colors.primary} style={{ marginRight: rp(8) }} />
                  Call
                </Btn>
              </View>
              <View style={{ flex: 1 }}>
                <Btn 
                  variant="outline" 
                  onPress={() => router.push({ pathname: "/(admin)/(tabs)/edit-driver", params: { driverId } })}
                >
                  <Ionicons name="pencil" size={18} color={theme.colors.primary} style={{ marginRight: rp(8) }} />
                  Edit
                </Btn>
              </View>
            </View>
          </View>

          {/* Tabs */}
          <View style={{ paddingHorizontal: rp(theme.spacing.lg), paddingTop: rp(theme.spacing.sm), paddingBottom: rp(theme.spacing.sm) }}>
            <View style={{ flexDirection: "row", backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(theme.radius.md), padding: rp(4) }}>
              {["overview", "events"].map((k) => (
                <TouchableOpacity
                  key={k}
                  onPress={() => setTab(k)}
                  style={{
                    flex: 1,
                    paddingVertical: rp(10),
                    borderRadius: rp(theme.radius.sm),
                    backgroundColor: tab === k ? theme.colors.surface : "transparent",
                    alignItems: "center",
                    ...(tab === k ? cardShadow : {})
                  }}
                >
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.caption), color: tab === k ? theme.colors.textPrimary : theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: rs(0.5) }}>
                    {k}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: rp(theme.spacing.lg), paddingBottom: rp(theme.spacing.xxxl) + (insets?.bottom || 0) + (tabBarHeight || 0) }}>
        
        {loading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: rp(40) }} />}

        {tab === "overview" && driver && (
          <View>
            <Text style={sectionTitle}>Details</Text>
            <Card style={{ marginBottom: rp(theme.spacing.xl), padding: 0 }}>
              <DetailRow icon="call-outline" label="Mobile" value={driver.phone} />
              <View style={divider} />
              <DetailRow icon="card-outline" label="License number" value={driver.driving_license_number} />
              <View style={divider} />
              <DetailRow icon="calendar-outline" label="Joined date" value={driver.created_at ? new Date(driver.created_at).toLocaleDateString() : "—"} />
            </Card>

            <Text style={sectionTitle}>Incidents</Text>
            {incidents && incidents.length > 0 ? (
              incidents.map(inc => (
                <Card key={inc.id} style={{ marginBottom: rp(theme.spacing.md), padding: rp(theme.spacing.lg), flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: rp(40), height: rp(40), borderRadius: rp(20), backgroundColor: theme.colors.dangerLight, alignItems: 'center', justifyContent: 'center', marginRight: rp(theme.spacing.md) }}>
                    <Ionicons name="warning-outline" size={20} color={theme.colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(15), fontWeight: '700', color: theme.colors.textPrimary, marginBottom: rp(2) }}>{inc.type || "Incident"}</Text>
                    <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(13), color: theme.colors.textSecondary }}>{inc.event_name || inc.plate || "Unknown Event"}</Text>
                    <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(11), color: theme.colors.textMuted, marginTop: rp(4) }}>{new Date(inc.created_at).toLocaleString()}</Text>
                  </View>
                  <StatusPill label={inc.status || "OPEN"} tone={inc.status === "RESOLVED" ? "success" : "danger"} />
                </Card>
              ))
            ) : (
              <Card style={{ marginBottom: rp(theme.spacing.xl), padding: rp(theme.spacing.lg), backgroundColor: theme.colors.successLight, borderWidth: 1, borderColor: theme.colors.success, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} style={{ marginRight: rp(12) }} />
                <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(15), fontWeight: '700', color: theme.colors.success }}>All clear. No incidents reported.</Text>
              </Card>
            )}

            <Card style={{ backgroundColor: theme.colors.primary, marginTop: rp(theme.spacing.lg) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: rp(48), height: rp(48), borderRadius: rp(24), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: rp(theme.spacing.md) }}>
                  <Ionicons name="document-text" size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: '#fff', fontSize: rs(16), fontWeight: '800', marginBottom: rp(4) }}>Driver report</Text>
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: 'rgba(255,255,255,0.8)', fontSize: rs(13), lineHeight: rs(18) }}>Export a detailed PDF containing this driver's entire history and performance metrics.</Text>
                </View>
              </View>
              <Btn 
                onPress={exportPDF} 
                disabled={exportingPDF}
                style={{ backgroundColor: '#fff', marginTop: rp(theme.spacing.lg) }}
              >
                {exportingPDF ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.primary, fontWeight: '800', fontSize: rs(14) }}>EXPORT PDF</Text>
                )}
              </Btn>
            </Card>

            <View style={{ marginTop: rp(theme.spacing.xl), padding: rp(theme.spacing.md), borderRadius: rp(theme.radius.lg), borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }}>
              <Text style={[sectionTitle, { fontFamily: theme.fontFamily.regular, marginTop: 0, textAlign: 'center' }]}>Admin Actions</Text>
              <Btn
                variant="outline"
                onPress={() => {
                  confirmDialog.confirm(
                    driver.is_active ? "Deactivate driver" : "Activate driver",
                    driver.is_active
                      ? "This driver will be marked inactive. Continue?"
                      : "This driver will be marked active again. Continue?",
                    toggleActive
                  );
                }}
                style={{
                  backgroundColor: driver.is_active ? theme.colors.dangerLight : theme.colors.successLight,
                  borderColor: driver.is_active ? theme.colors.dangerLight : theme.colors.successLight,
                  marginBottom: rp(12)
                }}
                textStyle={{ color: driver.is_active ? theme.colors.danger : theme.colors.success }}
              >
                <Ionicons name={driver.is_active ? "close-circle-outline" : "checkmark-circle-outline"} size={16} color={driver.is_active ? theme.colors.danger : theme.colors.success} style={{ marginRight: rp(8) }} />
                {driver.is_active ? "Deactivate Driver" : "Activate Driver"}
              </Btn>

              <Btn
                variant="outline"
                onPress={handleDelete}
                style={{
                  backgroundColor: theme.colors.dangerLight,
                  borderColor: theme.colors.dangerLight,
                }}
                textStyle={{ color: theme.colors.danger }}
              >
                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} style={{ marginRight: rp(8) }} />
                Delete Driver
              </Btn>
            </View>
          </View>
        )}

        {tab === "events" && (
          <View>
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
                  <TouchableOpacity key={e.event_id} onPress={() => router.push({ pathname: "/(admin)/(tabs)/event-detail", params: { eventId: e.event_id } })}>
                    <Card style={{ marginBottom: rp(theme.spacing.md), padding: 0 }}>
                      <View style={{ padding: rp(theme.spacing.lg) }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: rp(theme.spacing.sm) }}>
                          <View style={{ flex: 1, paddingRight: rp(theme.spacing.md) }}>
                            <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(16), fontWeight: '800', color: theme.colors.textPrimary, marginBottom: rp(4) }}>{e.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: rp(6) }}>
                              <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
                              <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(13), color: theme.colors.textSecondary }}>{e.venue}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: rp(6), marginTop: rp(2) }}>
                              <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
                              <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(13), color: theme.colors.textSecondary }}>{e.date}</Text>
                            </View>
                          </View>
                          {e.rating !== null && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.warningLight, paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(99) }}>
                              <Ionicons name="star" size={12} color={theme.colors.warning} />
                              <Text style={{ fontFamily: theme.fontFamily.bold, marginLeft: rp(4), color: theme.colors.warning, fontSize: rs(12), fontWeight: '800' }}>{e.rating}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }}>
                        <View style={{ flex: 1, alignItems: 'center', paddingVertical: rp(12), borderRightWidth: 1, borderRightColor: theme.colors.border }}>
                          <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(16), fontWeight: '800', color: theme.colors.textPrimary, marginBottom: rp(2) }}>{e.checked_in}</Text>
                          <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(9), fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: rs(0.5) }}>CHECK-INS</Text>
                        </View>
                        <View style={{ flex: 1, alignItems: 'center', paddingVertical: rp(12), borderRightWidth: 1, borderRightColor: theme.colors.border }}>
                          <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(16), fontWeight: '800', color: theme.colors.textPrimary, marginBottom: rp(2) }}>{e.retrieved}</Text>
                          <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(9), fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: rs(0.5) }}>RETRIEVALS</Text>
                        </View>
                        <View style={{ flex: 1, alignItems: 'center', paddingVertical: rp(12), borderRightWidth: 1, borderRightColor: theme.colors.border }}>
                          <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(16), fontWeight: '800', color: theme.colors.textPrimary, marginBottom: rp(2) }}>{e.avg_retrieval_minutes}m</Text>
                          <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(9), fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: rs(0.5) }}>AVG TIME</Text>
                        </View>
                        <View style={{ flex: 1, alignItems: 'center', paddingVertical: rp(12) }}>
                          <Text style={[{ fontSize: rs(16), fontWeight: '800', color: theme.colors.textPrimary, marginBottom: rp(2) }, e.incidents > 0 && { color: theme.colors.danger }]}>{e.incidents}</Text>
                          <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(9), fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: rs(0.5) }}>INCIDENTS</Text>
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
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(13), fontWeight: '700', color: theme.colors.textSecondary }}>
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
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
