import { useState, useCallback } from "react";
import api from "../lib/api";
import { confirmDialog } from "../lib/confirmDialog";

export function useEventCars(currentEventId, fetchEvent) {
const [cars, setCars] = useState([]);

const [carStats, setCarStats] = useState(null);

const [drivers, setDrivers] = useState([]);

const [stats, setStats] = useState(null);

const [search, setSearch] = useState("");

const [statusFilter, setStatusFilter] = useState("ALL");

const [selectedCar, setSelectedCar] = useState(null);

const [showCarModal, setShowCarModal] = useState(false);

const [carPhotos, setCarPhotos] = useState([]);

const [showAssignPicker, setShowAssignPicker] = useState(false);

const [assignSuggestion, setAssignSuggestion] = useState(null);

const [assigningDriver, setAssigningDriver] = useState(false);

const [slots, setSlots] = useState([]);

const [assigningId, setAssigningId] = useState(null);

const [assigningAll, setAssigningAll] = useState(false);

const fetchSlots = useCallback(async () => {
    try {
      const { data } = await api.get(`/slots/event/${currentEventId}`);
      setSlots(data || []);
    } catch {}
  }, [currentEventId]);

const fetchCars = useCallback(async () => {
    try {
      const { data } = await api.get(`/cars/event/${currentEventId}`);
      setCars(data || []);
      
      if (data && data.length > 0) {
        const total = data.length;
        const delivered = data.filter(c => c.status === "DELIVERED").length;
        const parked = data.filter(c => c.status === "PARKED").length;
        const retrieving = data.filter(c => c.status === "RETRIEVAL_REQUESTED" || c.status === "BEING_FETCHED").length;
        const checkedIn = data.filter(c => c.status === "CHECKED_IN").length;
        setCarStats({ total, delivered, parked, retrieving, checkedIn });
      }
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

const handleAssignDriver = async (driverId, driverName) => {
    confirmDialog.confirm(
      "Confirm assignment",
      `Assign ${driverName} to ${selectedCar?.plate}?`,
      () => doAssign(driverId)
    );
  }

const assignAll = async () => {
    const available = drivers.filter(d => (d.available || d.assigned) && !d.assigned);
    if (available.length === 0) return;
    confirmDialog.confirm(
      "Assign all drivers",
      `Assign all ${available.length} available drivers to this event?`,
      () => doAssignAll(available)
    );
  }



const doAssign = async (driverId) => {
    const stage = (selectedCar.status === "RETRIEVAL_REQUESTED" || selectedCar.status === "BEING_FETCHED") ? "retrieval" : "checkin";
    setAssigningDriver(true);
    try {
      await api.patch(`/cars/${selectedCar.id}/reassign-driver`, { driver_id: driverId, stage });
      setShowAssignPicker(false);
      setShowCarModal(false);
      fetchCars();
      fetchDrivers();
    } catch (err) {
      confirmDialog.info("Error", err.response?.data?.detail || "Failed to assign driver");
    } finally {
      setAssigningDriver(false);
    }
  };

const doToggleAssign = async (d) => {
    setAssigningId(d.id);
    setDrivers(prev => prev.map(drv => drv.id === d.id ? { ...drv, assigned: !drv.assigned } : drv));
    try {
      if (d.assigned) {
        await api.delete(`/events/${currentEventId}/drivers/${d.id}`);
      } else {
        await api.post(`/events/${currentEventId}/drivers/${d.id}`);
      }
    } catch (e) {
      setDrivers(prev => prev.map(drv => drv.id === d.id ? { ...drv, assigned: d.assigned } : drv));
      confirmDialog.info("Error", e.response?.data?.detail || "Failed");
    } finally {
      setAssigningId(null);
    }
  };

const doAssignAll = async (available) => {
    setAssigningAll(true);
    setDrivers(prev => prev.map(d => (d.available || d.assigned) ? { ...d, assigned: true } : d));
    try {
      await Promise.all(available.map(d => api.post(`/events/${currentEventId}/drivers/${d.id}`)));
    } catch (e) {
      fetchDrivers();
      confirmDialog.info("Error", "Some drivers could not be assigned");
    } finally {
      setAssigningAll(false);
    }
  };

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

const openAssignPicker = async () => {
    setShowAssignPicker(true);
    setAssignSuggestion(null);
    if (selectedCar.status === "RETRIEVAL_REQUESTED" || selectedCar.status === "BEING_FETCHED") {
      try {
        const { data } = await api.get(`/cars/${selectedCar.id}/suggest-retrieval-driver`);
        setAssignSuggestion(data.suggestion || null);
      } catch {
        setAssignSuggestion(null);
      }
    }
  };

const toggleAssign = async (d) => {
    confirmDialog.confirm(
      d.assigned ? "Remove driver" : "Assign driver",
      d.assigned ? `Remove ${d.name} from this event?` : `Assign ${d.name} to this event?`,
      () => doToggleAssign(d)
    );
  };

const removeCar = (car) => {
    confirmDialog.destructiveConfirm(
      "Remove vehicle",
      `Remove ${car.plate}?`,
      async () => {
        try {
          await api.delete(`/cars/${car.id}`);
          setShowCarModal(false);
          fetchCars();
        } catch (e) {
          confirmDialog.info("Error", "Failed to remove");
        }
      },
      "Remove"
    );
  };

  return {
    cars, setCars,
    carStats, setCarStats,
    drivers, setDrivers,
    stats, setStats,
    search, setSearch,
    statusFilter, setStatusFilter,
    selectedCar, setSelectedCar,
    showCarModal, setShowCarModal,
    carPhotos, setCarPhotos,
    showAssignPicker, setShowAssignPicker,
    assignSuggestion, setAssignSuggestion,
    assigningDriver, setAssigningDriver,
    slots, setSlots,
    assigningId, setAssigningId,
    assigningAll, setAssigningAll,
    fetchCars, fetchDrivers, fetchStats, fetchSlots, handleAssignDriver, assignAll,
    doAssign, doToggleAssign, doAssignAll, openCar, openAssignPicker, toggleAssign, removeCar
  };
}
