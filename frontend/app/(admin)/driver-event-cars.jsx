import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../lib/api";

const ACCENT_COLOR = "#7C3AED";

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
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
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 24,
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
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99, padding: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }}>DRIVER</Text>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{driverName}</Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 }}>{eventName}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Tabs */}
      <View style={{ flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 16, marginTop: -22, borderRadius: 20, padding: 4, ...cardShadow }}>
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
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: tab === k ? ACCENT_COLOR : "transparent",
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 13, color: tab === k ? "#fff" : "#6B7280", letterSpacing: 1 }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <View style={{ backgroundColor: "#D1FAE5", width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="checkmark" size={32} color="#059669" />
              </View>
              <Text style={{ color: "#059669", fontWeight: "900", fontSize: 16 }}>No incidents in this event</Text>
            </View>
          ) : (
            incidents.map(inc => (
              <View key={inc.id} style={{ backgroundColor: "#FFF1F2", borderRadius: 16, padding: 14, borderLeftWidth: 3, borderLeftColor: "#EF4444", marginBottom: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ color: "#991B1B", fontWeight: "900", fontSize: 15 }}>{inc.plate}</Text>
                  <Text style={{ color: "#EF4444", fontSize: 11, fontWeight: "700" }}>{formatTime(inc.created_at)}</Text>
                </View>
                <Text style={{ color: "#7F1D1D", fontSize: 14, lineHeight: 20 }}>{inc.description}</Text>
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
       case "BEING_FETCHED":       return { bg: "#F3E8FF", text: "#7C3AED" }; 
       case "DELIVERED":           return { bg: "#D1FAE5", text: "#059669" }; 
       default:                    return { bg: "#F3F4F6", text: "#6B7280" }; 
     } 
   }; 
   const style = statusStyle(status); 
 
   const fmt = (ts) => 
     ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: 'Asia/Kolkata' }) : null; 
 
   return ( 
     <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 12, ...cardShadow }}> 
 
       {/* Row 1: plate badge + status badge */} 
       <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}> 
         <View style={{ backgroundColor: "#111827", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 }}> 
           <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1 }}> 
             {car.plate} 
           </Text> 
         </View> 
         <View style={{ backgroundColor: style.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}> 
           <Text style={{ color: style.text, fontSize: 10, fontWeight: "900" }}> 
             {status.replace(/_/g, " ")} 
           </Text> 
         </View> 
       </View> 
 
       {/* Row 2: make · color */} 
       <Text style={{ fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 }}> 
         {car.make}{car.color ? `  ·  ${car.color}` : ""} 
       </Text> 
 
       {/* Row 3: guest name if present */} 
       {car.guest_name ? ( 
         <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}> 
           <Ionicons name="person-outline" size={13} color="#9CA3AF" /> 
           <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "600" }}>{car.guest_name}</Text> 
         </View> 
       ) : null} 
 
       {/* Row 4: zone/slot and gate pills */} 
       {(car.zone && car.slot) || car.gate ? ( 
         <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}> 
           {car.zone && car.slot ? ( 
             <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3F0FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}> 
               <Ionicons name="location-outline" size={11} color="#7C3AED" /> 
               <Text style={{ fontSize: 11, color: "#7C3AED", fontWeight: "700" }}> 
                 Zone {car.zone} · Slot {car.slot} 
               </Text> 
             </View> 
           ) : null} 
           {car.gate ? ( 
             <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}> 
               <Ionicons name="enter-outline" size={11} color="#6B7280" /> 
               <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "700" }}>Gate {car.gate}</Text> 
             </View> 
           ) : null} 
         </View> 
       ) : null} 
 
       {/* Row 5: check-in time → delivered time */} 
       <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: car.photo_url || car.notes ? 10 : 0 }}> 
         {fmt(car.check_in_time) ? ( 
           <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}> 
             <Ionicons name="log-in-outline" size={12} color="#9CA3AF" /> 
             <Text style={{ fontSize: 11, color: "#9CA3AF" }}> 
               In {fmt(car.check_in_time)} 
             </Text> 
           </View> 
         ) : null} 
         {fmt(car.check_in_time) && fmt(car.delivered_at) ? ( 
           <Text style={{ color: "#D1D5DB", fontSize: 11 }}>→</Text> 
         ) : null} 
         {fmt(car.delivered_at) ? ( 
           <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}> 
             <Ionicons name="log-out-outline" size={12} color="#059669" /> 
             <Text style={{ fontSize: 11, color: "#059669" }}> 
               Out {fmt(car.delivered_at)} 
             </Text> 
           </View> 
         ) : null} 
       </View> 
 
       {/* Row 6: parked photo */} 
       {car.photo_url ? ( 
         <Image 
           source={{ uri: car.photo_url }} 
           style={{ width: "100%", height: 130, borderRadius: 12, marginTop: 4, resizeMode: "cover" }} 
         /> 
       ) : null} 
 
       {/* Row 7: notes */} 
       {car.notes ? ( 
         <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8, fontStyle: "italic" }}> 
           {car.notes} 
         </Text> 
       ) : null} 
 
     </View> 
   ); 
 }

function EmptyState({ icon, message }) {
  return (
    <View style={{ alignItems: "center", marginTop: 80 }}>
      <Ionicons name={icon} size={48} color="#D1D5DB" />
      <Text style={{ color: "#9CA3AF", marginTop: 12, fontWeight: "700", fontSize: 15 }}>{message}</Text>
    </View>
  );
}
