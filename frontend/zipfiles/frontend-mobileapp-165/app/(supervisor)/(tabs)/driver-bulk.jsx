import React, { useState } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { theme } from "../../../utils/theme";
import { rs, rp } from "../../../utils/responsive";
import { Screen, TopBar, Card, Btn, Chip, Modal } from "../../../components/valet/ui";
import { useEmployeeManagement } from "../../../hooks/useEmployeeManagement";

export default function DriverBulkUpload() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { bulkLoading, bulkResult, setBulkResult, handleDownloadSample, handleBulkUpload } = useEmployeeManagement();
  const [selectedFile, setSelectedFile] = useState(null);

  const handleSelectFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setSelectedFile(res.assets[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleImport = () => {
    if (selectedFile) {
      handleBulkUpload(selectedFile);
    }
  };

  const expectedColumns = ["name", "driver_code", "mobile", "licence_no", "shift", "available"];

  return (
    <Screen scroll={false}>
      <TopBar 
        title="Bulk add drivers" 
        subtitle="TEAM"
        onBack={() => router.replace("/(supervisor)/(tabs)/team")}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: rp(theme.spacing.xl), paddingTop: rp(theme.spacing.xl), paddingBottom: rp(40) + tabBarHeight, gap: rp(theme.spacing.lg) }}>
        
        <View style={{ flexDirection: "row", gap: rp(8), alignItems: "center", marginBottom: rp(theme.spacing.sm) }}>
          <Chip label="Excel / CSV" size="small" />
          {selectedFile && <Chip label="File Selected" size="small" variant="success" />}
        </View>

        {/* Numbered Steps */}
        <View style={{ gap: rp(theme.spacing.md) }}>
          {[
            "Download the sample sheet and fill one driver per row",
            "Upload the completed file — we validate every row",
            "Review the preview and import your team"
          ].map((step, index) => (
            <Card key={index} style={{ flexDirection: "row", alignItems: "center", padding: rp(theme.spacing.md) }}>
              <View style={{ 
                width: rp(24), height: rp(24), borderRadius: rp(12), 
                backgroundColor: theme.colors.primaryLight, 
                alignItems: "center", justifyContent: "center", 
                marginRight: rp(theme.spacing.md) 
              }}>
                <Text style={{ color: theme.colors.primary, fontWeight: "bold", fontSize: rs(12) }}>{index + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: rs(14), fontWeight: "600", color: theme.colors.textPrimary }}>
                {step}
              </Text>
            </Card>
          ))}
        </View>

        {/* Expected Columns */}
        <View style={{ marginTop: rp(theme.spacing.md) }}>
          <Text style={{ fontSize: rs(12), color: theme.colors.textSecondary, marginBottom: rp(theme.spacing.sm), fontWeight: "600" }}>
            Expected columns
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(theme.spacing.xs) }}>
            {expectedColumns.map(col => (
              <Chip key={col} label={col} size="small" variant="outline" />
            ))}
          </View>
        </View>

        {/* File Preview Card */}
        {selectedFile && (
          <Card style={{ marginTop: rp(theme.spacing.lg), padding: rp(theme.spacing.lg) }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name="document-text" size={24} color={theme.colors.primary} style={{ marginRight: rp(theme.spacing.md) }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: rs(14), fontWeight: "bold", color: theme.colors.textPrimary }} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={{ fontSize: rs(12), color: theme.colors.textSecondary }}>
                    Ready to import
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleRemoveFile} style={{ padding: rp(theme.spacing.xs) }}>
                <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={{ marginTop: rp(theme.spacing.xl), gap: rp(theme.spacing.md) }}>
          <Btn variant="outline" onPress={handleDownloadSample} disabled={bulkLoading}>
            <Ionicons name="download-outline" size={18} color={theme.colors.primary} style={{ marginRight: rp(8) }} />
            Download sample file
          </Btn>
          
          {!selectedFile ? (
            <Btn variant="primary" onPress={handleSelectFile} disabled={bulkLoading}>
              <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.surface} style={{ marginRight: rp(8) }} />
              Select excel file
            </Btn>
          ) : (
            <Btn variant="dark" onPress={handleImport} disabled={bulkLoading}>
              {bulkLoading ? <ActivityIndicator size="small" color={theme.colors.surface} /> : "Import drivers"}
            </Btn>
          )}
        </View>

      </ScrollView>

      {/* Success Modal */}
      <Modal open={!!bulkResult} onClose={() => setBulkResult(null)}>
        <View style={{ alignItems: "center", padding: rp(theme.spacing.lg) }}>
          <View style={{ backgroundColor: theme.colors.successLight, padding: rp(16), borderRadius: rp(99), marginBottom: rp(theme.spacing.md) }}>
            <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
          </View>
          <Text style={{ fontSize: rs(18), fontWeight: "bold", color: theme.colors.textPrimary, marginBottom: rp(theme.spacing.sm) }}>
            {bulkResult?.inserted || 0} drivers imported
          </Text>
          <Text style={{ fontSize: rs(14), color: theme.colors.textSecondary, textAlign: "center", marginBottom: rp(theme.spacing.xl) }}>
            {bulkResult?.skipped || 0} rows skipped — fix and re-upload anytime.
          </Text>
          <Btn variant="primary" onPress={() => {
            setBulkResult(null);
            router.replace("/(supervisor)/(tabs)/team");
          }} style={{ width: "100%" }}>
            View team
          </Btn>
        </View>
      </Modal>

    </Screen>
  );
}
