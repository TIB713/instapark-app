import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const processImage = async (result, quality, onSelect) => {
  if (result.canceled || !result.assets || result.assets.length === 0) return;
  
  const asset = result.assets[0];
  let uri = asset.uri;
  
  try {
    const isPortrait = asset.height > asset.width;
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: isPortrait ? { height: 1600 } : { width: 1600 } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    uri = manipResult.uri;
  } catch (e) {
    console.log("Image manipulation failed", e);
  }
  
  onSelect(uri);
};

export const pickImageHelper = ({ quality = 0.8, onSelect }) => {
  Alert.alert(
    "Choose Photo",
    "Select an option to get a photo",
    [
      {
        text: "Take Photo",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission needed", "Camera access required");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            quality,
          });
          await processImage(result, quality, onSelect);
        }
      },
      {
        text: "Choose from Gallery",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission needed", "Photo library access is required");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality,
          });
          await processImage(result, quality, onSelect);
        }
      },
      {
        text: "Cancel",
        style: "cancel"
      }
    ]
  );
};
