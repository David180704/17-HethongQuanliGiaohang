import { Alert, Platform } from "react-native";

// Alert.alert cua react-native-web khong lam gi ca, nen tren web dung
// window.confirm. Tra ve Promise<boolean> de dung chung mot kieu goi.
export function confirmAsync(title, message, confirmLabel = "Đồng ý") {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title} ${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Hủy", style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
