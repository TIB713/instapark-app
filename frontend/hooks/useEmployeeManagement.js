import { useState, useCallback } from "react";
import api from "../lib/api";
import { getItem } from "../lib/secure";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { confirmDialog } from "../lib/confirmDialog";
import { useAppStore } from "../lib/store";

export function useEmployeeManagement() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const user = useAppStore((s) => s.user);

  const fetchAll = useCallback(async () => {
    // Signed out (or mid sign-out) — don't fire an authenticated request that's
    // guaranteed to 401 and log a scary error. Mirrors useSupervisorEvents' guard.
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get("/drivers");
      setDrivers(data || []);
    } catch (e) {
      if (e?.response?.status !== 401 && e?.response?.status !== 403) {
        console.warn("Failed to fetch drivers", e?.message || e);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleDownloadSample = async () => {
    try {
      setBulkLoading(true);
      const token = await getItem("auth_token");
      const fileUri = FileSystem.documentDirectory + "driver_bulk_template.xlsx";
      const { uri, status } = await FileSystem.downloadAsync(
        `${api.defaults.baseURL}/drivers/bulk-template`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (status !== 200) {
        throw new Error(`Download failed with status ${status}`);
      }
      await Sharing.shareAsync(uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    } catch (e) {
      confirmDialog.info("Error", "Failed to download sample template");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkUpload = async (file) => {
    if (!file) return;
    try {
      setBulkLoading(true);
      setBulkResult(null);
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name || "bulk_drivers.xlsx",
        type: file.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      const { data } = await api.post("/drivers/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setBulkResult({
        inserted: data.inserted,
        skipped: data.skipped,
        results: data.results || []
      });

      let csv = "Row,Name,Phone,Status,Reason\n";
      (data.results || []).forEach(r => {
        csv += `${r.row},"${r.name || ""}","${r.phone || ""}",${r.status},"${r.reason || ""}"\n`;
      });
      const fn = FileSystem.documentDirectory + `bulk_upload_result_${new Date().toISOString().split('T')[0]}.csv`;
      await FileSystem.writeAsStringAsync(fn, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fn, { mimeType: "text/csv" });
      fetchAll();
    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Failed to upload file");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleActivateDriver = async (did) => {
    try {
      setProcessingId(did);
      await api.patch(`/drivers/${did}/activate`);
      fetchAll();
    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Failed to activate driver");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDriverLongPress = (d) => {
    const action = d.is_active ? "Deactivate" : "Activate";
    const onConfirm = async () => {
      setProcessingId(d.id);
      try {
        await api.patch(`/drivers/${d.id}`, { is_active: !d.is_active });
        confirmDialog.info("Success", `${action}d successfully`);
        fetchAll();
      } catch (e) {
        confirmDialog.info("Error", e.response?.data?.detail || `Failed to ${action.toLowerCase()}`);
      } finally {
        setProcessingId(null);
      }
    };
    if (d.is_active) {
      confirmDialog.destructiveConfirm("Driver options", d.name, onConfirm, action);
    } else {
      confirmDialog.confirm("Driver options", d.name, onConfirm);
    }
  };

  return {
    drivers,
    loading,
    processingId,
    fetchAll,
    handleDownloadSample,
    handleBulkUpload,
    bulkLoading,
    bulkResult,
    setBulkResult,
    handleActivateDriver,
    handleDriverLongPress,
  };
}