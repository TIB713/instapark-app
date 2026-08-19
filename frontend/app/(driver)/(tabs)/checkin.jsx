import React, { useState, useRef, useCallback, memo } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { Modal as RNModal } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import { useDriverTasksContext } from "../../../context/DriverTasksContext";
import { confirmDialog } from "../../../lib/confirmDialog";
import { Screen, TopBar, Btn, Modal } from "../../../components/valet/ui";
import { theme } from "../../../utils/theme";
import { rs, rp } from "../../../utils/responsive";

const REQUIRED_PHOTO_COUNT = 2;
const PHOTO_LABELS = ["front", "right", "back", "left", "extra"];

const STATUS_LABELS = {
  REGISTERED: "Registered",
  CHECKED_IN: "checked in",
  PARKED: "parked",
  RETRIEVAL_REQUESTED: "requested for retrieval",
  BEING_FETCHED: "being fetched",
  ARRIVED_AT_GATE: "at the gate",
  AWAITING_REPARK: "awaiting repark",
  DELIVERED: "delivered"
};

function Lbl({ children }) {
  return (
    <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(3), marginBottom: rp(8), marginTop: rp(4) }}>
      {children}
    </Text>
  );
}

const PhotoGridSection = memo(({ photos, errors, takePhoto, onRemovePhoto }) => {
  return (
    <View style={{ marginBottom: 20 }}>
      <Lbl>VEHICLE PHOTOS * (AT LEAST 2 REQUIRED)</Lbl>
      <View style={{ 
        flexDirection: "row", flexWrap: "wrap", gap: rp(10), 
        borderWidth: errors.photos ? rp(1) : 0, 
        borderColor: theme.colors.danger, 
        borderRadius: rp(16), 
        padding: errors.photos ? rp(8) : 0,
        marginBottom: errors.photos ? 0 : rp(16)
      }}>
        {PHOTO_LABELS.map((label) => (
          <View key={label} style={{ width: rp(80), height: rp(80) }}>
            {photos[label] ? (
              <>
                <Image source={{ uri: photos[label] }} style={{ width: rp(80), height: rp(80), borderRadius: rp(16), borderWidth: rp(1.5), borderColor: theme.colors.success, borderStyle: "dashed" }} />
                <TouchableOpacity
                  onPress={() => onRemovePhoto(label)}
                  style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                >
                  <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => takePhoto(label)}
                style={{
                  width: rp(80), height: rp(80), borderRadius: rp(16),
                  backgroundColor: theme.colors.surface, borderWidth: rp(1.5), borderColor: theme.colors.border,
                  borderStyle: "dashed", alignItems: "center", justifyContent: "center"
                }}
              >
                <Ionicons name="camera-outline" size={28} color={theme.colors.textSecondary} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: rs(10), fontWeight: "800", marginTop: rp(4), textTransform: "uppercase" }}>{label}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
      {errors.photos && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4) }}>* {errors.photos}</Text>}
    </View>
  );
});

export default function Checkin() {
  const router = useRouter();
  const { currentEventId, driver } = useAppStore();
  const { openParkModal } = useDriverTasksContext();
  
  const [code, setCode] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  
  const [claimCar, setClaimCar] = useState(null);
  const [photos, setPhotos] = useState({ front: null, back: null, left: null, right: null, extra: null });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successCar, setSuccessCar] = useState(null);

  const permissionGrantedRef = useRef(false);

  const resizedPhotosRef = useRef({});
  const resizeQueueRef = useRef(Promise.resolve());
  const uploadPromisesRef = useRef({});
  const [nextPhotoLabel, setNextPhotoLabel] = useState(null);

  const handleLookup = async () => {
    if (!code || code.length < 4) return;
    setLookingUp(true);
    try {
      const { data } = await api.get(`/cars/lookup-by-code/${code.trim()}`, { 
        params: { event_id: currentEventId } 
      });
      if (data) {
        startClaim(data);
      }
    } catch (e) {
      if (e.response && e.response.status === 404) {
        confirmDialog.info("Not found", "No car found for this code");
      } else {
        confirmDialog.info("Error", e.response?.data?.detail || "An error occurred");
      }
    } finally {
      setLookingUp(false);
    }
  };

  const startClaim = (car) => {
    setClaimCar(car);
    setPhotos({ front: null, back: null, left: null, right: null, extra: null });
    setErrors({});
  };

  const cancelClaim = () => {
    setCode("");
    setClaimCar(null);
    setPhotos({ front: null, back: null, left: null, right: null, extra: null });
    setNextPhotoLabel(null);
  };

  const takePhoto = useCallback(async (label) => {
    if (!permissionGrantedRef.current) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { 
        confirmDialog.info("Camera permission needed", ""); 
        return; 
      }
      permissionGrantedRef.current = true;
    }
    
    const result = await ImagePicker.launchCameraAsync({ 
      quality: 0.7, 
      allowsEditing: false, 
      mediaTypes: ImagePicker.MediaTypeOptions.Images 
    });
    
    if (!result.canceled) {
      const rawUri = result.assets[0].uri;
      setPhotos(prev => {
        const next = { ...prev, [label]: rawUri };
        if (errors.photos && Object.values(next).filter(Boolean).length >= REQUIRED_PHOTO_COUNT) {
          setErrors(e => ({ ...e, photos: undefined }));
        }

        const currentIndex = PHOTO_LABELS.indexOf(label);
        const remaining = PHOTO_LABELS.slice(currentIndex + 1);
        const nextLabel = remaining.find(l => !next[l] && l !== label);
        if (nextLabel) {
          setNextPhotoLabel(nextLabel);
        }

        return next;
      });

      resizeQueueRef.current = resizeQueueRef.current.then(() =>
        ImageManipulator.manipulateAsync(rawUri, [{ resize: { width: 1280 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG })
          .then((resized) => { resizedPhotosRef.current[label] = resized.uri; })
          .catch(() => { resizedPhotosRef.current[label] = rawUri; })
      );

      uploadPromisesRef.current[label] = (async () => {
        await resizeQueueRef.current.catch(() => {});
        const uri = resizedPhotosRef.current[label] || rawUri;
        const fd = new FormData();
        fd.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
        fd.append("folder", `checkin/${claimCar.id}`);
        const up = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        return up.data.url;
      })();
    }
  }, [errors.photos, claimCar]);

  const onRemovePhoto = useCallback((label) => {
    setPhotos(prev => ({ ...prev, [label]: null }));
    delete uploadPromisesRef.current[label];
    delete resizedPhotosRef.current[label];
  }, []);

  const handleSubmitClaim = async () => {
    const validPhotosCount = Object.values(photos).filter(Boolean).length;
    if (validPhotosCount < REQUIRED_PHOTO_COUNT) {
      setErrors({ photos: `Please upload at least ${REQUIRED_PHOTO_COUNT} photos.` });
      return;
    }
    
    setSubmitting(true);
    
    try {
      const entries = Object.entries(photos).filter(([, uri]) => !!uri);
      
      const results = await Promise.allSettled(entries.map(async ([label]) => {
        const url = await uploadPromisesRef.current[label];
        return { label, url };
      }));
      
      const urls = [];
      const failedLabels = [];
      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          urls.push(r.value.url);
        } else {
          failedLabels.push(entries[idx][0]);
        }
      });
      
      if (urls.length < REQUIRED_PHOTO_COUNT) {
        setSubmitting(false);
        setErrors({ photos: `Upload failed. Only ${urls.length} succeeded. At least 2 are required. Try taking the missing photos again.` });
        
        setPhotos(prev => {
          const np = { ...prev };
          Object.keys(np).forEach(k => {
            if (np[k] && !failedLabels.includes(k)) {
              np[k] = null;
            }
          });
          return prev; 
        });
        return;
      }
      
      await api.patch(`/cars/${claimCar.id}/claim-checkin`, {
        driver_id: driver?.id,
        photos: urls
      });
      
      setSuccessCar(claimCar);
      setShowSuccessModal(true);
      
    } catch (e) {
      if (e.response && e.response.status === 400 && e.response.data?.detail?.includes("already claimed")) {
        confirmDialog.info("Not available", "Car already claimed by another driver");
        cancelClaim();
      } else {
        confirmDialog.info("Error", "Could not claim car. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    setShowSuccessModal(false);
    setSuccessCar(null);
    cancelClaim();
  };

  const handlePark = () => {
    const carToPark = successCar;
    setShowSuccessModal(false);
    setSuccessCar(null);
    cancelClaim();
    if (carToPark) {
      openParkModal(carToPark);
      router.push("/(driver)/(tabs)/park");
    }
  };

  const renderStatusMessage = () => {
    if (claimCar.status === "CHECKED_IN" && claimCar.check_in_driver_id) {
      return "This car has already been claimed by another driver.";
    }
    const friendlyLabel = STATUS_LABELS[claimCar.status] || claimCar.status.toLowerCase();
    return `This car is already ${friendlyLabel}.`;
  };

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.colors.surface }} />
      <TopBar title="Check In" hideBack />
      
      <ScrollView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          
          <View style={{ padding: rp(20), paddingBottom: rp(10), backgroundColor: theme.colors.surface, borderBottomWidth: claimCar ? 0 : rp(1), borderBottomColor: theme.colors.border }}>
            <Text style={{ fontSize: rs(13), fontWeight: "700", color: theme.colors.textDark, marginBottom: rp(12) }}>Claim by Code</Text>
            <View style={{ flexDirection: "row", gap: rp(10), alignItems: "center" }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.bgLight, borderRadius: rp(12), borderWidth: rp(1), borderColor: theme.colors.border, paddingHorizontal: rp(12) }}>
                <Ionicons name="keypad" size={20} color={theme.colors.textLight} />
                <TextInput 
                  value={code} 
                  onChangeText={setCode} 
                  placeholder="4-digit code" 
                  keyboardType="number-pad"
                  maxLength={4}
                  editable={!claimCar}
                  style={{ flex: 1, paddingVertical: rp(12), paddingHorizontal: rp(10), fontSize: rs(16), fontWeight: "600", color: claimCar ? theme.colors.textLight : theme.colors.textDark }}
                />
              </View>
              {claimCar ? (
                <TouchableOpacity onPress={cancelClaim} style={{ paddingHorizontal: rp(16), paddingVertical: rp(12) }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: "700", fontSize: rs(15) }}>Change</Text>
                </TouchableOpacity>
              ) : (
                <Btn onPress={handleLookup} disabled={code.length < 4 || lookingUp} style={{ minWidth: rp(80) }}>
                  {lookingUp ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>Check In</Text>}
                </Btn>
              )}
            </View>
          </View>
          
          {claimCar && (
            <View style={{ padding: rp(20) }}>
              <View style={{ backgroundColor: theme.colors.surface, padding: rp(20), borderRadius: rp(16), marginBottom: rp(20), borderWidth: rp(1), borderColor: theme.colors.border }}>
                <Text style={{ fontSize: rs(12), color: theme.colors.textLight, textTransform: "uppercase", letterSpacing: rs(1), marginBottom: rp(4) }}>Check-In Code</Text>
                <Text style={{ fontSize: rs(28), fontWeight: "900", color: theme.colors.textDark, marginBottom: rp(12) }}>{claimCar.checkin_code}</Text>
                
                <Text style={{ fontSize: rs(12), color: theme.colors.textLight, textTransform: "uppercase", letterSpacing: rs(1), marginBottom: rp(4) }}>Vehicle</Text>
                <Text style={{ fontSize: rs(22), fontWeight: "900", color: theme.colors.textDark }}>{claimCar.plate}</Text>
              </View>
              
              {claimCar.status === "REGISTERED" ? (
                <>
                  <PhotoGridSection 
                    photos={photos} 
                    errors={errors} 
                    takePhoto={takePhoto} 
                    onRemovePhoto={onRemovePhoto} 
                  />
                  
                  <Btn onPress={handleSubmitClaim} disabled={submitting} style={{ marginTop: rp(10), marginBottom: rp(40) }}>
                    {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>CLAIM CAR</Text>}
                  </Btn>
                </>
              ) : (
                <View style={{ backgroundColor: theme.colors.bgLight, padding: rp(20), borderRadius: rp(16), borderWidth: rp(1), borderColor: theme.colors.border, alignItems: "center" }}>
                  <Ionicons name="information-circle" size={32} color={theme.colors.textLight} style={{ marginBottom: rp(8) }} />
                  <Text style={{ fontSize: rs(15), color: theme.colors.textDark, textAlign: "center", fontWeight: "600" }}>
                    {renderStatusMessage()}
                  </Text>
                </View>
              )}
            </View>
          )}

        </KeyboardAvoidingView>
      </ScrollView>
      
      <RNModal visible={!!nextPhotoLabel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Next Photo</Text>
            <Text style={styles.modalSub}>Now capture the {nextPhotoLabel?.toUpperCase()} of the vehicle</Text>
            <View style={{ gap: rp(12), width: '100%', marginTop: rp(10) }}>
              <Btn onPress={() => {
                const label = nextPhotoLabel;
                setNextPhotoLabel(null);
                takePhoto(label);
              }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>Continue</Text>
              </Btn>
              <Btn variant="secondary" onPress={() => setNextPhotoLabel(null)}>
                <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Done for now</Text>
              </Btn>
            </View>
          </View>
        </View>
      </RNModal>

      <Modal open={showSuccessModal} onClose={handleDone} title="Car Claimed">
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={32} color="#FFFFFF" />
        </View>
        <Text style={styles.modalSub}>You are now responsible for {successCar?.plate}</Text>
        <View style={{ gap: rp(12), width: '100%', marginTop: rp(10) }}>
          <Btn onPress={handlePark}>
            <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>Continue to Parking</Text>
          </Btn>
          <Btn variant="secondary" onPress={handleDone}>
            <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Done</Text>
          </Btn>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 32, 68, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: rp(20),
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    borderRadius: rp(24),
    padding: rp(30),
    alignItems: "center",
  },
  modalTitle: {
    fontSize: rs(24),
    fontWeight: "900",
    color: theme.colors.textDark,
    marginBottom: rp(8),
  },
  successIcon: {
    width: rp(64),
    height: rp(64),
    borderRadius: rp(32),
    backgroundColor: theme.colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: rp(20),
    alignSelf: "center",
  },
  modalSub: {
    fontSize: rs(15),
    color: theme.colors.textLight,
    textAlign: "center",
    marginBottom: rp(30),
  },
});