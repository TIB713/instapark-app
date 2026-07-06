import React, { useState, useRef, useEffect } from "react";
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, Keyboard, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { rs, rp } from "../utils/responsive";
import api from "../lib/api";

export default function VenuePicker({ 
  value, 
  onSelect, 
  placeholder 
}) {
  const [textValue, setTextValue] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setTextValue(value || "");
  }, [value]);

  const handleChangeText = (text) => {
    setTextValue(text);
    
    if (text.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/places/autocomplete`, { params: { input: text } });
        if (data && data.length > 0) {
          setSuggestions(data);
          setShowDropdown(true);
        } else {
          setSuggestions([{ place_id: "NONE", description: "No matches found" }]);
          setShowDropdown(true);
        }
      } catch (err) {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleSelect = async (place) => {
    if (place.place_id === "NONE") return;
    
    Keyboard.dismiss();
    setShowDropdown(false);
    setTextValue(place.description);
    
    try {
      const { data } = await api.get(`/places/details`, { params: { place_id: place.place_id } });
      const finalName = data.name || place.description;
      setTextValue(finalName);
      onSelect({
        venue: finalName,
        venue_place_id: data.place_id,
        venue_address: data.address,
        venue_lat: data.lat,
        venue_lng: data.lng
      });
    } catch (err) {
      // Silently fail if details cannot be fetched, but still emit the name
      onSelect({
        venue: place.description,
        venue_place_id: place.place_id,
        venue_address: null,
        venue_lat: null,
        venue_lng: null
      });
    }
  };

  return (
    <View style={{ flex: 1, zIndex: 999 }}>
      <TextInput
        value={textValue}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={{ flex: 1, paddingVertical: rp(14), fontSize: rs(15), color: "#111827" }}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true);
        }}
      />
      {loading && (
        <View style={{ position: "absolute", right: rp(10), top: rp(14) }}>
          <ActivityIndicator size="small" color="#9CA3AF" />
        </View>
      )}
      {showDropdown && suggestions.length > 0 && (
        <View style={{
          position: "absolute",
          top: "100%",
          left: rp(-35), // Aligning back with InputRow layout if needed
          right: rp(-10),
          backgroundColor: "#fff",
          borderRadius: rp(12),
          borderWidth: rp(1),
          borderColor: "#E5E7EB",
          marginTop: rp(4),
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: rp(10),
          shadowOffset: { width: 0, height: rp(4) },
          elevation: 5,
          zIndex: 1000,
          maxHeight: rp(220)
        }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {suggestions.map((s, idx) => (
              <TouchableOpacity
                key={s.place_id}
                onPress={() => handleSelect(s)}
                activeOpacity={s.place_id === "NONE" ? 1 : 0.7}
                style={{
                  paddingVertical: rp(12),
                  paddingHorizontal: rp(14),
                  borderTopWidth: idx === 0 ? 0 : rp(1),
                  borderTopColor: "#F3F4F6",
                  flexDirection: "row",
                  alignItems: "center"
                }}
              >
                {s.place_id !== "NONE" && <Ionicons name="location" size={16} color="#9CA3AF" style={{ marginRight: rp(8) }} />}
                <Text style={{ fontSize: rs(13), color: s.place_id === "NONE" ? "#9CA3AF" : "#374151", flex: 1, textAlign: s.place_id === "NONE" ? "center" : "left" }} numberOfLines={2}>
                  {s.description}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
