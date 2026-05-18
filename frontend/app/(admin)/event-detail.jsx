// version 1
// import { useEffect, useState, useMemo, useCallback } from "react";
// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   TextInput,
//   Modal,
//   Alert,
//   Image,
//   RefreshControl,
// } from "react-native";
// import { useRouter } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { formatDistanceToNow } from "date-fns";
// import api from "../../lib/api";
// import { useAppStore } from "../../lib/store";
// import { connectWS, disconnectWS } from "../../lib/websocket";

// const STATUS_CONFIG = {
//   CHECKED_IN: { color: "#0EA5E9", label: "Checked In" },
//   PARKED: { color: "#059669", label: "Parked" },
//   RETRIEVAL_REQUESTED: { color: "#F59E0B", label: "Requested" },
//   BEING_FETCHED: { color: "#F97316", label: "Fetching" },
//   DELIVERED: { color: "#9CA3AF", label: "Delivered" },
// };

// const FILTERS = ["ALL", "CHECKED_IN", "PARKED", "RETRIEVAL_REQUESTED", "BEING_FETCHED", "DELIVERED"];

// const cardShadow = {
//   shadowColor: "#7C3AED",
//   shadowOpacity: 0.08,
//   shadowRadius: 16,
//   shadowOffset: { width: 0, height: 4 },
//   elevation: 4,
// };

// export default function EventDetail() {
//   const router = useRouter();
//   const { currentEventId } = useAppStore();
//   const [event, setEvent] = useState(null);
//   const [tab, setTab] = useState("cars");
//   const [cars, setCars] = useState([]);
//   const [drivers, setDrivers] = useState([]);
//   const [stats, setStats] = useState(null);
//   const [search, setSearch] = useState("");
//   const [statusFilter, setStatusFilter] = useState("ALL");
//   const [selectedCar, setSelectedCar] = useState(null);
//   const [showCarModal, setShowCarModal] = useState(false);
//   const [carPhotos, setCarPhotos] = useState([]);
//   const [refreshing, setRefreshing] = useState(false);

//   const fetchEvent = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/events/${currentEventId}`);
//       setEvent(data);
//     } catch {}
//   }, [currentEventId]);

//   const fetchCars = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/cars/event/${currentEventId}`);
//       setCars(data || []);
//     } catch {}
//   }, [currentEventId]);

//   const fetchDrivers = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/events/${currentEventId}/drivers`);
//       setDrivers(data || []);
//     } catch {}
//   }, [currentEventId]);

//   const fetchStats = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/events/${currentEventId}/stats`);
//       setStats(data);
//     } catch {}
//   }, [currentEventId]);

//   useEffect(() => {
//     if (!currentEventId) return;
//     fetchEvent();
//     fetchCars();
//     fetchDrivers();
//     fetchStats();
//     connectWS(`/event/${currentEventId}`, (msg) => {
//       if (msg.type === "car_update") fetchCars();
//     });
//     return () => disconnectWS(`/event/${currentEventId}`);
//   }, [currentEventId]);

//   const filteredCars = useMemo(() => {
//     return cars.filter((c) => {
//       if (search && !c.plate?.toLowerCase().includes(search.toLowerCase())) return false;
//       if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
//       return true;
//     });
//   }, [cars, search, statusFilter]);

//   const openCar = async (car) => {
//     setSelectedCar(car);
//     setShowCarModal(true);
//     try {
//       const { data } = await api.get(`/cars/${car.id}/photos`);
//       setCarPhotos(data || []);
//     } catch {
//       setCarPhotos([]);
//     }
//   };

//   const closeEvent = () => {
//     Alert.alert("Close Event", "Are you sure? This cannot be undone.", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Close",
//         style: "destructive",
//         onPress: async () => {
//           try {
//             await api.post(`/events/${currentEventId}/close`);
//             router.back();
//           } catch (e) {
//             Alert.alert("Error", "Failed to close event");
//           }
//         },
//       },
//     ]);
//   };

//   const removeCar = (car) => {
//     Alert.alert("Remove Vehicle", `Remove ${car.plate}?`, [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Remove",
//         style: "destructive",
//         onPress: async () => {
//           try {
//             await api.delete(`/cars/${car.id}`);
//             setShowCarModal(false);
//             fetchCars();
//           } catch (e) {
//             Alert.alert("Error", "Failed to remove");
//           }
//         },
//       },
//     ]);
//   };

//   const toggleAssign = async (d) => {
//     try {
//       if (d.assigned) {
//         await api.delete(`/events/${currentEventId}/drivers/${d.id}`);
//       } else {
//         await api.post(`/events/${currentEventId}/drivers/${d.id}`);
//       }
//       fetchDrivers();
//     } catch (e) {
//       Alert.alert("Error", e.response?.data?.detail || "Failed");
//     }
//   };

//   return (
//     <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="event-detail-screen">
//       <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
//         <View
//           style={{
//             backgroundColor: "#7C3AED",
//             borderBottomLeftRadius: 44,
//             borderBottomRightRadius: 44,
//             paddingHorizontal: 20,
//             paddingTop: 8,
//             paddingBottom: 16,
//           }}
//         >
//           <View
//             style={{
//               position: "absolute",
//               top: 0,
//               left: 0,
//               right: 0,
//               bottom: 0,
//               backgroundColor: "rgba(79,70,229,0.5)",
//               borderBottomLeftRadius: 44,
//               borderBottomRightRadius: 44,
//             }}
//           />
//           <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
//             <TouchableOpacity onPress={() => router.back()} style={iconBtn}>
//               <Ionicons name="chevron-back" size={22} color="#fff" />
//             </TouchableOpacity>
//             <View style={{ flex: 1, marginLeft: 12 }}>
//               <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
//                 {event?.name || "Event"}
//               </Text>
//               {event?.status && (
//                 <View style={{ flexDirection: "row", marginTop: 4 }}>
//                   <View
//                     style={{
//                       backgroundColor: event.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.18)",
//                       paddingHorizontal: 8,
//                       paddingVertical: 2,
//                       borderRadius: 99,
//                     }}
//                   >
//                     <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
//                       {event.status.toUpperCase()}
//                     </Text>
//                   </View>
//                 </View>
//               )}
//             </View>
//             <TouchableOpacity
//               onPress={() => router.push({ pathname: "/(admin)/edit-event", params: { eventId: currentEventId } })}
//               style={[iconBtn, { marginRight: 8 }]}
//             >
//               <Ionicons name="create-outline" size={20} color="#fff" />
//             </TouchableOpacity>
//             {event?.status === "active" && (
//               <TouchableOpacity onPress={closeEvent} style={[iconBtn, { backgroundColor: "rgba(244,63,94,0.7)" }]}>
//                 <Ionicons name="close" size={20} color="#fff" />
//               </TouchableOpacity>
//             )}
//           </View>
//         </View>
//       </SafeAreaView>

//       {/* Tab bar */}
//       <View
//         style={{
//           backgroundColor: "#fff",
//           flexDirection: "row",
//           marginHorizontal: 16,
//           marginTop: -22,
//           borderRadius: 20,
//           padding: 4,
//           ...cardShadow,
//         }}
//       >
//         {[["cars", "Cars"], ["drivers", "Drivers"], ["stats", "Stats"]].map(([k, l]) => (
//           <TouchableOpacity
//             key={k}
//             onPress={() => setTab(k)}
//             testID={`tab-${k}`}
//             style={{
//               flex: 1,
//               paddingVertical: 10,
//               borderRadius: 16,
//               backgroundColor: tab === k ? "#7C3AED" : "transparent",
//               alignItems: "center",
//             }}
//           >
//             <Text
//               style={{
//                 fontWeight: "800",
//                 fontSize: 13,
//                 color: tab === k ? "#fff" : "#6B7280",
//                 letterSpacing: 1,
//               }}
//             >
//               {l}
//             </Text>
//           </TouchableOpacity>
//         ))}
//       </View>

//       {tab === "cars" && (
//         <ScrollView
//           style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
//           contentContainerStyle={{ paddingBottom: 100 }}
//           refreshControl={
//             <RefreshControl
//               refreshing={refreshing}
//               onRefresh={async () => {
//                 setRefreshing(true);
//                 await fetchCars();
//                 setRefreshing(false);
//               }}
//               tintColor="#7C3AED"
//             />
//           }
//         >
//           <View
//             style={{
//               backgroundColor: "#fff",
//               borderRadius: 16,
//               paddingHorizontal: 14,
//               flexDirection: "row",
//               alignItems: "center",
//               marginBottom: 12,
//               borderWidth: 1,
//               borderColor: "#E5E7EB",
//             }}
//           >
//             <Ionicons name="search" size={18} color="#7C3AED" />
//             <TextInput
//               value={search}
//               onChangeText={setSearch}
//               placeholder="Search plate..."
//               placeholderTextColor="#9CA3AF"
//               style={{ flex: 1, paddingVertical: 12, marginLeft: 8, color: "#111827" }}
//               testID="car-search"
//             />
//           </View>
//           <ScrollView
//             horizontal
//             showsHorizontalScrollIndicator={false}
//             contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
//           >
//             {FILTERS.map((f) => (
//               <TouchableOpacity
//                 key={f}
//                 onPress={() => setStatusFilter(f)}
//                 style={{
//                   paddingHorizontal: 14,
//                   paddingVertical: 8,
//                   borderRadius: 99,
//                   backgroundColor: statusFilter === f ? "#7C3AED" : "#fff",
//                   borderWidth: 1,
//                   borderColor: statusFilter === f ? "#7C3AED" : "#E5E7EB",
//                 }}
//               >
//                 <Text
//                   style={{
//                     fontSize: 11,
//                     fontWeight: "800",
//                     color: statusFilter === f ? "#fff" : "#6B7280",
//                     letterSpacing: 1,
//                   }}
//                 >
//                   {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label || f}
//                 </Text>
//               </TouchableOpacity>
//             ))}
//           </ScrollView>
//           <Text style={{ color: "#6B7280", fontSize: 11, marginVertical: 8, fontWeight: "600" }}>
//             {filteredCars.length} cars found
//           </Text>
//           {filteredCars.map((car) => {
//             const cfg = STATUS_CONFIG[car.status] || STATUS_CONFIG.CHECKED_IN;
//             return (
//               <TouchableOpacity
//                 key={car.id}
//                 onPress={() => openCar(car)}
//                 activeOpacity={0.85}
//                 style={{
//                   backgroundColor: "#fff",
//                   borderRadius: 24,
//                   padding: 16,
//                   marginBottom: 12,
//                   flexDirection: "row",
//                   alignItems: "center",
//                   borderLeftWidth: 4,
//                   borderLeftColor: cfg.color,
//                   ...cardShadow,
//                 }}
//               >
//                 <View style={{ flex: 1 }}>
//                   <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{car.plate}</Text>
//                   <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{car.color} {car.make}</Text>
//                   <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 6 }}>
//                     {car.zone && car.slot && (
//                       <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
//                         <Text style={{ color: "#374151", fontSize: 10, fontWeight: "700" }}>
//                           {car.zone}-{car.slot}
//                         </Text>
//                       </View>
//                     )}
//                     <Text style={{ color: "#9CA3AF", fontSize: 11 }}>
//                       {car.check_in_time ? formatDistanceToNow(new Date(car.check_in_time), { addSuffix: true }) : "Just now"}
//                     </Text>
//                   </View>
//                 </View>
//                 <View style={{ alignItems: "flex-end" }}>
//                   <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: cfg.color }}>
//                     <Text style={{ color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 0.5 }}>{cfg.label}</Text>
//                   </View>
//                   <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginTop: 8 }} />
//                 </View>
//               </TouchableOpacity>
//             );
//           })}
//           {filteredCars.length === 0 && (
//             <View style={{ alignItems: "center", marginTop: 40 }}>
//               <Text style={{ fontSize: 48 }}>🚗</Text>
//               <Text style={{ color: "#6B7280", marginTop: 8, fontWeight: "700" }}>No cars yet</Text>
//             </View>
//           )}
//           <View style={{ height: 40 }} />
//         </ScrollView>
//       )}

//       {tab === "drivers" && (
//         <ScrollView
//           style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
//           contentContainerStyle={{ paddingBottom: 100 }}
//         >
//           {drivers.length === 0 && (
//             <View style={{ alignItems: "center", marginTop: 40 }}>
//               <Text style={{ fontSize: 48 }}>👥</Text>
//               <Text style={{ color: "#6B7280", marginTop: 8, fontWeight: "700" }}>No drivers</Text>
//             </View>
//           )}
//           {drivers.map((d) => (
//             <View
//               key={d.id}
//               style={{
//                 backgroundColor: "#fff",
//                 borderRadius: 24,
//                 padding: 16,
//                 marginBottom: 12,
//                 ...cardShadow,
//               }}
//             >
//               <View style={{ flexDirection: "row", alignItems: "center" }}>
//                 <View
//                   style={{
//                     backgroundColor: "#7C3AED",
//                     borderRadius: 99,
//                     width: 48,
//                     height: 48,
//                     alignItems: "center",
//                     justifyContent: "center",
//                   }}
//                 >
//                   <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>
//                     {d.name?.[0]?.toUpperCase()}
//                   </Text>
//                 </View>
//                 <TouchableOpacity
//                   style={{ flex: 1, marginLeft: 12 }}
//                   onPress={() =>
//                     router.push({
//                       pathname: "/(admin)/driver-stats",
//                       params: { driverId: d.id, driverName: d.name },
//                     })
//                   }
//                 >
//                   <Text style={{ fontWeight: "900", color: "#111827", fontSize: 15 }}>{d.name}</Text>
//                   <Text style={{ color: "#6B7280", fontSize: 12 }}>{d.employee_id}</Text>
//                   <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
//                     <View
//                       style={{
//                         width: 8,
//                         height: 8,
//                         borderRadius: 99,
//                         marginRight: 6,
//                         backgroundColor: d.available ? "#059669" : "#F43F5E",
//                       }}
//                     />
//                     <Text style={{ fontSize: 11, fontWeight: "700", color: d.available ? "#059669" : "#F43F5E" }}>
//                       {d.available ? "Available" : `In ${d.conflict_event_name || "another event"}`}
//                     </Text>
//                   </View>
//                 </TouchableOpacity>
//               </View>
//               <View style={{ flexDirection: "row", marginTop: 10, gap: 10 }}>
//                 <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
//                   <Text style={{ color: "#059669", fontSize: 11, fontWeight: "700" }}>
//                     Checked in: {d.cars_checked_in || 0}
//                   </Text>
//                 </View>
//                 <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
//                   <Text style={{ color: "#0EA5E9", fontSize: 11, fontWeight: "700" }}>
//                     Retrieved: {d.cars_retrieved || 0}
//                   </Text>
//                 </View>
//               </View>
//               {d.available || d.assigned ? (
//                 <TouchableOpacity
//                   onPress={() => toggleAssign(d)}
//                   style={{
//                     marginTop: 12,
//                     borderRadius: 14,
//                     paddingVertical: 12,
//                     alignItems: "center",
//                     backgroundColor: d.assigned ? "transparent" : "#7C3AED",
//                     borderWidth: d.assigned ? 1.5 : 0,
//                     borderColor: "#F43F5E",
//                   }}
//                 >
//                   <Text
//                     style={{
//                       fontWeight: "900",
//                       letterSpacing: 1.5,
//                       color: d.assigned ? "#F43F5E" : "#fff",
//                       fontSize: 13,
//                     }}
//                   >
//                     {d.assigned ? "UNASSIGN" : "ASSIGN"}
//                   </Text>
//                 </TouchableOpacity>
//               ) : (
//                 <View style={{ marginTop: 12, backgroundColor: "#F3F4F6", borderRadius: 14, paddingVertical: 12, alignItems: "center" }}>
//                   <Text style={{ color: "#9CA3AF", fontSize: 11 }}>In {d.conflict_event_name}</Text>
//                 </View>
//               )}
//             </View>
//           ))}
//           <View style={{ height: 40 }} />
//         </ScrollView>
//       )}

//       {tab === "stats" && (
//         <ScrollView
//           style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
//           contentContainerStyle={{ paddingBottom: 100 }}
//         >
//           <TouchableOpacity onPress={fetchStats} style={{ backgroundColor: "#fff", borderRadius: 16, paddingVertical: 10, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" }}>
//             <Text style={{ color: "#7C3AED", fontWeight: "800", letterSpacing: 1 }}>↻ Refresh Stats</Text>
//           </TouchableOpacity>
//           {[
//             { color: "#7C3AED", icon: "star", label: "AVG RATING", value: stats?.avg_rating || "—" },
//             { color: "#059669", icon: "trophy", label: "TOP DRIVER", value: stats?.top_driver || "—" },
//             { color: "#F59E0B", icon: "timer", label: "AVG RETRIEVAL", value: stats?.avg_retrieval_minutes ? `${stats.avg_retrieval_minutes} min` : "—" },
//             { color: "#0EA5E9", icon: "car", label: "TOTAL CARS", value: stats?.total_cars || 0 },
//           ].map((s) => (
//             <View
//               key={s.label}
//               style={{
//                 backgroundColor: s.color,
//                 borderRadius: 24,
//                 padding: 20,
//                 marginBottom: 12,
//                 shadowColor: s.color,
//                 shadowOpacity: 0.25,
//                 shadowRadius: 14,
//                 shadowOffset: { width: 0, height: 6 },
//                 elevation: 5,
//               }}
//             >
//               <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
//                 <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>
//                   {s.label}
//                 </Text>
//                 <Ionicons name={s.icon} size={22} color="#fff" />
//               </View>
//               <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 8 }}>{s.value}</Text>
//             </View>
//           ))}
//           <View style={{ height: 40 }} />
//         </ScrollView>
//       )}

//       <Modal visible={showCarModal} animationType="slide" transparent>
//         <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
//           <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20, maxHeight: "85%" }}>
//             <View style={{ alignItems: "center", marginBottom: 12 }}>
//               <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
//             </View>
//             <ScrollView>
//               {selectedCar && (
//                 <>
//                   <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
//                     <View style={{ flex: 1 }}>
//                       <Text style={{ fontSize: 28, fontWeight: "900", color: "#7C3AED" }}>{selectedCar.plate}</Text>
//                       <Text style={{ color: "#6B7280", marginTop: 4 }}>{selectedCar.color} {selectedCar.make}</Text>
//                       <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
//                         {selectedCar.zone ? `Zone ${selectedCar.zone} · Slot ${selectedCar.slot}` : "Not parked"}
//                       </Text>
//                     </View>
//                     <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, backgroundColor: STATUS_CONFIG[selectedCar.status]?.color }}>
//                       <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
//                         {STATUS_CONFIG[selectedCar.status]?.label}
//                       </Text>
//                     </View>
//                   </View>
//                   {selectedCar.notes ? (
//                     <Text style={{ color: "#6B7280", marginTop: 12, fontStyle: "italic" }}>"{selectedCar.notes}"</Text>
//                   ) : null}

//                   <Text style={[modalLabel, { marginTop: 16 }]}>CHECK-IN PHOTOS</Text>
//                   {carPhotos.filter((p) => p.type === "checkin").length === 0 ? (
//                     <Text style={{ color: "#9CA3AF", fontSize: 13 }}>No photos available</Text>
//                   ) : (
//                     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
//                       {carPhotos.filter((p) => p.type === "checkin").map((p, i) => (
//                         <Image key={i} source={{ uri: p.url }} style={{ width: 120, height: 120, borderRadius: 14 }} />
//                       ))}
//                     </ScrollView>
//                   )}

//                   {carPhotos.find((p) => p.type === "handover") && (
//                     <>
//                       <Text style={[modalLabel, { marginTop: 16 }]}>HANDOVER PHOTO</Text>
//                       <Image
//                         source={{ uri: carPhotos.find((p) => p.type === "handover").url }}
//                         style={{ width: "100%", height: 200, borderRadius: 14 }}
//                       />
//                     </>
//                   )}

//                   <TouchableOpacity
//                     onPress={() => {
//                       setShowCarModal(false);
//                       router.push({ pathname: "/(admin)/qr-display", params: { token: selectedCar.qr_token, plate: selectedCar.plate } });
//                     }}
//                     style={{ backgroundColor: "#7C3AED", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 20 }}
//                   >
//                     <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>VIEW QR</Text>
//                   </TouchableOpacity>
//                   <TouchableOpacity
//                     onPress={() => removeCar(selectedCar)}
//                     style={{ borderWidth: 1.5, borderColor: "#F43F5E", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 8, marginBottom: 16 }}
//                   >
//                     <Text style={{ color: "#F43F5E", fontWeight: "900", letterSpacing: 2 }}>REMOVE VEHICLE</Text>
//                   </TouchableOpacity>
//                   <TouchableOpacity onPress={() => setShowCarModal(false)} style={{ paddingVertical: 10, alignItems: "center", marginBottom: 12 }}>
//                     <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
//                   </TouchableOpacity>
//                 </>
//               )}
//             </ScrollView>
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }

// const iconBtn = {
//   backgroundColor: "rgba(255,255,255,0.15)",
//   borderRadius: 99,
//   padding: 8,
// };

// const modalLabel = {
//   fontSize: 11,
//   fontWeight: "800",
//   color: "#6B7280",
//   letterSpacing: 3,
//   marginBottom: 8,
// };






// version 2
// import { useEffect, useState, useMemo, useCallback } from "react";
// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   TextInput,
//   Modal,
//   Alert,
//   Image,
//   RefreshControl,
// } from "react-native";
// import { useRouter } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { formatDistanceToNow } from "date-fns";
// import api from "../../lib/api";
// import { useAppStore } from "../../lib/store";
// import { connectWS, disconnectWS } from "../../lib/websocket";

// const STATUS_CONFIG = {
//   CHECKED_IN: { color: "#0EA5E9", label: "Checked In" },
//   PARKED: { color: "#059669", label: "Parked" },
//   RETRIEVAL_REQUESTED: { color: "#F59E0B", label: "Requested" },
//   BEING_FETCHED: { color: "#F97316", label: "Fetching" },
//   DELIVERED: { color: "#9CA3AF", label: "Delivered" },
// };

// const FILTERS = ["ALL", "CHECKED_IN", "PARKED", "RETRIEVAL_REQUESTED", "BEING_FETCHED", "DELIVERED"];

// const cardShadow = {
//   shadowColor: "#7C3AED",
//   shadowOpacity: 0.08,
//   shadowRadius: 16,
//   shadowOffset: { width: 0, height: 4 },
//   elevation: 4,
// };

// export default function EventDetail() {
//   const router = useRouter();
//   const { currentEventId } = useAppStore();
//   const [event, setEvent] = useState(null);
//   const [tab, setTab] = useState("cars");
//   const [cars, setCars] = useState([]);
//   const [drivers, setDrivers] = useState([]);
//   const [stats, setStats] = useState(null);
//   const [search, setSearch] = useState("");
//   const [statusFilter, setStatusFilter] = useState("ALL");
//   const [selectedCar, setSelectedCar] = useState(null);
//   const [showCarModal, setShowCarModal] = useState(false);
//   const [carPhotos, setCarPhotos] = useState([]);
//   const [refreshing, setRefreshing] = useState(false);

//   const fetchEvent = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/events/${currentEventId}`);
//       setEvent(data);
//     } catch {}
//   }, [currentEventId]);

//   const fetchCars = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/cars/event/${currentEventId}`);
//       setCars(data || []);
//     } catch {}
//   }, [currentEventId]);

//   const fetchDrivers = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/events/${currentEventId}/drivers`);
//       setDrivers(data || []);
//     } catch {}
//   }, [currentEventId]);

//   const fetchStats = useCallback(async () => {
//     try {
//       const { data } = await api.get(`/events/${currentEventId}/stats`);
//       setStats(data);
//     } catch {}
//   }, [currentEventId]);

//   useEffect(() => {
//     if (!currentEventId) return;
//     // Run all fetches in parallel instead of sequentially
//     Promise.all([fetchEvent(), fetchCars(), fetchDrivers(), fetchStats()]);
//     connectWS(`/event/${currentEventId}`, (msg) => {
//       if (msg.type === "car_update") fetchCars();
//     });
//     return () => disconnectWS(`/event/${currentEventId}`);
//   }, [currentEventId]);

//   const filteredCars = useMemo(() => {
//     return cars.filter((c) => {
//       if (search && !c.plate?.toLowerCase().includes(search.toLowerCase())) return false;
//       if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
//       return true;
//     });
//   }, [cars, search, statusFilter]);

//   const openCar = async (car) => {
//     setSelectedCar(car);
//     setShowCarModal(true);
//     try {
//       const { data } = await api.get(`/cars/${car.id}/photos`);
//       setCarPhotos(data || []);
//     } catch {
//       setCarPhotos([]);
//     }
//   };

//   const closeEvent = () => {
//     Alert.alert("Close Event", "Are you sure? This cannot be undone.", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Close",
//         style: "destructive",
//         onPress: async () => {
//           try {
//             await api.post(`/events/${currentEventId}/close`);
//             router.back();
//           } catch (e) {
//             Alert.alert("Error", "Failed to close event");
//           }
//         },
//       },
//     ]);
//   };

//   const removeCar = (car) => {
//     Alert.alert("Remove Vehicle", `Remove ${car.plate}?`, [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Remove",
//         style: "destructive",
//         onPress: async () => {
//           try {
//             await api.delete(`/cars/${car.id}`);
//             setShowCarModal(false);
//             fetchCars();
//           } catch (e) {
//             Alert.alert("Error", "Failed to remove");
//           }
//         },
//       },
//     ]);
//   };

//   const toggleAssign = async (d) => {
//     try {
//       if (d.assigned) {
//         await api.delete(`/events/${currentEventId}/drivers/${d.id}`);
//       } else {
//         await api.post(`/events/${currentEventId}/drivers/${d.id}`);
//       }
//       fetchDrivers();
//     } catch (e) {
//       Alert.alert("Error", e.response?.data?.detail || "Failed");
//     }
//   };

//   return (
//     <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="event-detail-screen">
//       <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
//         <View
//           style={{
//             backgroundColor: "#7C3AED",
//             borderBottomLeftRadius: 44,
//             borderBottomRightRadius: 44,
//             paddingHorizontal: 20,
//             paddingTop: 8,
//             paddingBottom: 16,
//           }}
//         >
//           <View
//             style={{
//               position: "absolute",
//               top: 0,
//               left: 0,
//               right: 0,
//               bottom: 0,
//               backgroundColor: "rgba(79,70,229,0.5)",
//               borderBottomLeftRadius: 44,
//               borderBottomRightRadius: 44,
//             }}
//           />
//           <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
//             <TouchableOpacity onPress={() => router.back()} style={iconBtn}>
//               <Ionicons name="chevron-back" size={22} color="#fff" />
//             </TouchableOpacity>
//             <View style={{ flex: 1, marginLeft: 12 }}>
//               <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
//                 {event?.name || "Event"}
//               </Text>
//               {event?.status && (
//                 <View style={{ flexDirection: "row", marginTop: 4 }}>
//                   <View
//                     style={{
//                       backgroundColor: event.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.18)",
//                       paddingHorizontal: 8,
//                       paddingVertical: 2,
//                       borderRadius: 99,
//                     }}
//                   >
//                     <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
//                       {event.status.toUpperCase()}
//                     </Text>
//                   </View>
//                 </View>
//               )}
//             </View>
//             <TouchableOpacity
//               onPress={() => router.push({ pathname: "/(admin)/edit-event", params: { eventId: currentEventId } })}
//               style={[iconBtn, { marginRight: 8 }]}
//             >
//               <Ionicons name="create-outline" size={20} color="#fff" />
//             </TouchableOpacity>
//             {event?.status === "active" && (
//               <TouchableOpacity onPress={closeEvent} style={[iconBtn, { backgroundColor: "rgba(244,63,94,0.7)" }]}>
//                 <Ionicons name="close" size={20} color="#fff" />
//               </TouchableOpacity>
//             )}
//           </View>
//         </View>
//       </SafeAreaView>

//       {/* Tab bar */}
//       <View
//         style={{
//           backgroundColor: "#fff",
//           flexDirection: "row",
//           marginHorizontal: 16,
//           marginTop: -22,
//           borderRadius: 20,
//           padding: 4,
//           ...cardShadow,
//         }}
//       >
//         {[["cars", "Cars"], ["drivers", "Drivers"], ["stats", "Stats"]].map(([k, l]) => (
//           <TouchableOpacity
//             key={k}
//             onPress={() => setTab(k)}
//             testID={`tab-${k}`}
//             style={{
//               flex: 1,
//               paddingVertical: 10,
//               borderRadius: 16,
//               backgroundColor: tab === k ? "#7C3AED" : "transparent",
//               alignItems: "center",
//             }}
//           >
//             <Text
//               style={{
//                 fontWeight: "800",
//                 fontSize: 13,
//                 color: tab === k ? "#fff" : "#6B7280",
//                 letterSpacing: 1,
//               }}
//             >
//               {l}
//             </Text>
//           </TouchableOpacity>
//         ))}
//       </View>

//       {tab === "cars" && (
//         <ScrollView
//           style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
//           contentContainerStyle={{ paddingBottom: 100 }}
//           refreshControl={
//             <RefreshControl
//               refreshing={refreshing}
//               onRefresh={async () => {
//                 setRefreshing(true);
//                 await fetchCars();
//                 setRefreshing(false);
//               }}
//               tintColor="#7C3AED"
//             />
//           }
//         >
//           <View
//             style={{
//               backgroundColor: "#fff",
//               borderRadius: 16,
//               paddingHorizontal: 14,
//               flexDirection: "row",
//               alignItems: "center",
//               marginBottom: 12,
//               borderWidth: 1,
//               borderColor: "#E5E7EB",
//             }}
//           >
//             <Ionicons name="search" size={18} color="#7C3AED" />
//             <TextInput
//               value={search}
//               onChangeText={setSearch}
//               placeholder="Search plate..."
//               placeholderTextColor="#9CA3AF"
//               style={{ flex: 1, paddingVertical: 12, marginLeft: 8, color: "#111827" }}
//               testID="car-search"
//             />
//           </View>
//           <ScrollView
//             horizontal
//             showsHorizontalScrollIndicator={false}
//             contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
//           >
//             {FILTERS.map((f) => (
//               <TouchableOpacity
//                 key={f}
//                 onPress={() => setStatusFilter(f)}
//                 style={{
//                   paddingHorizontal: 14,
//                   paddingVertical: 8,
//                   borderRadius: 99,
//                   backgroundColor: statusFilter === f ? "#7C3AED" : "#fff",
//                   borderWidth: 1,
//                   borderColor: statusFilter === f ? "#7C3AED" : "#E5E7EB",
//                 }}
//               >
//                 <Text
//                   style={{
//                     fontSize: 11,
//                     fontWeight: "800",
//                     color: statusFilter === f ? "#fff" : "#6B7280",
//                     letterSpacing: 1,
//                   }}
//                 >
//                   {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label || f}
//                 </Text>
//               </TouchableOpacity>
//             ))}
//           </ScrollView>
//           <Text style={{ color: "#6B7280", fontSize: 11, marginVertical: 8, fontWeight: "600" }}>
//             {filteredCars.length} cars found
//           </Text>
//           {filteredCars.map((car) => {
//             const cfg = STATUS_CONFIG[car.status] || STATUS_CONFIG.CHECKED_IN;
//             return (
//               <TouchableOpacity
//                 key={car.id}
//                 onPress={() => openCar(car)}
//                 activeOpacity={0.85}
//                 style={{
//                   backgroundColor: "#fff",
//                   borderRadius: 24,
//                   padding: 16,
//                   marginBottom: 12,
//                   flexDirection: "row",
//                   alignItems: "center",
//                   borderLeftWidth: 4,
//                   borderLeftColor: cfg.color,
//                   ...cardShadow,
//                 }}
//               >
//                 <View style={{ flex: 1 }}>
//                   <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{car.plate}</Text>
//                   <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{car.color} {car.make}</Text>
//                   <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 6 }}>
//                     {car.zone && car.slot && (
//                       <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
//                         <Text style={{ color: "#374151", fontSize: 10, fontWeight: "700" }}>
//                           {car.zone}-{car.slot}
//                         </Text>
//                       </View>
//                     )}
//                     <Text style={{ color: "#9CA3AF", fontSize: 11 }}>
//                       {car.check_in_time ? formatDistanceToNow(new Date(car.check_in_time), { addSuffix: true }) : "Just now"}
//                     </Text>
//                   </View>
//                 </View>
//                 <View style={{ alignItems: "flex-end" }}>
//                   <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: cfg.color }}>
//                     <Text style={{ color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 0.5 }}>{cfg.label}</Text>
//                   </View>
//                   <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginTop: 8 }} />
//                 </View>
//               </TouchableOpacity>
//             );
//           })}
//           {filteredCars.length === 0 && (
//             <View style={{ alignItems: "center", marginTop: 40 }}>
//               <Text style={{ fontSize: 48 }}>🚗</Text>
//               <Text style={{ color: "#6B7280", marginTop: 8, fontWeight: "700" }}>No cars yet</Text>
//             </View>
//           )}
//           <View style={{ height: 40 }} />
//         </ScrollView>
//       )}

//       {tab === "drivers" && (
//         <ScrollView
//           style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
//           contentContainerStyle={{ paddingBottom: 100 }}
//         >
//           {drivers.length === 0 && (
//             <View style={{ alignItems: "center", marginTop: 40 }}>
//               <Text style={{ fontSize: 48 }}>👥</Text>
//               <Text style={{ color: "#6B7280", marginTop: 8, fontWeight: "700" }}>No drivers</Text>
//             </View>
//           )}
//           {drivers.map((d) => (
//             <View
//               key={d.id}
//               style={{
//                 backgroundColor: "#fff",
//                 borderRadius: 24,
//                 padding: 16,
//                 marginBottom: 12,
//                 ...cardShadow,
//               }}
//             >
//               <View style={{ flexDirection: "row", alignItems: "center" }}>
//                 <View
//                   style={{
//                     backgroundColor: "#7C3AED",
//                     borderRadius: 99,
//                     width: 48,
//                     height: 48,
//                     alignItems: "center",
//                     justifyContent: "center",
//                   }}
//                 >
//                   <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>
//                     {d.name?.[0]?.toUpperCase()}
//                   </Text>
//                 </View>
//                 <TouchableOpacity
//                   style={{ flex: 1, marginLeft: 12 }}
//                   onPress={() =>
//                     router.push({
//                       pathname: "/(admin)/driver-stats",
//                       params: { driverId: d.id, driverName: d.name },
//                     })
//                   }
//                 >
//                   <Text style={{ fontWeight: "900", color: "#111827", fontSize: 15 }}>{d.name}</Text>
//                   <Text style={{ color: "#6B7280", fontSize: 12 }}>{d.employee_id}</Text>
//                   <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
//                     <View
//                       style={{
//                         width: 8,
//                         height: 8,
//                         borderRadius: 99,
//                         marginRight: 6,
//                         backgroundColor: d.available ? "#059669" : "#F43F5E",
//                       }}
//                     />
//                     <Text style={{ fontSize: 11, fontWeight: "700", color: d.available ? "#059669" : "#F43F5E" }}>
//                       {d.available ? "Available" : `In ${d.conflict_event_name || "another event"}`}
//                     </Text>
//                   </View>
//                 </TouchableOpacity>
//               </View>
//               <View style={{ flexDirection: "row", marginTop: 10, gap: 10 }}>
//                 <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
//                   <Text style={{ color: "#059669", fontSize: 11, fontWeight: "700" }}>
//                     Checked in: {d.cars_checked_in || 0}
//                   </Text>
//                 </View>
//                 <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
//                   <Text style={{ color: "#0EA5E9", fontSize: 11, fontWeight: "700" }}>
//                     Retrieved: {d.cars_retrieved || 0}
//                   </Text>
//                 </View>
//               </View>
//               {d.available || d.assigned ? (
//                 <TouchableOpacity
//                   onPress={() => toggleAssign(d)}
//                   style={{
//                     marginTop: 12,
//                     borderRadius: 14,
//                     paddingVertical: 12,
//                     alignItems: "center",
//                     backgroundColor: d.assigned ? "transparent" : "#7C3AED",
//                     borderWidth: d.assigned ? 1.5 : 0,
//                     borderColor: "#F43F5E",
//                   }}
//                 >
//                   <Text
//                     style={{
//                       fontWeight: "900",
//                       letterSpacing: 1.5,
//                       color: d.assigned ? "#F43F5E" : "#fff",
//                       fontSize: 13,
//                     }}
//                   >
//                     {d.assigned ? "UNASSIGN" : "ASSIGN"}
//                   </Text>
//                 </TouchableOpacity>
//               ) : (
//                 <View style={{ marginTop: 12, backgroundColor: "#F3F4F6", borderRadius: 14, paddingVertical: 12, alignItems: "center" }}>
//                   <Text style={{ color: "#9CA3AF", fontSize: 11 }}>In {d.conflict_event_name}</Text>
//                 </View>
//               )}
//             </View>
//           ))}
//           <View style={{ height: 40 }} />
//         </ScrollView>
//       )}

//       {tab === "stats" && (
//         <ScrollView
//           style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
//           contentContainerStyle={{ paddingBottom: 100 }}
//         >
//           <TouchableOpacity onPress={fetchStats} style={{ backgroundColor: "#fff", borderRadius: 16, paddingVertical: 10, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" }}>
//             <Text style={{ color: "#7C3AED", fontWeight: "800", letterSpacing: 1 }}>↻ Refresh Stats</Text>
//           </TouchableOpacity>
//           {[
//             { color: "#7C3AED", icon: "star", label: "AVG RATING", value: stats?.avg_rating || "—" },
//             { color: "#059669", icon: "trophy", label: "TOP DRIVER", value: stats?.top_driver || "—" },
//             { color: "#F59E0B", icon: "timer", label: "AVG RETRIEVAL", value: stats?.avg_retrieval_minutes ? `${stats.avg_retrieval_minutes} min` : "—" },
//             { color: "#0EA5E9", icon: "car", label: "TOTAL CARS", value: stats?.total_cars || 0 },
//           ].map((s) => (
//             <View
//               key={s.label}
//               style={{
//                 backgroundColor: s.color,
//                 borderRadius: 24,
//                 padding: 20,
//                 marginBottom: 12,
//                 shadowColor: s.color,
//                 shadowOpacity: 0.25,
//                 shadowRadius: 14,
//                 shadowOffset: { width: 0, height: 6 },
//                 elevation: 5,
//               }}
//             >
//               <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
//                 <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>
//                   {s.label}
//                 </Text>
//                 <Ionicons name={s.icon} size={22} color="#fff" />
//               </View>
//               <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 8 }}>{s.value}</Text>
//             </View>
//           ))}
//           <View style={{ height: 40 }} />
//         </ScrollView>
//       )}

//       <Modal visible={showCarModal} animationType="slide" transparent>
//         <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
//           <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20, maxHeight: "85%" }}>
//             <View style={{ alignItems: "center", marginBottom: 12 }}>
//               <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
//             </View>
//             <ScrollView>
//               {selectedCar && (
//                 <>
//                   <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
//                     <View style={{ flex: 1 }}>
//                       <Text style={{ fontSize: 28, fontWeight: "900", color: "#7C3AED" }}>{selectedCar.plate}</Text>
//                       <Text style={{ color: "#6B7280", marginTop: 4 }}>{selectedCar.color} {selectedCar.make}</Text>
//                       <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
//                         {selectedCar.zone ? `Zone ${selectedCar.zone} · Slot ${selectedCar.slot}` : "Not parked"}
//                       </Text>
//                     </View>
//                     <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, backgroundColor: STATUS_CONFIG[selectedCar.status]?.color }}>
//                       <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
//                         {STATUS_CONFIG[selectedCar.status]?.label}
//                       </Text>
//                     </View>
//                   </View>
//                   {selectedCar.notes ? (
//                     <Text style={{ color: "#6B7280", marginTop: 12, fontStyle: "italic" }}>"{selectedCar.notes}"</Text>
//                   ) : null}

//                   <Text style={[modalLabel, { marginTop: 16 }]}>CHECK-IN PHOTOS</Text>
//                   {carPhotos.filter((p) => p.type === "checkin").length === 0 ? (
//                     <Text style={{ color: "#9CA3AF", fontSize: 13 }}>No photos available</Text>
//                   ) : (
//                     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
//                       {carPhotos.filter((p) => p.type === "checkin").map((p, i) => (
//                         <Image key={i} source={{ uri: p.url }} style={{ width: 120, height: 120, borderRadius: 14 }} />
//                       ))}
//                     </ScrollView>
//                   )}

//                   {carPhotos.find((p) => p.type === "handover") && (
//                     <>
//                       <Text style={[modalLabel, { marginTop: 16 }]}>HANDOVER PHOTO</Text>
//                       <Image
//                         source={{ uri: carPhotos.find((p) => p.type === "handover").url }}
//                         style={{ width: "100%", height: 200, borderRadius: 14 }}
//                       />
//                     </>
//                   )}

//                   <TouchableOpacity
//                     onPress={() => {
//                       setShowCarModal(false);
//                       router.push({ pathname: "/(admin)/qr-display", params: { token: selectedCar.qr_token, plate: selectedCar.plate } });
//                     }}
//                     style={{ backgroundColor: "#7C3AED", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 20 }}
//                   >
//                     <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>VIEW QR</Text>
//                   </TouchableOpacity>
//                   <TouchableOpacity
//                     onPress={() => removeCar(selectedCar)}
//                     style={{ borderWidth: 1.5, borderColor: "#F43F5E", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 8, marginBottom: 16 }}
//                   >
//                     <Text style={{ color: "#F43F5E", fontWeight: "900", letterSpacing: 2 }}>REMOVE VEHICLE</Text>
//                   </TouchableOpacity>
//                   <TouchableOpacity onPress={() => setShowCarModal(false)} style={{ paddingVertical: 10, alignItems: "center", marginBottom: 12 }}>
//                     <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
//                   </TouchableOpacity>
//                 </>
//               )}
//             </ScrollView>
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }

// const iconBtn = {
//   backgroundColor: "rgba(255,255,255,0.15)",
//   borderRadius: 99,
//   padding: 8,
// };

// const modalLabel = {
//   fontSize: 11,
//   fontWeight: "800",
//   color: "#6B7280",
//   letterSpacing: 3,
//   marginBottom: 8,
// };





// version 3 (with driver assignment)
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { connectWS, disconnectWS } from "../../lib/websocket";

const STATUS_CONFIG = {
  CHECKED_IN: { color: "#0EA5E9", label: "Checked In" },
  PARKED: { color: "#059669", label: "Parked" },
  RETRIEVAL_REQUESTED: { color: "#F59E0B", label: "Requested" },
  BEING_FETCHED: { color: "#F97316", label: "Fetching" },
  DELIVERED: { color: "#9CA3AF", label: "Delivered" },
};

const FILTERS = ["ALL", "CHECKED_IN", "PARKED", "RETRIEVAL_REQUESTED", "BEING_FETCHED", "DELIVERED"];

const cardShadow = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export default function EventDetail() {
  const router = useRouter();
  const { currentEventId } = useAppStore();
  const [event, setEvent] = useState(null);
  const [tab, setTab] = useState("cars");
  const [cars, setCars] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedCar, setSelectedCar] = useState(null);
  const [showCarModal, setShowCarModal] = useState(false);
  const [carPhotos, setCarPhotos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}`);
      setEvent(data);
    } catch {}
  }, [currentEventId]);

  const fetchCars = useCallback(async () => {
    try {
      const { data } = await api.get(`/cars/event/${currentEventId}`);
      setCars(data || []);
    } catch {}
  }, [currentEventId]);

  const fetchDrivers = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/drivers`);
      setDrivers(data || []);
    } catch {}
  }, [currentEventId]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${currentEventId}/stats`);
      setStats(data);
    } catch {}
  }, [currentEventId]);

  useEffect(() => {
    if (!currentEventId) return;
    // Run all fetches in parallel instead of sequentially
    Promise.all([fetchEvent(), fetchCars(), fetchDrivers(), fetchStats()]);
    connectWS(`/event/${currentEventId}`, (msg) => {
      if (msg.type === "car_update") fetchCars();
    });
    return () => disconnectWS(`/event/${currentEventId}`);
  }, [currentEventId]);

  const filteredCars = useMemo(() => {
    return cars.filter((c) => {
      if (search && !c.plate?.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      return true;
    });
  }, [cars, search, statusFilter]);

  const openCar = async (car) => {
    setSelectedCar(car);
    setShowCarModal(true);
    try {
      const { data } = await api.get(`/cars/${car.id}/photos`);
      setCarPhotos(data || []);
    } catch {
      setCarPhotos([]);
    }
  };

  const closeEvent = () => {
    Alert.alert("Close Event", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post(`/events/${currentEventId}/close`);
            router.back();
          } catch (e) {
            Alert.alert("Error", "Failed to close event");
          }
        },
      },
    ]);
  };

  const removeCar = (car) => {
    Alert.alert("Remove Vehicle", `Remove ${car.plate}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/cars/${car.id}`);
            setShowCarModal(false);
            fetchCars();
          } catch (e) {
            Alert.alert("Error", "Failed to remove");
          }
        },
      },
    ]);
  };

  const [assigningId, setAssigningId] = useState(null);
  const [assigningAll, setAssigningAll] = useState(false);

  const toggleAssign = async (d) => {
    setAssigningId(d.id);
    // Optimistic update — update UI immediately
    setDrivers(prev => prev.map(drv => drv.id === d.id ? { ...drv, assigned: !drv.assigned } : drv));
    try {
      if (d.assigned) {
        await api.delete(`/events/${currentEventId}/drivers/${d.id}`);
      } else {
        await api.post(`/events/${currentEventId}/drivers/${d.id}`);
      }
    } catch (e) {
      // Revert optimistic update on error
      setDrivers(prev => prev.map(drv => drv.id === d.id ? { ...drv, assigned: d.assigned } : drv));
      Alert.alert("Error", e.response?.data?.detail || "Failed");
    } finally {
      setAssigningId(null);
    }
  };

  const assignAll = async () => {
    const available = drivers.filter(d => (d.available || d.assigned) && !d.assigned);
    if (available.length === 0) return;
    setAssigningAll(true);
    // Optimistic update all at once
    setDrivers(prev => prev.map(d => (d.available || d.assigned) ? { ...d, assigned: true } : d));
    try {
      await Promise.all(available.map(d => api.post(`/events/${currentEventId}/drivers/${d.id}`)));
    } catch (e) {
      // Refetch on error to get correct state
      fetchDrivers();
      Alert.alert("Error", "Some drivers could not be assigned");
    } finally {
      setAssigningAll(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="event-detail-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
        <View
          style={{
            backgroundColor: "#7C3AED",
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(79,70,229,0.5)",
              borderBottomLeftRadius: 44,
              borderBottomRightRadius: 44,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
            <TouchableOpacity onPress={() => router.back()} style={iconBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
                {event?.name || "Event"}
              </Text>
              {event?.status && (
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <View
                    style={{
                      backgroundColor: event.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.18)",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 99,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                      {event.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(admin)/edit-event", params: { eventId: currentEventId } })}
              style={[iconBtn, { marginRight: 8 }]}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
            {event?.status === "active" && (
              <TouchableOpacity onPress={closeEvent} style={[iconBtn, { backgroundColor: "rgba(244,63,94,0.7)" }]}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Tab bar */}
      <View
        style={{
          backgroundColor: "#fff",
          flexDirection: "row",
          marginHorizontal: 16,
          marginTop: -22,
          borderRadius: 20,
          padding: 4,
          ...cardShadow,
        }}
      >
        {[["cars", "Cars"], ["drivers", "Drivers"], ["stats", "Stats"]].map(([k, l]) => (
          <TouchableOpacity
            key={k}
            onPress={() => setTab(k)}
            testID={`tab-${k}`}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: tab === k ? "#7C3AED" : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontWeight: "800",
                fontSize: 13,
                color: tab === k ? "#fff" : "#6B7280",
                letterSpacing: 1,
              }}
            >
              {l}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "cars" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchCars();
                setRefreshing(false);
              }}
              tintColor="#7C3AED"
            />
          }
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Ionicons name="search" size={18} color="#7C3AED" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search plate..."
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, paddingVertical: 12, marginLeft: 8, color: "#111827" }}
              testID="car-search"
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setStatusFilter(f)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 99,
                  backgroundColor: statusFilter === f ? "#7C3AED" : "#fff",
                  borderWidth: 1,
                  borderColor: statusFilter === f ? "#7C3AED" : "#E5E7EB",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: statusFilter === f ? "#fff" : "#6B7280",
                    letterSpacing: 1,
                  }}
                >
                  {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label || f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={{ color: "#6B7280", fontSize: 11, marginVertical: 8, fontWeight: "600" }}>
            {filteredCars.length} cars found
          </Text>
          {filteredCars.map((car) => {
            const cfg = STATUS_CONFIG[car.status] || STATUS_CONFIG.CHECKED_IN;
            return (
              <TouchableOpacity
                key={car.id}
                onPress={() => openCar(car)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 24,
                  padding: 16,
                  marginBottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  borderLeftWidth: 4,
                  borderLeftColor: cfg.color,
                  ...cardShadow,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>{car.plate}</Text>
                  <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{car.color} {car.make}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 6 }}>
                    {car.zone && car.slot && (
                      <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                        <Text style={{ color: "#374151", fontSize: 10, fontWeight: "700" }}>
                          {car.zone}-{car.slot}
                        </Text>
                      </View>
                    )}
                    <Text style={{ color: "#9CA3AF", fontSize: 11 }}>
                      {car.check_in_time ? formatDistanceToNow(new Date(car.check_in_time), { addSuffix: true }) : "Just now"}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: cfg.color }}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 0.5 }}>{cfg.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginTop: 8 }} />
                </View>
              </TouchableOpacity>
            );
          })}
          {filteredCars.length === 0 && (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text style={{ fontSize: 48 }}>🚗</Text>
              <Text style={{ color: "#6B7280", marginTop: 8, fontWeight: "700" }}>No cars yet</Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {tab === "drivers" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {drivers.length === 0 && (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text style={{ fontSize: 48 }}>👥</Text>
              <Text style={{ color: "#6B7280", marginTop: 8, fontWeight: "700" }}>No drivers</Text>
            </View>
          )}
          {drivers.length > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontWeight: "800", color: "#6B7280", fontSize: 12 }}>
                {drivers.filter(d => d.assigned).length} / {drivers.length} assigned
              </Text>
              <TouchableOpacity
                onPress={assignAll}
                disabled={assigningAll || drivers.filter(d => (d.available || d.assigned) && !d.assigned).length === 0}
                style={{
                  backgroundColor: assigningAll ? "#EDE9FE" : "#7C3AED",
                  borderRadius: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  opacity: drivers.filter(d => (d.available || d.assigned) && !d.assigned).length === 0 ? 0.5 : 1,
                }}
              >
                {assigningAll ? (
                  <ActivityIndicator size="small" color="#7C3AED" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={14} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, marginLeft: 6, letterSpacing: 1 }}>ASSIGN ALL</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          {drivers.map((d) => (
            <View
              key={d.id}
              style={{
                backgroundColor: "#fff",
                borderRadius: 24,
                padding: 16,
                marginBottom: 12,
                ...cardShadow,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: "#7C3AED",
                    borderRadius: 99,
                    width: 48,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>
                    {d.name?.[0]?.toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ flex: 1, marginLeft: 12 }}
                  onPress={() =>
                    router.push({
                      pathname: "/(admin)/driver-stats",
                      params: { driverId: d.id, driverName: d.name },
                    })
                  }
                >
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: 15 }}>{d.name}</Text>
                  <Text style={{ color: "#6B7280", fontSize: 12 }}>{d.employee_id}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        marginRight: 6,
                        backgroundColor: d.available ? "#059669" : "#F43F5E",
                      }}
                    />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: d.available ? "#059669" : "#F43F5E" }}>
                      {d.available ? "Available" : `In ${d.conflict_event_name || "another event"}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", marginTop: 10, gap: 10 }}>
                <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                  <Text style={{ color: "#059669", fontSize: 11, fontWeight: "700" }}>
                    Checked in: {d.cars_checked_in || 0}
                  </Text>
                </View>
                <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                  <Text style={{ color: "#0EA5E9", fontSize: 11, fontWeight: "700" }}>
                    Retrieved: {d.cars_retrieved || 0}
                  </Text>
                </View>
              </View>
              {d.available || d.assigned ? (
                <TouchableOpacity
                  onPress={() => toggleAssign(d)}
                  disabled={assigningId === d.id}
                  activeOpacity={0.7}
                  style={{
                    marginTop: 12,
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: "center",
                    backgroundColor: d.assigned ? "transparent" : "#7C3AED",
                    borderWidth: d.assigned ? 1.5 : 0,
                    borderColor: "#F43F5E",
                    opacity: assigningId === d.id ? 0.7 : 1,
                  }}
                >
                  {assigningId === d.id ? (
                    <ActivityIndicator size="small" color={d.assigned ? "#F43F5E" : "#fff"} />
                  ) : (
                    <Text
                      style={{
                        fontWeight: "900",
                        letterSpacing: 1.5,
                        color: d.assigned ? "#F43F5E" : "#fff",
                        fontSize: 13,
                      }}
                    >
                      {d.assigned ? "UNASSIGN" : "ASSIGN"}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={{ marginTop: 12, backgroundColor: "#F3F4F6", borderRadius: 14, paddingVertical: 12, alignItems: "center" }}>
                  <Text style={{ color: "#9CA3AF", fontSize: 11 }}>In {d.conflict_event_name}</Text>
                </View>
              )}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {tab === "stats" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <TouchableOpacity onPress={fetchStats} style={{ backgroundColor: "#fff", borderRadius: 16, paddingVertical: 10, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" }}>
            <Text style={{ color: "#7C3AED", fontWeight: "800", letterSpacing: 1 }}>↻ Refresh Stats</Text>
          </TouchableOpacity>
          {[
            { color: "#7C3AED", icon: "star", label: "AVG RATING", value: stats?.avg_rating || "—" },
            { color: "#059669", icon: "trophy", label: "TOP DRIVER", value: stats?.top_driver || "—" },
            { color: "#F59E0B", icon: "timer", label: "AVG RETRIEVAL", value: stats?.avg_retrieval_minutes ? `${stats.avg_retrieval_minutes} min` : "—" },
            { color: "#0EA5E9", icon: "car", label: "TOTAL CARS", value: stats?.total_cars || 0 },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                backgroundColor: s.color,
                borderRadius: 24,
                padding: 20,
                marginBottom: 12,
                shadowColor: s.color,
                shadowOpacity: 0.25,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>
                  {s.label}
                </Text>
                <Ionicons name={s.icon} size={22} color="#fff" />
              </View>
              <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 8 }}>{s.value}</Text>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={showCarModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20, maxHeight: "85%" }}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ backgroundColor: "#D1D5DB", width: 48, height: 4, borderRadius: 99 }} />
            </View>
            <ScrollView>
              {selectedCar && (
                <>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 28, fontWeight: "900", color: "#7C3AED" }}>{selectedCar.plate}</Text>
                      <Text style={{ color: "#6B7280", marginTop: 4 }}>{selectedCar.color} {selectedCar.make}</Text>
                      <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
                        {selectedCar.zone ? `Zone ${selectedCar.zone} · Slot ${selectedCar.slot}` : "Not parked"}
                      </Text>
                    </View>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, backgroundColor: STATUS_CONFIG[selectedCar.status]?.color }}>
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
                        {STATUS_CONFIG[selectedCar.status]?.label}
                      </Text>
                    </View>
                  </View>
                  {selectedCar.notes ? (
                    <Text style={{ color: "#6B7280", marginTop: 12, fontStyle: "italic" }}>"{selectedCar.notes}"</Text>
                  ) : null}

                  <Text style={[modalLabel, { marginTop: 16 }]}>CHECK-IN PHOTOS</Text>
                  {carPhotos.filter((p) => p.type === "checkin").length === 0 ? (
                    <Text style={{ color: "#9CA3AF", fontSize: 13 }}>No photos available</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {carPhotos.filter((p) => p.type === "checkin").map((p, i) => (
                        <Image key={i} source={{ uri: p.url }} style={{ width: 120, height: 120, borderRadius: 14 }} />
                      ))}
                    </ScrollView>
                  )}

                  {carPhotos.find((p) => p.type === "handover") && (
                    <>
                      <Text style={[modalLabel, { marginTop: 16 }]}>HANDOVER PHOTO</Text>
                      <Image
                        source={{ uri: carPhotos.find((p) => p.type === "handover").url }}
                        style={{ width: "100%", height: 200, borderRadius: 14 }}
                      />
                    </>
                  )}

                  <TouchableOpacity
                    onPress={() => {
                      setShowCarModal(false);
                      router.push({ pathname: "/(admin)/qr-display", params: { token: selectedCar.qr_token, plate: selectedCar.plate } });
                    }}
                    style={{ backgroundColor: "#7C3AED", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 20 }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2 }}>VIEW QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeCar(selectedCar)}
                    style={{ borderWidth: 1.5, borderColor: "#F43F5E", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 8, marginBottom: 16 }}
                  >
                    <Text style={{ color: "#F43F5E", fontWeight: "900", letterSpacing: 2 }}>REMOVE VEHICLE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowCarModal(false)} style={{ paddingVertical: 10, alignItems: "center", marginBottom: 12 }}>
                    <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const iconBtn = {
  backgroundColor: "rgba(255,255,255,0.15)",
  borderRadius: 99,
  padding: 8,
};

const modalLabel = {
  fontSize: 11,
  fontWeight: "800",
  color: "#6B7280",
  letterSpacing: 3,
  marginBottom: 8,
};