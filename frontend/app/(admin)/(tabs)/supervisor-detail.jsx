import { useEffect, useState, useCallback } from "react";
import { confirmDialog } from "../../../lib/confirmDialog";
import { rs, rp } from "../../../utils/responsive";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl, Linking, TextInput } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../utils/theme";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import api from "../../../lib/api";
import { Screen, Card, Btn, StatusPill, EmptyState } from "../../../components/valet/ui";
import { Hero } from "../../../components/admin/Hero";
import { useAppStore } from "../../../lib/store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

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

export default function SupervisorDetail() {
  const router = useRouter();
  const { supervisorId, supervisorName } = useLocalSearchParams();
  const { setCurrentEventId } = useAppStore();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [supervisor, setSupervisor] = useState(null);
  const [events, setEvents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("overview");

  // Events pagination & search
  const [eventsSearch, setEventsSearch] = useState("");
  const [eventsPage, setEventsPage] = useState(1);
  const EVENTS_PER_PAGE = 5;

  const [exportingPDF, setExportingPDF] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [supRes, eventsRes, statsRes, incRes] = await Promise.all([
        api.get(`/supervisors/${supervisorId}`),
        api.get(`/supervisors/${supervisorId}/events`),
        api.get(`/supervisors/${supervisorId}/stats`),
        api.get(`/incidents/supervisor/${supervisorId}`)
      ]);
      setSupervisor(supRes.data);
      setEvents(eventsRes.data || []);
      setStats(statsRes.data);
      setIncidents(incRes.data || []);
    } catch (e) {
      console.warn("Failed to fetch supervisor detail", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supervisorId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openEvent = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id.toString());
    router.push("/(admin)/(tabs)/event-detail");
  };

  const exportPDF = async () => {
    if (!supervisor) return;
    setExportingPDF(true);
    try {
      const eventRows = events.map(e => `
        <tr>
          <td>${e.name}</td>
          <td>${e.venue || "—"}</td>
          <td>${e.date}</td>
          <td>${e.status?.toUpperCase()}</td>
        </tr>
      `).join("");

      const incidentRows = incidents.length > 0
        ? incidents.map(i => `
          <tr>
            <td>${new Date(i.created_at).toLocaleDateString("en-IN", { timeZone: 'Asia/Kolkata' })}</td>
            <td>${i.plate}</td>
            <td>${i.description}</td>
          </tr>
        `).join("")
        : '<tr><td colspan="3" style="text-align:center;color:#9CA3AF;">No incidents reported</td></tr>';

      const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,sans-serif;color:#111827;font-size:12px;line-height:1.5;}
        .header{background:#3F0163;color:white;padding:24px 28px;}
        .header h1{font-size:22px;font-weight:900;}
        .header p{opacity:0.8;margin-top:3px;font-size:12px;}
        .section{padding:20px 28px;border-bottom:1px solid #f3f4f6;}
        .section h2{font-size:11px;font-weight:800;color:#3F0163;letter-spacing:3px;margin-bottom:12px;text-transform:uppercase;}
        .stats{display:flex;gap:12px;flex-wrap:wrap;}
        .stat{background:#f9fafb;border-radius:10px;padding:12px 16px;text-align:center;min-width:110px;}
        .stat-val{font-size:22px;font-weight:900;color:#111827;}
        .stat-lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-top:3px;}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;}
        th{padding:8px;text-align:left;background:#f9fafb;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;}
        td{padding:8px;border-bottom:1px solid #f3f4f6;}
        .footer{padding:16px 28px;text-align:center;color:#9ca3af;font-size:10px;}
      </style></head><body>
      <div class="header">
        <h1>Supervisor Performance Report</h1>
        <p>${supervisor.name} · ${supervisor.employee_id || "ID: —"}</p>
        <p style="margin-top:6px;font-size:10px;opacity:0.6;">Generated ${new Date().toLocaleString("en-IN", { timeZone: 'Asia/Kolkata' })}</p>
      </div>
      <div class="section">
        <h2>Supervisor Information</h2>
        <p><strong>Name:</strong> ${supervisor.name}</p>
        <p><strong>Employee ID:</strong> ${supervisor.employee_id || "—"}</p>
        <p><strong>Email:</strong> ${supervisor.email || "—"}</p>
        <p><strong>Phone:</strong> ${supervisor.phone || "—"}</p>
      </div>
      <div class="section">
        <h2>Stats Summary</h2>
        <div class="stats">
          <div class="stat"><div class="stat-val">${stats?.total_events || 0}</div><div class="stat-lbl">Events Supervised</div></div>
          <div class="stat"><div class="stat-val">${stats?.total_drivers || 0}</div><div class="stat-lbl">Unique Drivers</div></div>
          <div class="stat"><div class="stat-val" style="color:${stats?.total_incidents > 0 ? theme.colors.danger : theme.colors.textPrimary}">${stats?.total_incidents || 0}</div><div class="stat-lbl">Incidents Reported</div></div>
        </div>
      </div>
      <div class="section">
        <h2>Events List</h2>
        <table><thead><tr><th>Event</th><th>Venue</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${eventRows}</tbody></table>
      </div>
      <div class="section">
        <h2>Incidents Reported</h2>
        <table><thead><tr><th>Date</th><th>Plate</th><th>Description</th></tr></thead>
        <tbody>${incidentRows}</tbody></table>
      </div>
      <div class="footer">InstaPark — Supervisor Performance Report · ${supervisor.name}</div>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const filename = `${supervisor.name.replace(/\s+/g, "_")}_report.pdf`;
      const dest = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      await Sharing.shareAsync(dest, { mimeType: "application/pdf", dialogTitle: `${supervisor.name} — Performance Report` });
    } catch (e) {
      console.warn(e);
      confirmDialog.info("Couldn't generate PDF", "Something went wrong creating the file. Please try again.");
    } finally {
      setExportingPDF(false);
    }
  };

  const filteredEvts = events.filter((e) => {
    if (!eventsSearch) return true;
    return e.name.toLowerCase().includes(eventsSearch.toLowerCase()) ||
      (e.venue && e.venue.toLowerCase().includes(eventsSearch.toLowerCase()));
  });

  const eventsPages = Math.ceil(filteredEvts.length / EVENTS_PER_PAGE) || 1;
  const paginatedEvts = filteredEvts.slice((eventsPage - 1) * EVENTS_PER_PAGE, eventsPage * EVENTS_PER_PAGE);

  return (
    <Screen scroll={false}>
      <Hero
        eyebrow="Supervisor"
        title={supervisorName || supervisor?.name || "Loading..."}
        onBack={() => router.back()}
        badges={[
          { label: "SUPERVISOR", tone: "primary" },
          supervisor ? { label: supervisor.is_active ? "ACTIVE" : "INACTIVE", tone: supervisor.is_active ? "success" : "danger" } : null,
          supervisor?.employee_id ? { label: supervisor.employee_id, tone: "surfaceAlt" } : null,
        ].filter(Boolean)}
        stats={[
          { value: stats?.total_events || 0, label: "EVENTS" },
          { value: stats?.total_drivers || 0, label: "DRIVERS" },
          { value: stats?.avg_rating || "—", label: "AVG RATING" },
          { value: stats?.total_incidents || 0, label: "INCIDENTS" },
        ]}
      />

      {supervisor && (
        <View>
          <View style={{ paddingHorizontal: rp(theme.spacing.lg), paddingTop: rp(theme.spacing.lg) }}>
            <View style={{ flexDirection: 'row', gap: rp(theme.spacing.md), marginBottom: rp(theme.spacing.sm) }}>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="outline"
                  onPress={() => supervisor.phone && Linking.openURL(`tel:${supervisor.phone}`)}
                  disabled={!supervisor.phone}
                >
                  <Ionicons name="call" size={18} color={theme.colors.primary} style={{ marginRight: rp(8) }} />
                  Call
                </Btn>
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="outline"
                  onPress={() => router.push({ pathname: '/(admin)/(tabs)/edit-supervisor', params: { supervisorId } })}
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: rp(theme.spacing.lg), paddingBottom: rp(theme.spacing.xxxl) + (insets?.bottom || 0) + (tabBarHeight || 0) }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}>
        {loading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: rp(40) }} />}

        {tab === "overview" && supervisor && (
          <View style={{ paddingTop: rp(theme.spacing.sm) }}>

            <Text style={sectionTitle}>Details</Text>
            <Card style={{ marginBottom: rp(theme.spacing.xl), padding: 0 }}>
              <DetailRow icon="call-outline" label="Phone" value={supervisor.phone} />
              <View style={divider} />
              <DetailRow icon="mail-outline" label="Email" value={supervisor.email} />
              <View style={divider} />
              <DetailRow icon="id-card-outline" label="Employee ID" value={supervisor.employee_id} />
              <View style={divider} />
              <DetailRow icon="transgender-outline" label="Gender" value={supervisor.gender ? supervisor.gender.charAt(0).toUpperCase() + supervisor.gender.slice(1) : "—"} />
              <View style={divider} />
              <DetailRow icon="card-outline" label="PAN Number" value={supervisor.pan_number} />
              <View style={divider} />
              <DetailRow icon="document-text-outline" label="Aadhar Number" value={supervisor.aadhar_number} />
            </Card>

            <Text style={sectionTitle}>Incidents</Text>
            {incidents.length > 0 ? (
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
                  <Ionicons name="document-text" size={24} color={theme.colors.surface} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.surface, fontSize: rs(16), fontWeight: '800', marginBottom: rp(4) }}>Supervisor report</Text>
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: 'rgba(255,255,255,0.8)', fontSize: rs(13), lineHeight: rs(18) }}>Export a detailed PDF containing this supervisor's entire history and performance metrics.</Text>
                </View>
              </View>
              <Btn
                onPress={exportPDF}
                disabled={exportingPDF}
                style={{ backgroundColor: theme.colors.surface, marginTop: rp(theme.spacing.lg) }}
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
                onPress={async () => {
                  try {
                    await api.patch(`/supervisors/${supervisorId}`, { is_active: !supervisor.is_active });
                    setSupervisor({ ...supervisor, is_active: !supervisor.is_active });
                  } catch {
                    confirmDialog.info("Couldn't update status", "Something went wrong updating the supervisor. Check your connection and try again.");
                  }
                }}
                style={{
                  backgroundColor: supervisor.is_active ? theme.colors.dangerLight : theme.colors.successLight,
                  borderColor: supervisor.is_active ? theme.colors.dangerLight : theme.colors.successLight,
                }}
                textStyle={{ color: supervisor.is_active ? theme.colors.danger : theme.colors.success }}
              >
                <Ionicons name={supervisor.is_active ? "close-circle-outline" : "checkmark-circle-outline"} size={16} color={supervisor.is_active ? theme.colors.danger : theme.colors.success} style={{ marginRight: rp(8) }} />
                {supervisor.is_active ? "Deactivate Supervisor" : "Activate Supervisor"}
              </Btn>
            </View>

          </View>
        )}

        {tab === "events" && (
          <View style={{ paddingTop: rp(theme.spacing.sm), paddingBottom: rp(40) }}>

            <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(theme.radius.lg), padding: rp(theme.spacing.sm), flexDirection: 'row', alignItems: 'center', marginBottom: rp(theme.spacing.lg), borderWidth: 1, borderColor: theme.colors.border }}>
              <Ionicons name="search" size={20} color={theme.colors.textMuted} style={{ marginRight: rp(theme.spacing.sm) }} />
              <TextInput
                placeholder="Search events..."
                placeholderTextColor={theme.colors.textMuted}
                value={eventsSearch}
                onChangeText={(t) => { setEventsSearch(t); setEventsPage(1); }}
                style={{ flex: 1, color: theme.colors.textPrimary, fontSize: rs(16), fontWeight: '600', padding: 0 }}
              />
            </View>

            {filteredEvts.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="calendar-outline" size={48} color={theme.colors.textMuted} />}
                title="No events found"
                body={eventsSearch ? "Try adjusting your search terms." : "No events match your current filters."}
                style={{ marginBottom: rp(theme.spacing.xl) }}
              />
            ) : (
              <>
                {paginatedEvts.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => openEvent(e)}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderRadius: rp(theme.radius.lg),
                      padding: rp(16),
                      marginBottom: rp(12),
                      flexDirection: "row",
                      alignItems: "center",
                      borderLeftWidth: rp(4),
                      borderLeftColor: e.status === "active" ? theme.colors.success : theme.colors.border,
                      ...cardShadow,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, fontSize: rs(theme.fontSize.bodyLarge) }}>{e.name}</Text>
                      <View style={{ flexDirection: "row", gap: rp(8), marginTop: rp(8), flexWrap: "wrap" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(4), gap: rp(4) }}>
                          <Ionicons name="calendar-outline" size={12} color={theme.colors.textSecondary} />
                          <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, fontSize: rs(10), fontWeight: theme.fontWeight.bold }}>{e.date}</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(4), gap: rp(4) }}>
                          <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                          <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.textSecondary, fontSize: rs(10), fontWeight: theme.fontWeight.bold }}>{e.venue || "No Venue"}</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
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
            )}
          </View>
        )}

      </ScrollView>
    </Screen>
  );
}
