import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet, Dimensions, Image } from "react-native";

export default function AppLoader() {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <View style={styles.badgeContainer}>
        {/* The spinning gold arc */}
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
        
        {/* The cream circle with thin gold ring */}
        <View style={styles.circle}>
          <Image 
            source={require("../assets/images/instapark-logo-with-credit.png")} 
            style={styles.fullLogo} 
            resizeMode="contain"
          />
        </View>
      </View>
      
      <Text style={styles.loadingText}>Loading experience...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff", // Deep purple
    alignItems: "center",
    justifyContent: "center",
  },
  badgeContainer: {
    width: 320,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 60,
  },
  spinner: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 8,
    borderColor: "transparent",
    borderTopColor: "#FCBF00", // Gold arc
    borderRightColor: "#FCBF00",
  },
  circle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#FAF7F2", // Cream
    borderWidth: 4,
    borderColor: "#FCBF00", // Gold ring
    alignItems: "center",
    justifyContent: "center",
  },
  fullLogo: {
    width: 200,
    height: 200,
  },
  loadingText: {
    color: "#FAF7F2", // Cream text
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
});
