import { Dimensions, PixelRatio } from "react-native";

const { width } = Dimensions.get("window");
const BASE_WIDTH = 390;
const scale = width / BASE_WIDTH;

export const rs = (size) => {
  const newSize = size * scale;
  return Math.max(Math.round(PixelRatio.roundToNearestPixel(newSize)), size * 0.75);
};

export const rp = (size) => Math.round(PixelRatio.roundToNearestPixel(size * scale));
