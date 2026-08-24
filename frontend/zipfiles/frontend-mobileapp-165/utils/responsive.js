import { Dimensions, PixelRatio } from "react-native";

const { width, height } = Dimensions.get("window");
const BASE_WIDTH = 390;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Cap the raw device-width ratio so nothing can shrink below 80% or grow
// past 115% of design size — this is what stops content from ever
// exceeding its card/stat block on larger screens.
const rawScale = width / BASE_WIDTH;
const scale = clamp(rawScale, 0.8, 1.15);

// Fonts use a dampened (moderate) scale so text grows/shrinks more
// conservatively than raw spacing does.
const moderateScale = (size, factor = 0.5) => size + (scale - 1) * size * factor;

export const rs = (size) => {
  const newSize = moderateScale(size, 0.5);
  return clamp(
    Math.round(PixelRatio.roundToNearestPixel(newSize)),
    Math.round(size * 0.8),
    Math.round(size * 1.15)
  );
};

export const rp = (size) => {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export const SCREEN_WIDTH = width;
export const SCREEN_HEIGHT = height;
export const isSmallDevice = width < 360;
export const isLargeDevice = width >= 428;
