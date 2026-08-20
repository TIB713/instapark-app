import { useState, useEffect } from "react";
import { rs, rp } from '../../utils/responsive'; 
import { 
  View, Text, ScrollView, ActivityIndicator, 
  TouchableOpacity, Image, Modal 
} from "react-native"; 
import { useLocalSearchParams, useRouter } from "expo-router"; 
import { Ionicons } from "@expo/vector-icons"; 
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"; 
import api from "../../lib/api";
import { theme } from "../../utils/theme"; 
import { fmtDuration } from "../../utils/time";
 
const STATUS_CONFIG = { 
  REGISTERED: { color: "#6366F1", icon: "document-text-outline", label: "Registered" },
  PRE_REGISTERED: { color: "#8B5CF6", icon: "time-outline", label: "Pre-Registered" }, 
  CHECKED_IN:     { color: "#0EA5E9", icon: "log-in-outline", label: "Checked In" }, 
  PARKED:         { color: theme.colors.success, icon: "car-outline", label: "Parked" }, 
  RETRIEVAL_REQUESTED: { color: "#F59E0B", icon: "notifications-outline", label: "Retrieval Requested" }, 
  ACCEPTED: { color: "#EAB308", icon: "checkmark-circle-outline", label: "Retrieval Accepted" },
  BEING_FETCHED:  { color: "#F97316", icon: "walk-outline", label: "Being Fetched" }, 
  ARRIVED_AT_GATE: { color: "#10B981", icon: "location-outline", label: "Arrived At Gate" },
  AWAITING_REPARK: { color: theme.colors.danger, icon: "alert-circle-outline", label: "Needs Re-Park" },
  SELF_PICKUP: { color: theme.colors.warning, icon: "walk-outline", label: "Self Pickup" },
  DELIVERED:      { color: theme.colors.textMuted, icon: "checkmark-circle", label: "Delivered" }, 
}; 
 
function fmt(iso) { 
  if (!iso) return "—"; 
  const d = new Date(iso); 
  return d.toLocaleString("en-IN", { 
    day: "numeric", month: "short", 
    hour: "2-digit", minute: "2-digit",
    timeZone: 'Asia/Kolkata'
  }); 
} 
 
function TimelineStep({ color, icon, label, time, driver, 
    note, durationCaption, photos, isLast, onPhotoPress }) { 
    return ( 
      <View style={{ flexDirection: "row" }}> 
      {/* Line + dot */} 
      <View style={{ width: rp(40), alignItems: "center" }}> 
        <View style={{ width: rp(36), height: rp(36), borderRadius: rp(18), 
          backgroundColor: color, alignItems: "center", 
          justifyContent: "center", zIndex: 1 }}> 
          <Ionicons name={icon} size={18} color="#fff" /> 
        </View> 
        {!isLast && ( 
          <View style={{ width: rp(2), flex: 1, minHeight: 24, 
            backgroundColor: "#E5E7EB", marginTop: rp(2) }} /> 
        )} 
      </View> 
 
      {/* Content */} 
      <View style={{ flex: 1, paddingLeft: rp(14), 
        paddingBottom: isLast ? 0 : 24 }}> 
        <View style={{ flexDirection: "row", 
          justifyContent: "space-between", alignItems: "center" }}> 
          <Text style={{ fontWeight: "900", fontSize: rs(15), 
            color: theme.colors.textPrimary }}>{label}</Text> 
          <Text style={{ fontSize: rs(11), color: theme.colors.textMuted, 
            fontWeight: "700" }}>{fmt(time)}</Text> 
        </View> 
 
        {driver && ( 
          <View style={{ flexDirection: "row", 
            alignItems: "center", marginTop: rp(4) }}> 
            <Ionicons name="person-outline" size={12} 
              color={theme.colors.textSecondary} /> 
            <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), 
              marginLeft: rp(4), fontWeight: "700" }}>{driver}</Text> 
          </View> 
        )} 
 
        {note ? ( 
          <View style={{ backgroundColor: theme.colors.warningLight, 
            borderRadius: rp(10), padding: rp(10), marginTop: rp(8), 
            borderLeftWidth: rp(3), borderLeftColor: theme.colors.warning }}> 
            <Text style={{ color: theme.colors.warning, fontSize: rs(12), 
              fontStyle: "italic" }}>"{note}"</Text> 
          </View> 
        ) : null} 
 
        {durationCaption ? (
          <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginTop: rp(4), fontStyle: "italic" }}>
            {durationCaption}
          </Text>
        ) : null}

        {photos && photos.length > 0 && ( 
          <ScrollView horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ gap: rp(8), marginTop: rp(10) }}> 
            {photos.map((url, i) => ( 
              <TouchableOpacity key={i} 
                onPress={() => onPhotoPress(url)}> 
                <Image source={{ uri: url }} 
                  style={{ width: rp(80), height: rp(80), 
                    borderRadius: rp(12), 
                    borderWidth: rp(1.5), 
                    borderColor: "#E5E7EB" }} /> 
              </TouchableOpacity> 
            ))} 
          </ScrollView> 
        )} 
      </View> 
    </View> 
  ); 
} 
 
function IncidentStep({ incident, isLast, onPhotoPress }) { 
  return ( 
    <View style={{ flexDirection: "row" }}> 
      <View style={{ width: rp(40), alignItems: "center" }}> 
        <View style={{ width: rp(36), height: rp(36), borderRadius: rp(18), 
          backgroundColor: theme.colors.danger, alignItems: "center", 
          justifyContent: "center", zIndex: 1 }}> 
          <Ionicons name="warning" size={18} color="#fff" /> 
        </View> 
        {!isLast && ( 
          <View style={{ width: rp(2), flex: 1, minHeight: 24, 
            backgroundColor: "#E5E7EB", marginTop: rp(2) }} /> 
        )} 
      </View> 
      <View style={{ flex: 1, paddingLeft: rp(14), 
        paddingBottom: isLast ? 0 : 24 }}> 
        <View style={{ flexDirection: "row", 
          justifyContent: "space-between", alignItems: "center" }}> 
          <Text style={{ fontWeight: "900", fontSize: rs(15), 
            color: theme.colors.danger }}>Incident Reported</Text> 
          <Text style={{ fontSize: rs(11), color: theme.colors.textMuted, 
            fontWeight: "700" }}>{fmt(incident.created_at)}</Text> 
        </View> 
        {incident.driver_name && ( 
          <View style={{ flexDirection: "row", 
            alignItems: "center", marginTop: rp(4) }}> 
            <Ionicons name="person-outline" size={12} 
              color={theme.colors.textSecondary} /> 
            <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), 
              marginLeft: rp(4), fontWeight: "700" }}> 
              {incident.driver_name} 
            </Text> 
          </View> 
        )} 
        <View style={{ backgroundColor: theme.colors.dangerLight, 
          borderRadius: rp(10), padding: rp(10), marginTop: rp(8), 
          borderLeftWidth: rp(3), borderLeftColor: theme.colors.danger }}> 
          <Text style={{ color: theme.colors.danger, fontSize: rs(12) }}> 
            {incident.description} 
          </Text> 
        </View> 
        {incident.photo_url && ( 
          <TouchableOpacity 
            onPress={() => onPhotoPress(incident.photo_url)} 
            style={{ marginTop: rp(10) }}> 
            <Image source={{ uri: incident.photo_url }} 
              style={{ width: rp(80), height: rp(80), borderRadius: rp(12), 
                borderWidth: rp(1.5), borderColor: theme.colors.dangerLight }} /> 
          </TouchableOpacity> 
        )} 
      </View> 
    </View> 
  ); 
} 
 
export default function CarLog() { 
  const insets = useSafeAreaInsets();
  const { car_id } = useLocalSearchParams(); 
  const router = useRouter(); 
  const [log, setLog] = useState(null); 
  const [loading, setLoading] = useState(true); 
  const [lightboxUrl, setLightboxUrl] = useState(null); 
 
  useEffect(() => { 
    api.get(`/cars/${car_id}/log`) 
      .then(({ data }) => setLog(data)) 
      .catch(() => {}) 
      .finally(() => setLoading(false)); 
  }, [car_id]); 
 
  if (loading) return ( 
    <View style={{ flex: 1, backgroundColor: "#F8F7FF", 
      justifyContent: "center", alignItems: "center" }}> 
      <ActivityIndicator size="large" color={theme.colors.primary} /> 
    </View> 
  ); 
 
  if (!log) return ( 
    <View style={{ flex: 1, backgroundColor: "#F8F7FF", 
      justifyContent: "center", alignItems: "center" }}> 
      <Text style={{ color: theme.colors.textSecondary }}>Log not available</Text> 
    </View> 
  ); 
 
  const { car, drivers_map, photos_by_type, incidents, 
    rating, total_minutes, park_minutes, dispatch_wait_minutes,
    fetch_minutes, retrieval_to_gate_minutes, gate_wait_minutes,
    repark_minutes } = log; 
 
  // Build timeline steps 
  const steps = []; 
 
  if (car.created_at) { 
    const registeredNote = !car.registered_by && car.guest_name
      ? `${car.guest_name}${car.guest_phone ? " · " + car.guest_phone : ""}`
      : null;
    steps.push({
      type: "status",
      status: "REGISTERED",
      time: car.created_at,
      driver: car.registered_by?.name
        ? `${car.registered_by.name}${car.registered_by.role ? ` (${car.registered_by.role})` : ""}`
        : null,
      note: registeredNote,
      photos: [],
    });
  } 
 
  if (car.check_in_time) { 
    steps.push({ type: "status", status: "CHECKED_IN", 
      time: car.driver_pickup_confirmed_at || car.check_in_time, 
      driver: drivers_map[car.check_in_driver_id], 
      note: car.notes || null, 
      photos: photos_by_type["checkin"] || [] }); 
  } 
 
  if (car.parked_at) { 
    const parkNote = [ 
      car.zone ? `Zone ${car.zone} · Slot ${car.slot}` : null, 
      car.key_tag ? `Key Tag #${car.key_tag}` : null, 
    ].filter(Boolean).join("  ·  "); 

    let durationCaption = null;
    if (car.awaiting_repark_at && new Date(car.parked_at) > new Date(car.awaiting_repark_at)) {
      if (repark_minutes != null) durationCaption = `Re-parked in ${fmtDuration(repark_minutes)}`;
    } else {
      if (park_minutes != null) durationCaption = `${fmtDuration(park_minutes)} after check-in`;
    }

    steps.push({ type: "status", status: "PARKED", 
      time: car.parked_at, 
      driver: drivers_map[car.parked_driver_id], 
      note: parkNote || null, 
      durationCaption,
      photos: photos_by_type["parked"] || [] }); 
  } 
 
  if (car.retrieval_requested_at) {
    let retrievalNote = "Guest scanned QR code to request retrieval";
    if (car.retrieval_requested_via === "supervisor_scan" && car.retrieval_requested_by) {
      const roleLabel = car.retrieval_requested_by.role
        ? car.retrieval_requested_by.role.charAt(0).toUpperCase() + car.retrieval_requested_by.role.slice(1)
        : "Staff";
      retrievalNote = `Requested by ${roleLabel} ${car.retrieval_requested_by.name || "Unknown"}`;
    }
    steps.push({ type: "status", status: "RETRIEVAL_REQUESTED",
      time: car.retrieval_requested_at,
      note: retrievalNote, photos: [] });
  }

  if (car.retrieval_driver_id) {
    if (car.accepted_at) {
      steps.push({ type: "status", status: "ACCEPTED",
        time: car.accepted_at,
        driver: drivers_map[car.retrieval_driver_id],
        photos: [] });
    }
    steps.push({ type: "status", status: "BEING_FETCHED",
      time: car.being_fetched_at || null,
      driver: drivers_map[car.retrieval_driver_id],
      durationCaption: car.accept_to_pickup_minutes != null ? `${fmtDuration(car.accept_to_pickup_minutes)} to pickup` : null,
      photos: [] });
  }

  if (car.gate_arrival_time) {
    steps.push({ type: "status", status: "ARRIVED_AT_GATE",
      time: car.gate_arrival_time,
      driver: drivers_map[car.retrieval_driver_id],
      durationCaption: fetch_minutes != null ? `${fmtDuration(fetch_minutes)} after driver picked up` : null,
      photos: [] });
  }

  if (car.awaiting_repark_at) {
    steps.push({ type: "status", status: "AWAITING_REPARK",
      time: car.awaiting_repark_at,
      note: "Guest didn't arrive in time — car needs to be re-parked",
      photos: [] });
  }

  if (car.status === "DELIVERED") {
    if (car.delivery_type === "self_pickup") {
      steps.push({ type: "status", status: "SELF_PICKUP",
        time: car.delivered_at,
        driver: car.self_pickup_marked_by?.name
          ? `${car.self_pickup_marked_by.name}${car.self_pickup_marked_by.role ? ` (${car.self_pickup_marked_by.role})` : ""}`
          : null,
        note: "Guest picked up the car themselves — no driver retrieval needed",
        photos: photos_by_type["handover"] || [],
        rating_comment: log.rating_comment || null });
    } else {
      steps.push({ type: "status", status: "DELIVERED",
        time: car.delivered_at,
        driver: drivers_map[car.retrieval_driver_id],
        durationCaption: gate_wait_minutes != null ? `${fmtDuration(gate_wait_minutes)} at the gate` : null,
        photos: photos_by_type["handover"] || [],
        rating_comment: log.rating_comment || null });
    }
  }

  // Interleave incidents by timestamp alongside other steps
  incidents.forEach(inc => {
    steps.push({ type: "incident", incident: inc,
      time: inc.created_at });
  });

  // Interleave assignment history
  (log.assignment_history || []).forEach(a => {
    steps.push({
      type: "assignment",
      assignment: a,
      time: a.created_at,
    });
  });

  // Sort: primarily by timestamp, but steps without a timestamp
  // (legacy data) fall back to a canonical status order so they
  // always appear in the correct position.
  const STATUS_ORDER = [
    "REGISTERED", "PRE_REGISTERED", "CHECKED_IN", "PARKED",
    "RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED", "SELF_PICKUP", "DELIVERED",
  ];
  steps.sort((a, b) => {
    const ta = a.time ? new Date(a.time).getTime() : null;
    const tb = b.time ? new Date(b.time).getTime() : null;
    if (ta !== null && tb !== null) return ta - tb;
    if (ta !== null) return -1;
    if (tb !== null) return 1;
    const oa = STATUS_ORDER.indexOf(a.status ?? "");
    const ob = STATUS_ORDER.indexOf(b.status ?? "");
    return (oa === -1 ? 99 : oa) - (ob === -1 ? 99 : ob);
  });
 
  const cfg = STATUS_CONFIG[car.status] || STATUS_CONFIG.CHECKED_IN; 
 
  return ( 
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }}> 
      <View style={{ zIndex: 10 }}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.colors.primary }}> 
          <View style={{
            backgroundColor: theme.colors.primary,
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
            paddingBottom: rp(36),
          }}>
            {/* Header */} 
            <View style={{ flexDirection: "row", alignItems: "center" }}> 
              <TouchableOpacity onPress={() => router.back()} 
                style={{ backgroundColor: "rgba(255,255,255,0.1)", 
                  borderRadius: rp(99), padding: rp(10) }}> 
                <Ionicons name="chevron-back" size={22} 
                  color="#fff" /> 
              </TouchableOpacity> 
              <View style={{ marginLeft: rp(14), flex: 1 }}> 
                <Text style={{ fontSize: rs(22), fontWeight: "900", 
                  color: "#fff" }}>{car.plate}</Text> 
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: rs(13) }}> 
                  {car.color} {car.make} 
                </Text> 
              </View> 
              <View style={{ paddingHorizontal: rp(12), paddingVertical: rp(6), 
                borderRadius: rp(99), backgroundColor: cfg.color }}> 
                <Text style={{ color: "#fff", fontWeight: "900", 
                  fontSize: rs(11), letterSpacing: rs(1) }}> 
                  {cfg.label.toUpperCase()} 
                </Text> 
              </View> 
            </View> 
            
            {/* Guest info right below header if exists */}
            {car.guest_name && ( 
              <View style={{ marginTop: rp(14), paddingTop: rp(14), 
                borderTopWidth: rp(1), 
                borderTopColor: "rgba(255,255,255,0.2)", 
                flexDirection: "row", alignItems: "center" }}> 
                <Ionicons name="person-circle-outline" size={16} 
                  color="rgba(255,255,255,0.7)" /> 
                <Text style={{ color: "rgba(255,255,255,0.8)", 
                  fontSize: rs(13), marginLeft: rp(6) }}> 
                  {car.guest_name} 
                  {car.guest_phone ? ` · ${car.guest_phone}` : ""} 
                </Text> 
              </View> 
            )} 

            {/* Journey Summary Pills */}
            <View style={{ flexDirection: "row", gap: rp(8), marginTop: rp(16) }}>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: rp(16), paddingVertical: rp(12), alignItems: "center" }}>
                <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#FFFFFF" }}>{total_minutes ? `${total_minutes}m` : "Active"}</Text>
                <Text style={{ fontSize: rs(9), color: "rgba(255,255,255,0.7)", fontWeight: "800", marginTop: rp(2), letterSpacing: 1 }}>TOTAL TIME</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: rp(16), paddingVertical: rp(12), alignItems: "center" }}>
                <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#FFFFFF" }}>{rating ? `${rating} ⭐` : "—"}</Text>
                <Text style={{ fontSize: rs(9), color: "rgba(255,255,255,0.7)", fontWeight: "800", marginTop: rp(2), letterSpacing: 1 }}>RATING</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: rp(16), paddingVertical: rp(12), alignItems: "center" }}>
                <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#FFFFFF" }}>{incidents.length}</Text>
                <Text style={{ fontSize: rs(9), color: "rgba(255,255,255,0.7)", fontWeight: "800", marginTop: rp(2), letterSpacing: 1 }}>INCIDENTS</Text>
              </View>
            </View>
          </View>
        </SafeAreaView> 
      </View>

      <ScrollView contentContainerStyle={{ 
        paddingHorizontal: rp(20), paddingBottom: rp(60) + (insets?.bottom || 0) + rp(64), paddingTop: rp(24) }}> 
 
        {/* Timeline */} 
        <Text style={{ fontSize: rs(11), fontWeight: "800", 
          color: theme.colors.textSecondary, letterSpacing: rs(3), marginBottom: rp(20) }}> 
          VEHICLE TIMELINE 
        </Text> 
 
        <View style={{ backgroundColor: "#fff", borderRadius: rp(24), 
          padding: rp(20), shadowColor: "#000", shadowOpacity: 0.06, 
          shadowRadius: rp(12), shadowOffset: { width: 0, height: rp(4) }, 
          elevation: 3 }}> 
          {steps.map((step, i) => { 
            const isLast = i === steps.length - 1; 
            if (step.type === "incident") { 
              return ( 
                <IncidentStep 
                  key={`inc-${i}`} 
                  incident={step.incident} 
                  isLast={isLast} 
                  onPhotoPress={setLightboxUrl} 
                /> 
              ); 
            } 
            if (step.type === "assignment") {
              const a = step.assignment;
              const isSelf = a.source === "self";
              const label = isSelf 
                ? `${a.driver_name} self-checked-in`
                : `${a.action === 'reassigned' ? 'Reassigned' : 'Assigned'} to ${a.driver_name} by ${a.performed_by?.name || "System"} (${a.performed_by?.role || "admin"})`;
              const subtitle = a.previous_driver_id && drivers_map[a.previous_driver_id] 
                ? `Previously: ${drivers_map[a.previous_driver_id]}`
                : null;
              
              return (
                <TimelineStep
                  key={`asg-${i}`}
                  color="#8B5CF6"
                  icon="swap-horizontal"
                  label={label}
                  time={step.time}
                  note={subtitle}
                  isLast={isLast}
                />
              );
            }
            const scfg = STATUS_CONFIG[step.status]; 
            if (step.status === "DELIVERED" || step.status === "SELF_PICKUP") {
              return (
                <View key={`step-wrap-${i}`}>
                  <TimelineStep 
                    color={scfg.color} 
                    icon={scfg.icon} 
                    label={scfg.label} 
                    time={step.time} 
                    driver={step.driver} 
                    note={step.note} 
                    durationCaption={step.durationCaption}
                    photos={step.photos || []} 
                    isLast={isLast} 
                    onPhotoPress={setLightboxUrl} 
                  />
                  {step.rating_comment && (
                    <View style={{
                      backgroundColor: theme.colors.successLight,
                      borderRadius: rp(10),
                      padding: rp(10),
                      marginTop: rp(8),
                      marginBottom: isLast ? 0 : 24,
                      marginLeft: rp(54),
                      borderLeftWidth: rp(3),
                      borderLeftColor: theme.colors.success,
                    }}>
                      <Text style={{
                        color: theme.colors.success,
                        fontSize: rs(12),
                        fontStyle: "italic",
                      }}>
                        "{step.rating_comment}"
                      </Text>
                    </View>
                  )}
                </View>
              );
            }
            return ( 
              <TimelineStep 
                key={`step-${i}`} 
                color={scfg.color} 
                icon={scfg.icon} 
                label={scfg.label} 
                time={step.time} 
                driver={step.driver} 
                note={step.note} 
                durationCaption={step.durationCaption}
                photos={step.photos || []} 
                isLast={isLast} 
                onPhotoPress={setLightboxUrl} 
              /> 
            ); 
          })} 
        </View> 
 
        <View style={{ height: rp(40) }} /> 
      </ScrollView> 
 
      {/* Photo lightbox */} 
      <Modal visible={!!lightboxUrl} transparent 
        animationType="fade"> 
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", 
            justifyContent: "center", alignItems: "center" }} 
          onPress={() => setLightboxUrl(null)} 
          activeOpacity={1} 
        > 
          {lightboxUrl && ( 
            <Image source={{ uri: lightboxUrl }} 
              style={{ width: "92%", height: "70%", 
                borderRadius: rp(20) }} 
              resizeMode="contain" /> 
          )} 
          <Text style={{ color: "rgba(255,255,255,0.5)", 
            marginTop: rp(16), fontSize: rs(13) }}> 
            Tap anywhere to close 
          </Text> 
        </TouchableOpacity> 
      </Modal> 
    </View> 
  ); 
}


