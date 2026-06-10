import { useState, useEffect } from "react"; 
import { 
  View, Text, ScrollView, ActivityIndicator, 
  TouchableOpacity, Image, Modal 
} from "react-native"; 
import { useLocalSearchParams, useRouter } from "expo-router"; 
import { Ionicons } from "@expo/vector-icons"; 
import { SafeAreaView } from "react-native-safe-area-context"; 
import api from "../../lib/api"; 
 
const STATUS_CONFIG = { 
  PRE_REGISTERED: { color: "#8B5CF6", icon: "time-outline", 
    label: "Pre-Registered" }, 
  CHECKED_IN:     { color: "#0EA5E9", icon: "log-in-outline", 
    label: "Checked In" }, 
  PARKED:         { color: "#059669", icon: "car-outline", 
    label: "Parked" }, 
  RETRIEVAL_REQUESTED: { color: "#F59E0B", 
    icon: "notifications-outline", label: "Retrieval Requested" }, 
  BEING_FETCHED:  { color: "#F97316", icon: "walk-outline", 
    label: "Being Fetched" }, 
  DELIVERED:      { color: "#10B981", icon: "checkmark-circle", 
    label: "Delivered" }, 
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
  note, photos, isLast, onPhotoPress }) { 
  return ( 
    <View style={{ flexDirection: "row" }}> 
      {/* Line + dot */} 
      <View style={{ width: 40, alignItems: "center" }}> 
        <View style={{ width: 36, height: 36, borderRadius: 18, 
          backgroundColor: color, alignItems: "center", 
          justifyContent: "center", zIndex: 1 }}> 
          <Ionicons name={icon} size={18} color="#fff" /> 
        </View> 
        {!isLast && ( 
          <View style={{ width: 2, flex: 1, minHeight: 24, 
            backgroundColor: "#E5E7EB", marginTop: 2 }} /> 
        )} 
      </View> 
 
      {/* Content */} 
      <View style={{ flex: 1, paddingLeft: 14, 
        paddingBottom: isLast ? 0 : 24 }}> 
        <View style={{ flexDirection: "row", 
          justifyContent: "space-between", alignItems: "center" }}> 
          <Text style={{ fontWeight: "900", fontSize: 15, 
            color: "#111827" }}>{label}</Text> 
          <Text style={{ fontSize: 11, color: "#9CA3AF", 
            fontWeight: "700" }}>{fmt(time)}</Text> 
        </View> 
 
        {driver && ( 
          <View style={{ flexDirection: "row", 
            alignItems: "center", marginTop: 4 }}> 
            <Ionicons name="person-outline" size={12} 
              color="#6B7280" /> 
            <Text style={{ color: "#6B7280", fontSize: 12, 
              marginLeft: 4, fontWeight: "700" }}>{driver}</Text> 
          </View> 
        )} 
 
        {note ? ( 
          <View style={{ backgroundColor: "#FEF9C3", 
            borderRadius: 10, padding: 10, marginTop: 8, 
            borderLeftWidth: 3, borderLeftColor: "#FDE047" }}> 
            <Text style={{ color: "#713F12", fontSize: 12, 
              fontStyle: "italic" }}>"{note}"</Text> 
          </View> 
        ) : null} 
 
        {photos && photos.length > 0 && ( 
          <ScrollView horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ gap: 8, marginTop: 10 }}> 
            {photos.map((url, i) => ( 
              <TouchableOpacity key={i} 
                onPress={() => onPhotoPress(url)}> 
                <Image source={{ uri: url }} 
                  style={{ width: 80, height: 80, 
                    borderRadius: 12, 
                    borderWidth: 1.5, 
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
      <View style={{ width: 40, alignItems: "center" }}> 
        <View style={{ width: 36, height: 36, borderRadius: 18, 
          backgroundColor: "#EF4444", alignItems: "center", 
          justifyContent: "center", zIndex: 1 }}> 
          <Ionicons name="warning" size={18} color="#fff" /> 
        </View> 
        {!isLast && ( 
          <View style={{ width: 2, flex: 1, minHeight: 24, 
            backgroundColor: "#E5E7EB", marginTop: 2 }} /> 
        )} 
      </View> 
      <View style={{ flex: 1, paddingLeft: 14, 
        paddingBottom: isLast ? 0 : 24 }}> 
        <View style={{ flexDirection: "row", 
          justifyContent: "space-between", alignItems: "center" }}> 
          <Text style={{ fontWeight: "900", fontSize: 15, 
            color: "#EF4444" }}>Incident Reported</Text> 
          <Text style={{ fontSize: 11, color: "#9CA3AF", 
            fontWeight: "700" }}>{fmt(incident.created_at)}</Text> 
        </View> 
        {incident.driver_name && ( 
          <View style={{ flexDirection: "row", 
            alignItems: "center", marginTop: 4 }}> 
            <Ionicons name="person-outline" size={12} 
              color="#6B7280" /> 
            <Text style={{ color: "#6B7280", fontSize: 12, 
              marginLeft: 4, fontWeight: "700" }}> 
              {incident.driver_name} 
            </Text> 
          </View> 
        )} 
        <View style={{ backgroundColor: "#FEE2E2", 
          borderRadius: 10, padding: 10, marginTop: 8, 
          borderLeftWidth: 3, borderLeftColor: "#EF4444" }}> 
          <Text style={{ color: "#991B1B", fontSize: 12 }}> 
            {incident.description} 
          </Text> 
        </View> 
        {incident.photo_url && ( 
          <TouchableOpacity 
            onPress={() => onPhotoPress(incident.photo_url)} 
            style={{ marginTop: 10 }}> 
            <Image source={{ uri: incident.photo_url }} 
              style={{ width: 80, height: 80, borderRadius: 12, 
                borderWidth: 1.5, borderColor: "#FECACA" }} /> 
          </TouchableOpacity> 
        )} 
      </View> 
    </View> 
  ); 
} 
 
export default function CarLog() { 
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
      <ActivityIndicator size="large" color="#7C3AED" /> 
    </View> 
  ); 
 
  if (!log) return ( 
    <View style={{ flex: 1, backgroundColor: "#F8F7FF", 
      justifyContent: "center", alignItems: "center" }}> 
      <Text style={{ color: "#6B7280" }}>Log not available</Text> 
    </View> 
  ); 
 
  const { car, drivers_map, photos_by_type, incidents, 
    rating, total_minutes } = log; 
 
  // Build timeline steps 
  const steps = []; 
 
  if (car.created_at && car.guest_name) { 
    steps.push({ type: "status", status: "PRE_REGISTERED", 
      time: car.created_at, 
      note: `${car.guest_name} · ${car.guest_phone || ""}`, 
      photos: [] }); 
  } 
 
  if (car.check_in_time) { 
    steps.push({ type: "status", status: "CHECKED_IN", 
      time: car.check_in_time, 
      driver: drivers_map[car.check_in_driver_id], 
      note: car.notes || null, 
      photos: photos_by_type["checkin"] || [] }); 
  } 
 
  if (car.parked_at) { 
    const parkNote = [ 
      car.zone ? `Zone ${car.zone} · Slot ${car.slot}` : null, 
      car.key_tag ? `Key Tag #${car.key_tag}` : null, 
    ].filter(Boolean).join("  ·  "); 
    steps.push({ type: "status", status: "PARKED", 
      time: car.parked_at, 
      driver: drivers_map[car.parked_driver_id], 
      note: parkNote || null, 
      photos: photos_by_type["parked"] || [] }); 
  } 
 
  if (car.status === "RETRIEVAL_REQUESTED" ||
      car.status === "BEING_FETCHED" ||
      car.status === "DELIVERED") {
    steps.push({ type: "status",
      status: "RETRIEVAL_REQUESTED",
      time: car.retrieval_requested_at || null,
      note: "Guest scanned QR code", photos: [] });
  }

  if (car.retrieval_driver_id) {
    steps.push({ type: "status", status: "BEING_FETCHED",
      time: car.being_fetched_at || null,
      driver: drivers_map[car.retrieval_driver_id],
      photos: [] });
  }

  if (car.status === "DELIVERED") {
    steps.push({ type: "status", status: "DELIVERED",
      time: car.delivered_at,
      driver: drivers_map[car.retrieval_driver_id],
      photos: photos_by_type["handover"] || [],
      rating_comment: log.rating_comment || null });
  }

  // Interleave incidents by timestamp alongside other steps
  incidents.forEach(inc => {
    steps.push({ type: "incident", incident: inc,
      time: inc.created_at });
  });

  // Sort: primarily by timestamp, but steps without a timestamp
  // (legacy data) fall back to a canonical status order so they
  // always appear in the correct position.
  const STATUS_ORDER = [
    "PRE_REGISTERED", "CHECKED_IN", "PARKED",
    "RETRIEVAL_REQUESTED", "BEING_FETCHED", "DELIVERED",
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
    <View style={{ flex: 1, backgroundColor: "#F8F7FF" }}> 
      <SafeAreaView edges={["top"]}> 
        {/* Header */} 
        <View style={{ flexDirection: "row", alignItems: "center", 
          paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}> 
          <TouchableOpacity onPress={() => router.back()} 
            style={{ backgroundColor: "rgba(124,58,237,0.1)", 
              borderRadius: 99, padding: 10 }}> 
            <Ionicons name="chevron-back" size={22} 
              color="#7C3AED" /> 
          </TouchableOpacity> 
          <View style={{ marginLeft: 14, flex: 1 }}> 
            <Text style={{ fontSize: 22, fontWeight: "900", 
              color: "#111827" }}>{car.plate}</Text> 
            <Text style={{ color: "#6B7280", fontSize: 13 }}> 
              {car.color} {car.make} 
            </Text> 
          </View> 
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, 
            borderRadius: 99, backgroundColor: cfg.color }}> 
            <Text style={{ color: "#fff", fontWeight: "900", 
              fontSize: 11, letterSpacing: 1 }}> 
              {cfg.label.toUpperCase()} 
            </Text> 
          </View> 
        </View> 
      </SafeAreaView> 
 
      <ScrollView contentContainerStyle={{ 
        paddingHorizontal: 20, paddingBottom: 60 }}> 
 
        {/* Summary card */} 
        <View style={{ backgroundColor: "#7C3AED", 
          borderRadius: 24, padding: 20, marginBottom: 24, 
          shadowColor: "#7C3AED", shadowOpacity: 0.3, 
          shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, 
          elevation: 8 }}> 
          <Text style={{ fontSize: 11, fontWeight: "800", 
            color: "rgba(255,255,255,0.7)", letterSpacing: 3 }}> 
            VEHICLE JOURNEY SUMMARY 
          </Text> 
          <View style={{ flexDirection: "row", marginTop: 16, 
            justifyContent: "space-between" }}> 
            {[ 
              { label: "TOTAL TIME", 
                value: total_minutes 
                  ? `${total_minutes}m` : "Active" }, 
              { label: "RATING", 
                value: rating ? `${rating}/5 ⭐` : "—" }, 
              { label: "INCIDENTS", 
                value: incidents.length.toString() }, 
            ].map(s => ( 
              <View key={s.label} style={{ alignItems: "center" }}> 
                <Text style={{ fontSize: 22, fontWeight: "900", 
                  color: "#fff" }}>{s.value}</Text> 
                <Text style={{ fontSize: 10, fontWeight: "800", 
                  color: "rgba(255,255,255,0.6)", 
                  letterSpacing: 2, marginTop: 4 }}> 
                  {s.label} 
                </Text> 
              </View> 
            ))} 
          </View> 
          {car.guest_name && ( 
            <View style={{ marginTop: 14, paddingTop: 14, 
              borderTopWidth: 1, 
              borderTopColor: "rgba(255,255,255,0.2)", 
              flexDirection: "row", alignItems: "center" }}> 
              <Ionicons name="person-circle-outline" size={16} 
                color="rgba(255,255,255,0.7)" /> 
              <Text style={{ color: "rgba(255,255,255,0.8)", 
                fontSize: 13, marginLeft: 6 }}> 
                {car.guest_name} 
                {car.guest_phone ? ` · ${car.guest_phone}` : ""} 
              </Text> 
            </View> 
          )} 
        </View> 
 
        {/* Timeline */} 
        <Text style={{ fontSize: 11, fontWeight: "800", 
          color: "#6B7280", letterSpacing: 3, marginBottom: 20 }}> 
          VEHICLE TIMELINE 
        </Text> 
 
        <View style={{ backgroundColor: "#fff", borderRadius: 24, 
          padding: 20, shadowColor: "#000", shadowOpacity: 0.06, 
          shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, 
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
            const scfg = STATUS_CONFIG[step.status]; 
            if (step.status === "DELIVERED") {
              return (
                <View key={`step-wrap-${i}`}>
                  <TimelineStep 
                    color={scfg.color} 
                    icon={scfg.icon} 
                    label={scfg.label} 
                    time={step.time} 
                    driver={step.driver} 
                    note={step.note} 
                    photos={step.photos || []} 
                    isLast={isLast} 
                    onPhotoPress={setLightboxUrl} 
                  />
                  {step.rating_comment && (
                    <View style={{
                      backgroundColor: "#F0FDF4",
                      borderRadius: 10,
                      padding: 10,
                      marginTop: 8,
                      marginBottom: isLast ? 0 : 24,
                      marginLeft: 54,
                      borderLeftWidth: 3,
                      borderLeftColor: "#059669",
                    }}>
                      <Text style={{
                        color: "#065F46",
                        fontSize: 12,
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
                photos={step.photos || []} 
                isLast={isLast} 
                onPhotoPress={setLightboxUrl} 
              /> 
            ); 
          })} 
        </View> 
 
        <View style={{ height: 40 }} /> 
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
                borderRadius: 20 }} 
              resizeMode="contain" /> 
          )} 
          <Text style={{ color: "rgba(255,255,255,0.5)", 
            marginTop: 16, fontSize: 13 }}> 
            Tap anywhere to close 
          </Text> 
        </TouchableOpacity> 
      </Modal> 
    </View> 
  ); 
}





// import { useState, useEffect } from "react"; 
// import { 
//   View, Text, ScrollView, ActivityIndicator, 
//   TouchableOpacity, Image, Modal 
// } from "react-native"; 
// import { useLocalSearchParams, useRouter } from "expo-router"; 
// import { Ionicons } from "@expo/vector-icons"; 
// import { SafeAreaView } from "react-native-safe-area-context"; 
// import api from "../../lib/api"; 
 
// const STATUS_CONFIG = { 
//   PRE_REGISTERED: { color: "#8B5CF6", icon: "time-outline", 
//     label: "Pre-Registered" }, 
//   CHECKED_IN:     { color: "#0EA5E9", icon: "log-in-outline", 
//     label: "Checked In" }, 
//   PARKED:         { color: "#059669", icon: "car-outline", 
//     label: "Parked" }, 
//   RETRIEVAL_REQUESTED: { color: "#F59E0B", 
//     icon: "notifications-outline", label: "Retrieval Requested" }, 
//   BEING_FETCHED:  { color: "#F97316", icon: "walk-outline", 
//     label: "Being Fetched" }, 
//   DELIVERED:      { color: "#10B981", icon: "checkmark-circle", 
//     label: "Delivered" }, 
// }; 
 
// function fmt(iso) { 
//   if (!iso) return "—"; 
//   const d = new Date(iso); 
//   return d.toLocaleString("en-IN", { 
//     day: "numeric", month: "short", 
//     hour: "2-digit", minute: "2-digit" 
//   }); 
// } 
 
// function TimelineStep({ color, icon, label, time, driver, 
//   note, photos, isLast, onPhotoPress }) { 
//   return ( 
//     <View style={{ flexDirection: "row" }}> 
//       {/* Line + dot */} 
//       <View style={{ width: 40, alignItems: "center" }}> 
//         <View style={{ width: 36, height: 36, borderRadius: 18, 
//           backgroundColor: color, alignItems: "center", 
//           justifyContent: "center", zIndex: 1 }}> 
//           <Ionicons name={icon} size={18} color="#fff" /> 
//         </View> 
//         {!isLast && ( 
//           <View style={{ width: 2, flex: 1, minHeight: 24, 
//             backgroundColor: "#E5E7EB", marginTop: 2 }} /> 
//         )} 
//       </View> 
 
//       {/* Content */} 
//       <View style={{ flex: 1, paddingLeft: 14, 
//         paddingBottom: isLast ? 0 : 24 }}> 
//         <View style={{ flexDirection: "row", 
//           justifyContent: "space-between", alignItems: "center" }}> 
//           <Text style={{ fontWeight: "900", fontSize: 15, 
//             color: "#111827" }}>{label}</Text> 
//           <Text style={{ fontSize: 11, color: "#9CA3AF", 
//             fontWeight: "700" }}>{fmt(time)}</Text> 
//         </View> 
 
//         {driver && ( 
//           <View style={{ flexDirection: "row", 
//             alignItems: "center", marginTop: 4 }}> 
//             <Ionicons name="person-outline" size={12} 
//               color="#6B7280" /> 
//             <Text style={{ color: "#6B7280", fontSize: 12, 
//               marginLeft: 4, fontWeight: "700" }}>{driver}</Text> 
//           </View> 
//         )} 
 
//         {note ? ( 
//           <View style={{ backgroundColor: "#FEF9C3", 
//             borderRadius: 10, padding: 10, marginTop: 8, 
//             borderLeftWidth: 3, borderLeftColor: "#FDE047" }}> 
//             <Text style={{ color: "#713F12", fontSize: 12, 
//               fontStyle: "italic" }}>"{note}"</Text> 
//           </View> 
//         ) : null} 
 
//         {photos && photos.length > 0 && ( 
//           <ScrollView horizontal 
//             showsHorizontalScrollIndicator={false} 
//             contentContainerStyle={{ gap: 8, marginTop: 10 }}> 
//             {photos.map((url, i) => ( 
//               <TouchableOpacity key={i} 
//                 onPress={() => onPhotoPress(url)}> 
//                 <Image source={{ uri: url }} 
//                   style={{ width: 80, height: 80, 
//                     borderRadius: 12, 
//                     borderWidth: 1.5, 
//                     borderColor: "#E5E7EB" }} /> 
//               </TouchableOpacity> 
//             ))} 
//           </ScrollView> 
//         )} 
//       </View> 
//     </View> 
//   ); 
// } 
 
// function IncidentStep({ incident, isLast, onPhotoPress }) { 
//   return ( 
//     <View style={{ flexDirection: "row" }}> 
//       <View style={{ width: 40, alignItems: "center" }}> 
//         <View style={{ width: 36, height: 36, borderRadius: 18, 
//           backgroundColor: "#EF4444", alignItems: "center", 
//           justifyContent: "center", zIndex: 1 }}> 
//           <Ionicons name="warning" size={18} color="#fff" /> 
//         </View> 
//         {!isLast && ( 
//           <View style={{ width: 2, flex: 1, minHeight: 24, 
//             backgroundColor: "#E5E7EB", marginTop: 2 }} /> 
//         )} 
//       </View> 
//       <View style={{ flex: 1, paddingLeft: 14, 
//         paddingBottom: isLast ? 0 : 24 }}> 
//         <View style={{ flexDirection: "row", 
//           justifyContent: "space-between", alignItems: "center" }}> 
//           <Text style={{ fontWeight: "900", fontSize: 15, 
//             color: "#EF4444" }}>Incident Reported</Text> 
//           <Text style={{ fontSize: 11, color: "#9CA3AF", 
//             fontWeight: "700" }}>{fmt(incident.created_at)}</Text> 
//         </View> 
//         {incident.driver_name && ( 
//           <View style={{ flexDirection: "row", 
//             alignItems: "center", marginTop: 4 }}> 
//             <Ionicons name="person-outline" size={12} 
//               color="#6B7280" /> 
//             <Text style={{ color: "#6B7280", fontSize: 12, 
//               marginLeft: 4, fontWeight: "700" }}> 
//               {incident.driver_name} 
//             </Text> 
//           </View> 
//         )} 
//         <View style={{ backgroundColor: "#FEE2E2", 
//           borderRadius: 10, padding: 10, marginTop: 8, 
//           borderLeftWidth: 3, borderLeftColor: "#EF4444" }}> 
//           <Text style={{ color: "#991B1B", fontSize: 12 }}> 
//             {incident.description} 
//           </Text> 
//         </View> 
//         {incident.photo_url && ( 
//           <TouchableOpacity 
//             onPress={() => onPhotoPress(incident.photo_url)} 
//             style={{ marginTop: 10 }}> 
//             <Image source={{ uri: incident.photo_url }} 
//               style={{ width: 80, height: 80, borderRadius: 12, 
//                 borderWidth: 1.5, borderColor: "#FECACA" }} /> 
//           </TouchableOpacity> 
//         )} 
//       </View> 
//     </View> 
//   ); 
// } 
 
// export default function CarLog() { 
//   const { car_id } = useLocalSearchParams(); 
//   const router = useRouter(); 
//   const [log, setLog] = useState(null); 
//   const [loading, setLoading] = useState(true); 
//   const [lightboxUrl, setLightboxUrl] = useState(null); 
 
//   useEffect(() => { 
//     api.get(`/cars/${car_id}/log`) 
//       .then(({ data }) => setLog(data)) 
//       .catch(() => {}) 
//       .finally(() => setLoading(false)); 
//   }, [car_id]); 
 
//   if (loading) return ( 
//     <View style={{ flex: 1, backgroundColor: "#F8F7FF", 
//       justifyContent: "center", alignItems: "center" }}> 
//       <ActivityIndicator size="large" color="#7C3AED" /> 
//     </View> 
//   ); 
 
//   if (!log) return ( 
//     <View style={{ flex: 1, backgroundColor: "#F8F7FF", 
//       justifyContent: "center", alignItems: "center" }}> 
//       <Text style={{ color: "#6B7280" }}>Log not available</Text> 
//     </View> 
//   ); 
 
//   const { car, drivers_map, photos_by_type, incidents, 
//     rating, total_minutes } = log; 
 
//   // Build timeline steps 
//   const steps = []; 
 
//   if (car.created_at && car.guest_name) { 
//     steps.push({ type: "status", status: "PRE_REGISTERED", 
//       time: car.created_at, 
//       note: `${car.guest_name} · ${car.guest_phone || ""}`, 
//       photos: [] }); 
//   } 
 
//   if (car.check_in_time) { 
//     steps.push({ type: "status", status: "CHECKED_IN", 
//       time: car.check_in_time, 
//       driver: drivers_map[car.check_in_driver_id], 
//       note: car.notes || null, 
//       photos: photos_by_type["checkin"] || [] }); 
//   } 
 
//   if (car.parked_at) { 
//     const parkNote = [ 
//       car.zone ? `Zone ${car.zone} · Slot ${car.slot}` : null, 
//       car.key_tag ? `Key Tag #${car.key_tag}` : null, 
//     ].filter(Boolean).join("  ·  "); 
//     steps.push({ type: "status", status: "PARKED", 
//       time: car.parked_at, 
//       driver: drivers_map[car.parked_driver_id], 
//       note: parkNote || null, 
//       photos: photos_by_type["parked"] || [] }); 
//   } 
 
//   // Interleave incidents by timestamp 
//   incidents.forEach(inc => { 
//     steps.push({ type: "incident", incident: inc, 
//       time: inc.created_at }); 
//   }); 
 
//   if (car.status === "RETRIEVAL_REQUESTED" || 
//       car.status === "BEING_FETCHED" || 
//       car.status === "DELIVERED") { 
//     steps.push({ type: "status", 
//       status: "RETRIEVAL_REQUESTED", 
//       time: null, note: "Guest scanned QR code", photos: [] }); 
//   } 
 
//   if (car.retrieval_driver_id) { 
//     steps.push({ type: "status", status: "BEING_FETCHED", 
//       time: null, 
//       driver: drivers_map[car.retrieval_driver_id], 
//       photos: [] }); 
//   } 
 
//   if (car.status === "DELIVERED") { 
//     steps.push({ type: "status", status: "DELIVERED", 
//       time: car.delivered_at, 
//       driver: drivers_map[car.retrieval_driver_id], 
//       photos: photos_by_type["handover"] || [] }); 
//   } 
 
//   // Sort by time where available 
//   steps.sort((a, b) => { 
//     const ta = a.time ? new Date(a.time).getTime() : 0; 
//     const tb = b.time ? new Date(b.time).getTime() : 0; 
//     return ta - tb; 
//   }); 
 
//   const cfg = STATUS_CONFIG[car.status] || STATUS_CONFIG.CHECKED_IN; 
 
//   return ( 
//     <View style={{ flex: 1, backgroundColor: "#F8F7FF" }}> 
//       <SafeAreaView edges={["top"]}> 
//         {/* Header */} 
//         <View style={{ flexDirection: "row", alignItems: "center", 
//           paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}> 
//           <TouchableOpacity onPress={() => router.back()} 
//             style={{ backgroundColor: "rgba(124,58,237,0.1)", 
//               borderRadius: 99, padding: 10 }}> 
//             <Ionicons name="chevron-back" size={22} 
//               color="#7C3AED" /> 
//           </TouchableOpacity> 
//           <View style={{ marginLeft: 14, flex: 1 }}> 
//             <Text style={{ fontSize: 22, fontWeight: "900", 
//               color: "#111827" }}>{car.plate}</Text> 
//             <Text style={{ color: "#6B7280", fontSize: 13 }}> 
//               {car.color} {car.make} 
//             </Text> 
//           </View> 
//           <View style={{ paddingHorizontal: 12, paddingVertical: 6, 
//             borderRadius: 99, backgroundColor: cfg.color }}> 
//             <Text style={{ color: "#fff", fontWeight: "900", 
//               fontSize: 11, letterSpacing: 1 }}> 
//               {cfg.label.toUpperCase()} 
//             </Text> 
//           </View> 
//         </View> 
//       </SafeAreaView> 
 
//       <ScrollView contentContainerStyle={{ 
//         paddingHorizontal: 20, paddingBottom: 60 }}> 
 
//         {/* Summary card */} 
//         <View style={{ backgroundColor: "#7C3AED", 
//           borderRadius: 24, padding: 20, marginBottom: 24, 
//           shadowColor: "#7C3AED", shadowOpacity: 0.3, 
//           shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, 
//           elevation: 8 }}> 
//           <Text style={{ fontSize: 11, fontWeight: "800", 
//             color: "rgba(255,255,255,0.7)", letterSpacing: 3 }}> 
//             VEHICLE JOURNEY SUMMARY 
//           </Text> 
//           <View style={{ flexDirection: "row", marginTop: 16, 
//             justifyContent: "space-between" }}> 
//             {[ 
//               { label: "TOTAL TIME", 
//                 value: total_minutes 
//                   ? `${total_minutes}m` : "Active" }, 
//               { label: "RATING", 
//                 value: rating ? `${rating}/5 ⭐` : "—" }, 
//               { label: "INCIDENTS", 
//                 value: incidents.length.toString() }, 
//             ].map(s => ( 
//               <View key={s.label} style={{ alignItems: "center" }}> 
//                 <Text style={{ fontSize: 22, fontWeight: "900", 
//                   color: "#fff" }}>{s.value}</Text> 
//                 <Text style={{ fontSize: 10, fontWeight: "800", 
//                   color: "rgba(255,255,255,0.6)", 
//                   letterSpacing: 2, marginTop: 4 }}> 
//                   {s.label} 
//                 </Text> 
//               </View> 
//             ))} 
//           </View> 
//           {car.guest_name && ( 
//             <View style={{ marginTop: 14, paddingTop: 14, 
//               borderTopWidth: 1, 
//               borderTopColor: "rgba(255,255,255,0.2)", 
//               flexDirection: "row", alignItems: "center" }}> 
//               <Ionicons name="person-circle-outline" size={16} 
//                 color="rgba(255,255,255,0.7)" /> 
//               <Text style={{ color: "rgba(255,255,255,0.8)", 
//                 fontSize: 13, marginLeft: 6 }}> 
//                 {car.guest_name} 
//                 {car.guest_phone ? ` · ${car.guest_phone}` : ""} 
//               </Text> 
//             </View> 
//           )} 
//         </View> 
 
//         {/* Timeline */} 
//         <Text style={{ fontSize: 11, fontWeight: "800", 
//           color: "#6B7280", letterSpacing: 3, marginBottom: 20 }}> 
//           VEHICLE TIMELINE 
//         </Text> 
 
//         <View style={{ backgroundColor: "#fff", borderRadius: 24, 
//           padding: 20, shadowColor: "#000", shadowOpacity: 0.06, 
//           shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, 
//           elevation: 3 }}> 
//           {steps.map((step, i) => { 
//             const isLast = i === steps.length - 1; 
//             if (step.type === "incident") { 
//               return ( 
//                 <IncidentStep 
//                   key={`inc-${i}`} 
//                   incident={step.incident} 
//                   isLast={isLast} 
//                   onPhotoPress={setLightboxUrl} 
//                 /> 
//               ); 
//             } 
//             const scfg = STATUS_CONFIG[step.status]; 
//             return ( 
//               <TimelineStep 
//                 key={`step-${i}`} 
//                 color={scfg.color} 
//                 icon={scfg.icon} 
//                 label={scfg.label} 
//                 time={step.time} 
//                 driver={step.driver} 
//                 note={step.note} 
//                 photos={step.photos || []} 
//                 isLast={isLast} 
//                 onPhotoPress={setLightboxUrl} 
//               /> 
//             ); 
//           })} 
//         </View> 
 
//         <View style={{ height: 40 }} /> 
//       </ScrollView> 
 
//       {/* Photo lightbox */} 
//       <Modal visible={!!lightboxUrl} transparent 
//         animationType="fade"> 
//         <TouchableOpacity 
//           style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", 
//             justifyContent: "center", alignItems: "center" }} 
//           onPress={() => setLightboxUrl(null)} 
//           activeOpacity={1} 
//         > 
//           {lightboxUrl && ( 
//             <Image source={{ uri: lightboxUrl }} 
//               style={{ width: "92%", height: "70%", 
//                 borderRadius: 20 }} 
//               resizeMode="contain" /> 
//           )} 
//           <Text style={{ color: "rgba(255,255,255,0.5)", 
//             marginTop: 16, fontSize: 13 }}> 
//             Tap anywhere to close 
//           </Text> 
//         </TouchableOpacity> 
//       </Modal> 
//     </View> 
//   ); 
// }