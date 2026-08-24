import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

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
          if (!result.canceled) {
            onSelect(result.assets[0].uri);
          }
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
          if (!result.canceled) {
            onSelect(result.assets[0].uri);
          }
        }
      },
      {
        text: "Cancel",
        style: "cancel"
      }
    ]
  );
};
