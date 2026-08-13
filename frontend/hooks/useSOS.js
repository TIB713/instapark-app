import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import api from '../lib/api';
import { confirmDialog } from '../lib/confirmDialog';
import { useAppStore } from '../lib/store';

export function useSOS() {
  const { currentEventId } = useAppStore();
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosAlertType, setSosAlertType] = useState("NEED_HELP");
  const [sosNote, setSosNote] = useState("");
  const [sosCarId, setSosCarId] = useState(null);
  const [sosCarNumber, setSosCarNumber] = useState("");
  const [sendingSOS, setSendingSOS] = useState(false);
  const [sosPhoto, setSosPhoto] = useState(null);

  const openSOS = (carId = null, carNumber = "") => {
    setSosCarId(carId);
    setSosCarNumber(carNumber);
    setSosAlertType("NEED_HELP");
    setSosNote("");
    setSosPhoto(null);
    setShowSOSModal(true);
  };

  const closeSOS = () => {
    setShowSOSModal(false);
    setSosNote("");
    setSosPhoto(null);
    setSosCarId(null);
    setSosCarNumber("");
  };

  const takeSosPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled) setSosPhoto(result.assets[0].uri);
  };

  const sendSOS = async () => {
    if (!currentEventId) return;
    setSendingSOS(true);
    try {
      let uploadUrl = null;
      if (sosPhoto) {
        try {
          const fd = new FormData();
          fd.append("file", { uri: sosPhoto, type: "image/jpeg", name: "sos.jpg" });
          fd.append("folder", `sos/${currentEventId}`);
          const { data: uploadData } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
          uploadUrl = uploadData?.url || null;
        } catch (uploadErr) {
          console.warn("SOS photo upload failed", uploadErr);
        }
      }

      await api.post(`/sos/event/${currentEventId}`, {
        alert_type: sosAlertType,
        note: sosNote,
        car_id: sosCarId,
        car_number: sosCarNumber,
        photo_url: uploadUrl,
      });

      closeSOS();
      
      if (sosPhoto && !uploadUrl) {
        confirmDialog.info("Photo upload failed", "Your SOS was sent, but the photo did not attach. Please inform your supervisor.");
      } else {
        confirmDialog.info("SOS sent", "Your supervisor has been notified.");
      }
    } catch {
      confirmDialog.info("Error", "Failed to send SOS. Please try again.");
    } finally {
      setSendingSOS(false);
    }
  };

  return {
    state: {
      showSOSModal,
      sosAlertType,
      sosNote,
      sosCarId,
      sosCarNumber,
      sendingSOS,
      sosPhoto,
    },
    openSOS,
    closeSOS,
    setSosAlertType,
    setSosNote,
    takeSosPhoto,
    sendSOS
  };
}
