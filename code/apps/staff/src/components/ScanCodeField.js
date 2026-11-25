import { useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import TextField from "./TextField";
import Button from "./Button";
import { extractTrackingCode } from "../lib/scan";
import { colors, radius } from "../theme";

// O "Quet / nhap ma van don": go tay nhu cu, hoac bam "Quet QR" mo camera sau, quet QR tren phieu giao /
// nhan kien (hoac ma vach Code 128). Quet duoc ma EXP... thi dien vao o va goi onScanned (vd tu tra cuu).
// Camera chi xin quyen khi bam nut (khong xin luc mo app).
export default function ScanCodeField({ testID, onChangeText, onScanned, ...fieldProps }) {
  const [open, setOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [hint, setHint] = useState("");
  const handled = useRef(false);

  const openScanner = async () => {
    handled.current = false;
    setHint("");
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setHint("Chưa cho phép dùng camera — hãy bật quyền camera cho ứng dụng hoặc nhập mã bằng tay.");
        return;
      }
    }
    setOpen(true);
  };

  const onBarcodeScanned = ({ data }) => {
    if (handled.current) return;
    const code = extractTrackingCode(data);
    if (!code) {
      setHint(`Mã vừa quét không phải mã vận đơn: ${String(data).slice(0, 40)}`);
      return;
    }
    handled.current = true;
    setOpen(false);
    setHint(`Đã quét: ${code}`);
    onChangeText?.(code);
    onScanned?.(code);
  };

  return (
    <View style={styles.wrap}>
      <TextField
        testID={testID}
        onChangeText={onChangeText}
        {...fieldProps}
        right={
          <Pressable
            testID={testID ? `${testID}-scan` : undefined}
            accessibilityRole="button"
            accessibilityLabel="Quét mã QR bằng camera"
            onPress={openScanner}
            style={({ pressed }) => [styles.scanBtn, pressed && styles.scanBtnPressed]}
          >
            <Text style={styles.scanText}>Quét QR</Text>
          </Pressable>
        }
      />
      {hint ? (
        <Text style={styles.hint} testID={testID ? `${testID}-scan-hint` : undefined}>
          {hint}
        </Text>
      ) : null}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr", "code128"] }}
            onBarcodeScanned={open ? onBarcodeScanned : undefined}
          />
          <View style={styles.frame} pointerEvents="none" />
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Đưa mã QR trên phiếu giao / nhãn kiện vào khung
              {Platform.OS === "web" ? " (trình duyệt cần quyền camera)" : ""}
            </Text>
            {hint ? <Text style={styles.footerWarn}>{hint}</Text> : null}
            <Button title="Đóng" variant="onDark" onPress={() => setOpen(false)} testID="scan-close" />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, flexGrow: 1 },
  scanBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  scanBtnPressed: { opacity: 0.7 },
  scanText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  hint: { fontSize: 12, color: colors.muted },
  modal: { flex: 1, backgroundColor: "#000" },
  frame: {
    position: "absolute",
    top: "25%",
    left: "15%",
    width: "70%",
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: radius.lg,
  },
  footer: { position: "absolute", left: 16, right: 16, bottom: 32, gap: 10 },
  footerText: { color: "#FFFFFF", textAlign: "center", fontSize: 14 },
  footerWarn: { color: "#FDE68A", textAlign: "center", fontSize: 13 },
});
