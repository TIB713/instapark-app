import { useEffect, useState } from "react";
import { rs, rp } from '../../utils/responsive';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../lib/api";

const ACCENT_COLOR = "#7C3AED";

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function DriverEventCars() {
  const router = useRouter();
  const { driverId, eventId, eventName, driverName } = useLocalSearchParams();
  const [tab, setTab] = useState("parked");
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState([]);
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [carsRes, incidentsRes] = await Promise.all([
          api.get(`/superadmin/events/${eventId}/cars`),
          api.get(`/incidents/driver/${driverId}`),
        ]);
        setCars(carsRes.data || []);
        setIncidents((incidentsRes.data || []).filter(i => i.event_id === eventId));
      } catch (e) {
        console.error("Failed to fetch driver event details", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [driverId, eventId]);

  const parkedCars = cars.filter(c => c.check_in_driver_id === driverId);
  const retrievedCars = cars.filter(c => c.retrieval_driver_id === driverId);

  const formatTime = (timestamp) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "CHECKED_IN":
        return { bg: "#DBEAFE", text: "#1D4ED8" };
      case "PARKED":
        return { bg: "#FEF3C7", text: "#D97706" };
      case "RETRIEVAL_REQUESTED":
        return { bg: "#FFEDD5", text: "#EA580C" };
      case "ACCEPTED":
        return { bg: "#FEF3C7", text: "#D97706" };
      case "BEING_FETCHED":
        return { bg: "#F3E8FF", text: "#7C3AED" };
      case "DELIVERED":
        return { bg: "#D1FAE5", text: "#059669" };
      default:
        return { bg: "#F3F4F6", text: "#6B7280" };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: ACCENT_COLOR }}>
        <View
          style={{
            backgroundColor: ACCENT_COLOR,
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
            paddingBottom: rp(24),
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(255,255,255,0.1)",
              borderBottomLeftRadius: 44,
              borderBottomRightRadius: 44,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8) }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ marginLeft: rp(14), flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: rs(11), fontWeight: "800", letterSpacing: rs(1.5) }}>DRIVER</Text>
              <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900" }}>{driverName}</Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: rs(13), marginTop: rp(2) }}>{eventName}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Tabs */}
      <View style={{ flexDirection: "row", backgroundColor: "#fff", marginHorizontal: rp(16), marginTop: -22, borderRadius: rp(20), padding: rp(4), ...cardShadow }}>
        {[
          ["parked", "Parked"],
          ["retrieved", "Retrieved"],
          ["incidents", "Incidents"]
        ].map(([k, l]) => (
          <TouchableOpacity
            key={k}
            onPress={() => setTab(k)}
            style={{
              flex: 1,
              paddingVertical: rp(10),
              borderRadius: rp(16),
              backgroundColor: tab === k ? ACCENT_COLOR : "transparent",
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: rs(13), color: tab === k ? "#fff" : "#6B7280", letterSpacing: rs(1) }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: rp(16), paddingBottom: rp(40) }}>
        {tab === "parked" && (
          parkedCars.length === 0 ? (
            <EmptyState icon="clipboard-outline" message="No cars in this category" />
          ) : (
            parkedCars.map(car => (
              <CarCard key={car.id} car={car} time={formatTime(car.check_in_time)} />
            ))
          )
        )}

        {tab === "retrieved" && (
          retrievedCars.length === 0 ? (
            <EmptyState icon="clipboard-outline" message="No cars in this category" />
          ) : (
            retrievedCars.map(car => (
              <CarCard key={car.id} car={car} time={formatTime(car.delivered_at)} forceDelivered={true} />
            ))
          )
        )}

        {tab === "incidents" && (
          incidents.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: rp(60) }}>
              <View style={{ backgroundColor: "#D1FAE5", width: rp(64), height: rp(64), borderRadius: rp(32), alignItems: "center", justifyContent: "center", marginBottom: rp(16) }}>
                <Ionicons name="checkmark" size={32} color="#059669" />
              </View>
              <Text style={{ color: "#059669", fontWeight: "900", fontSize: rs(16) }}>No incidents in this event</Text>
            </View>
          ) : (
            incidents.map(inc => (
              <View key={inc.id} style={{ backgroundColor: "#FFF1F2", borderRadius: rp(16), padding: rp(14), borderLeftWidth: rp(3), borderLeftColor: "#EF4444", marginBottom: rp(10) }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(8) }}>
                  <Text style={{ color: "#991B1B", fontWeight: "900", fontSize: rs(15) }}>{inc.plate}</Text>
                  <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "700" }}>{formatTime(inc.created_at)}</Text>
                </View>
                <Text style={{ color: "#7F1D1D", fontSize: rs(14), lineHeight: 20 }}>{inc.description}</Text>
              </View>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

function CarCard({ car, time, forceDelivered = false }) { 
   const status = forceDelivered ? "DELIVERED" : car.status; 
 
   const statusStyle = (s) => { 
     switch (s) { 
       case "CHECKED_IN":          return { bg: "#DBEAFE", text: "#1D4ED8" }; 
       case "PARKED":              return { bg: "#FEF3C7", text: "#D97706" }; 
       case "RETRIEVAL_REQUESTED": return { bg: "#FFEDD5", text: "#EA580C" }; 
       case "ACCEPTED":            return { bg: "#FEF3C7", text: "#D97706" };
    case "BEING_FETCHED":       return { bg: "#F3E8FF", text: "#7C3AED" }; 
       case "DELIVERED":           return { bg: "#D1FAE5", text: "#059669" }; 
       default:                    return { bg: "#F3F4F6", text: "#6B7280" }; 
     } 
   }; 
   const style = statusStyle(status); 
 
   const fmt = (ts) => 
     ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: 'Asia/Kolkata' }) : null; 
 
   return ( 
     <View style={{ backgroundColor: "#fff", borderRadius: rp(20), padding: rp(16), marginBottom: rp(12), ...cardShadow }}> 
 
       {/* Row 1: plate badge + status badge */} 
       <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rp(10) }}> 
         <View style={{ backgroundColor: "#111827", paddingHorizontal: rp(12), paddingVertical: rp(5), borderRadius: rp(8) }}> 
           <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(15), letterSpacing: rs(1) }}> 
             {car.plate} 
           </Text> 
         </View> 
         <View style={{ backgroundColor: style.bg, paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(99) }}> 
           <Text style={{ color: style.text, fontSize: rs(10), fontWeight: "900" }}> 
             {status.replace(/_/g, " ")} 
           </Text> 
         </View> 
       </View> 
 
       {/* Row 2: make · color */} 
       <Text style={{ fontSize: rs(14), fontWeight: "700", color: "#374151", marginBottom: rp(8) }}> 
         {car.make}{car.color ? `  ·  ${car.color}` : ""} 
       </Text> 
 
       {/* Row 3: guest name if present */} 
       {car.guest_name ? ( 
         <View style={{ flexDirection: "row", alignItems: "center", gap: rp(6), marginBottom: rp(8) }}> 
           <Ionicons name="person-outline" size={13} color="#9CA3AF" /> 
           <Text style={{ fontSize: rs(12), color: "#6B7280", fontWeight: "600" }}>{car.guest_name}</Text> 
         </View> 
       ) : null} 
 
       {/* Row 4: zone/slot and gate pills */} 
       {(car.zone && car.slot) || car.gate ? ( 
         <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(8), marginBottom: rp(8) }}> 
           {car.zone && car.slot ? ( 
             <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4), backgroundColor: "#F3F0FF", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}> 
               <Ionicons name="location-outline" size={11} color="#7C3AED" /> 
               <Text style={{ fontSize: rs(11), color: "#7C3AED", fontWeight: "700" }}> 
                 Zone {car.zone} · Slot {car.slot} 
               </Text> 
             </View> 
           ) : null} 
           {car.gate ? ( 
             <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4), backgroundColor: "#F3F4F6", paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}> 
               <Ionicons name="enter-outline" size={11} color="#6B7280" /> 
               <Text style={{ fontSize: rs(11), color: "#6B7280", fontWeight: "700" }}>Gate {car.gate}</Text> 
             </View> 
           ) : null} 
         </View> 
       ) : null} 
 
       {/* Row 5: check-in time → delivered time */} 
       <View style={{ flexDirection: "row", alignItems: "center", gap: rp(12), marginBottom: car.photo_url || car.notes ? 10 : 0 }}> 
         {fmt(car.check_in_time) ? ( 
           <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4) }}> 
             <Ionicons name="log-in-outline" size={12} color="#9CA3AF" /> 
             <Text style={{ fontSize: rs(11), color: "#9CA3AF" }}> 
               In {fmt(car.check_in_time)} 
             </Text> 
           </View> 
         ) : null} 
         {fmt(car.check_in_time) && fmt(car.delivered_at) ? ( 
           <Text style={{ color: "#D1D5DB", fontSize: rs(11) }}>→</Text> 
         ) : null} 
         {fmt(car.delivered_at) ? ( 
           <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4) }}> 
             <Ionicons name="log-out-outline" size={12} color="#059669" /> 
             <Text style={{ fontSize: rs(11), color: "#059669" }}> 
               Out {fmt(car.delivered_at)} 
             </Text> 
           </View> 
         ) : null} 
       </View> 
 
       {/* Row 6: parked photo */} 
       {car.photo_url ? ( 
         <Image 
           source={{ uri: car.photo_url }} 
           style={{ width: "100%", height: rp(130), borderRadius: rp(12), marginTop: rp(4), resizeMode: "cover" }} 
         /> 
       ) : null} 
 
       {/* Row 7: notes */} 
       {car.notes ? ( 
         <Text style={{ fontSize: rs(12), color: "#9CA3AF", marginTop: rp(8), fontStyle: "italic" }}> 
           {car.notes} 
         </Text> 
       ) : null} 
 
     </View> 
   ); 
 }

function EmptyState({ icon, message }) {
  return (
    <View style={{ alignItems: "center", marginTop: rp(80) }}>
      <Ionicons name={icon} size={48} color="#D1D5DB" />
      <Text style={{ color: "#9CA3AF", marginTop: rp(12), fontWeight: "700", fontSize: rs(15) }}>{message}</Text>
    </View>
  );
}
