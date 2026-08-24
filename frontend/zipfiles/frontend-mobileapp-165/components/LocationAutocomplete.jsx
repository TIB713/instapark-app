import React, { useState, useRef } from "react";
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, Keyboard, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { rs, rp } from "../utils/responsive";
import api from "../lib/api";

export default function LocationAutocomplete({ 
  value, 
  onSelect, 
  testID, 
  placeholder, 
  placeholderTextColor, 
  style 
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);

  const handleChangeText = (text) => {
    // 1. Immediately update parent state via onSelect fallback
    onSelect({
      venue: text,
      venue_place_id: null,
      venue_address: null,
      venue_lat: null,
      venue_lng: null
    });

    // 2. Fetch suggestions
    if (!text.trim()) {
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
          setSuggestions([]);
          setShowDropdown(false);
        }
      } catch (err) {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const handleSelect = async (place) => {
    Keyboard.dismiss();
    setShowDropdown(false);
    // Optimistically update venue text while fetching details
    onSelect({
      venue: place.description,
      venue_place_id: place.place_id,
      venue_address: null,
      venue_lat: null,
      venue_lng: null
    });
    
    try {
      const { data } = await api.get(`/places/details`, { params: { place_id: place.place_id } });
      onSelect({
        venue: data.name || place.description,
        venue_place_id: data.place_id,
        venue_address: data.address,
        venue_lat: data.lat,
        venue_lng: data.lng
      });
    } catch (err) {
      // If details fail, at least we have the prediction description and place_id
    }
  };

  return (
    <View style={{ flex: 1, zIndex: 999 }}>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        style={style}
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
          left: rp(-35), // Extend slightly left over the icon in InputRow
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
                style={{
                  paddingVertical: rp(12),
                  paddingHorizontal: rp(14),
                  borderTopWidth: idx === 0 ? 0 : rp(1),
                  borderTopColor: "#F3F4F6",
                  flexDirection: "row",
                  alignItems: "center"
                }}
              >
                <Ionicons name="location" size={16} color="#9CA3AF" style={{ marginRight: rp(8) }} />
                <Text style={{ fontSize: rs(13), color: "#374151", flex: 1 }} numberOfLines={2}>
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
