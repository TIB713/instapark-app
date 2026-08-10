import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from "react";
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, StyleSheet } from "react-native";
import { State, City } from "country-state-city";
import { rs, rp } from "../utils/responsive";

export default function CityStatePicker({ state, city, onStateChange, onCityChange }) {
  const insets = useSafeAreaInsets();

  const [showState, setShowState] = useState(false);
  const [showCity, setShowCity] = useState(false);
  const [search, setSearch] = useState("");

  const states = State.getStatesOfCountry("IN");
  const cities = state ? City.getCitiesOfState("IN", state) : [];

  const stateData = states.map(s => ({ label: s.name, value: s.isoCode }));
  const cityData = cities.map(c => ({ label: c.name, value: c.name }));

  const filtered = (list) =>
    list.filter(i => i.label.toLowerCase().includes(search.toLowerCase()));

  const PickerModal = ({ visible, data, onSelect, onClose, title }) => (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: rp(20) + (insets?.bottom || 0) }]}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.search}
            placeholder="Search..."
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          <FlatList
            data={filtered(data)}
            keyExtractor={i => i.value}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => { onSelect(item.value); onClose(); setSearch(""); }}>
                <Text style={styles.itemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.cancel} onPress={() => { onClose(); setSearch(""); }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const displayState = states.find(s => s.isoCode === state)?.name || "";

  return (
    <View style={{ gap: rp(10) }}>
      <TouchableOpacity style={styles.field} onPress={() => setShowState(true)}>
        <Text style={[styles.fieldText, !state && styles.placeholder]}>
          {displayState || "Select State"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.field, !state && styles.disabled]} onPress={() => state && setShowCity(true)}>
        <Text style={[styles.fieldText, !city && styles.placeholder]}>
          {city || "Select City"}
        </Text>
      </TouchableOpacity>
      <PickerModal visible={showState} data={stateData} title="Select State"
        onSelect={val => { onStateChange(val); onCityChange(""); }}
        onClose={() => setShowState(false)} />
      <PickerModal visible={showCity} data={cityData} title="Select City"
        onSelect={onCityChange} onClose={() => setShowCity(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: rp(20), borderTopRightRadius: rp(20), padding: rp(20), maxHeight: "75%" },
  title: { fontSize: rs(16), fontWeight: "700", color: "#1e293b", marginBottom: rp(12), textAlign: "center" },
  search: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: rp(10), padding: rp(10), fontSize: rs(14), marginBottom: rp(10) },
  item: { paddingVertical: rp(12), borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  itemText: { fontSize: rs(14), color: "#334155" },
  cancel: { marginTop: rp(10), padding: rp(12), alignItems: "center" },
  cancelText: { fontSize: rs(14), color: "#ef4444", fontWeight: "600" },
  field: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: rp(10), padding: rp(12), backgroundColor: "#fff" },
  fieldText: { fontSize: rs(14), color: "#334155" },
  placeholder: { color: "#94a3b8" },
  disabled: { opacity: 0.5 },
});
