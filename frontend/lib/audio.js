import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";

let configured = false;

export async function configureBackgroundAudio() {
  if (configured) return;
  configured = true;
  try {
    await Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });
  } catch (e) {
    console.warn("Failed to configure background audio mode", e);
  }
}
