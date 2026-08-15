import { useState, useCallback } from "react";
import api from "../lib/api";
import { confirmDialog } from "../lib/confirmDialog";

export function useEventIncidents(currentEventId, fetchStats, fetchEvent) {
const [showIncidentModal, setShowIncidentModal] = useState(false);

const [incidentCar, setIncidentCar] = useState(null);

const [incidentDriver, setIncidentDriver] = useState(null);

const [incidentType, setIncidentType] = useState("");

const [incidentDesc, setIncidentDesc] = useState("");

const [incidentPhoto, setIncidentPhoto] = useState(null);

const [submittingIncident, setSubmittingIncident] = useState(false);

const [incidentCarSearch, setIncidentCarSearch] = useState("");

const [showResolveModal, setShowResolveModal] = useState(false);

const [resolvingIncident, setResolvingIncident] = useState(null);

const [resolveStatus, setResolveStatus] = useState("IN_REVIEW");

const [resolveRemark, setResolveRemark] = useState("");

const [submittingResolve, setSubmittingResolve] = useState(false);

const [resolveErrors, setResolveErrors] = useState({});

const [incidentErrors, setIncidentErrors] = useState({});

const [incidents, setIncidents] = useState([]);

const fetchIncidents = useCallback(async () => {
    try {
      const { data } = await api.get(`/incidents/event/${currentEventId}`);
      setIncidents(data || []);
    } catch {}
  }, [currentEventId, fetchStats, fetchEvent]);

const submitResolve = async () => {
    const errs = {};
    if ((resolveStatus === "RESOLVED" || resolveStatus === "DISMISSED") && !resolveRemark.trim()) {
      errs.remark = "Please provide a remark when resolving or dismissing.";
    }
    setResolveErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmittingResolve(true);
    try {
      await api.patch(`/incidents/${resolvingIncident.id}`, {
        status: resolveStatus,
        remark: resolveRemark
      });
      setShowResolveModal(false);
      setResolvingIncident(null);
      setResolveStatus("IN_REVIEW");
      setResolveRemark("");
      setResolveErrors({});
      fetchIncidents();
      confirmDialog.info("Success", "Incident status updated successfully");
    } catch (err) {
      console.log(err);
      confirmDialog.info("Error", "Failed to update incident status");
    } finally {
      setSubmittingResolve(false);
    }
  }

const submitIncident = async () => {
    const errs = {};
    if (!incidentCar) errs.car = "Please select a car";
    if (!incidentType) errs.type = "Please select an incident type";
    if (!incidentDesc.trim()) errs.description = "Please add a description";
    setIncidentErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmittingIncident(true);
    try {
      let photoUrl = null;
      if (incidentPhoto) {
        const formData = new FormData();
        formData.append("file", {
          uri: incidentPhoto,
          type: "image/jpeg",
          name: "incident.jpg",
        });
        formData.append("folder", `incidents/${currentEventId}`);
        const up = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        photoUrl = up.data.url;
      }
      await api.post("/incidents", {
        event_id: currentEventId,
        car_id: incidentCar.id,
        driver_id: incidentDriver?.id || null,
        incident_type: incidentType,
        description: incidentDesc.trim(),
        photo_url: photoUrl,
      });
      setShowIncidentModal(false);
      setIncidentCar(null);
      setIncidentDriver(null);
      setIncidentType("");
      setIncidentDesc("");
      setIncidentPhoto(null);
      setIncidentCarSearch("");
      setIncidentErrors({});
      fetchIncidents();
      confirmDialog.info("Saved", "Incident report saved successfully");
    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Failed to save");
    } finally {
      setSubmittingIncident(false);
    }
  }

  return {
    showIncidentModal, setShowIncidentModal,
    incidentCar, setIncidentCar,
    incidentDriver, setIncidentDriver,
    incidentType, setIncidentType,
    incidentDesc, setIncidentDesc,
    incidentPhoto, setIncidentPhoto,
    submittingIncident, setSubmittingIncident,
    incidentCarSearch, setIncidentCarSearch,
    showResolveModal, setShowResolveModal,
    resolvingIncident, setResolvingIncident,
    resolveStatus, setResolveStatus,
    resolveRemark, setResolveRemark,
    submittingResolve, setSubmittingResolve,
    resolveErrors, setResolveErrors,
    incidentErrors, setIncidentErrors,
    incidents, setIncidents,
    fetchIncidents, submitResolve, submitIncident
  };
}
