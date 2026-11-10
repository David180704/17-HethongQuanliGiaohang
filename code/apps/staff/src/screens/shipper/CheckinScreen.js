import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Banner from "../../components/Banner";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatPosition, getPosition, loadPosition, setPosition } from "../../lib/location";
import { flushQueue, onPendingChange, sendCheckin } from "../../lib/checkinQueue";
import { formatTime } from "../../lib/queryCache";
import { colors, radius } from "../../theme";

const FLUSH_INTERVAL_MS = 15_000;

// US-30: vi tri GIA LAP cua tai xe (chon "dang o" mot diem hoac nhap toa do; tren may ao co the dung toa do cua
// `adb emu geo fix`). Moi lan doi vi tri, app tu gui check-in; nam trong ban kinh diem nao thi server ghi moc
// cho cac don dang cam. Mat mang -> xep hang doi, tu gui lai moi 15 giay. Check-in tay la du phong.
export default function CheckinScreen({ accent, onBack }) {
  const [points, setPoints] = useState([]);
  const [position, setPositionState] = useState(getPosition());
  const [auto, setAuto] = useState(true);
  const [pending, setPending] = useState(0);
  const [log, setLog] = useState([]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadPosition().then(setPositionState);
    apiClient
      .get("/checkins/points")
      .then((res) => setPoints(res.data.data))
      .catch((err) => setError(errorMessage(err, "Không tải được điểm check-in")));
    const unsubscribe = onPendingChange(setPending);
    flushQueue();
    const timer = setInterval(() => flushQueue(), FLUSH_INTERVAL_MS);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const addLog = (text) => setLog((current) => [`${formatTime(new Date())} · ${text}`, ...current].slice(0, 8));

  const report = useCallback((result, label) => {
    if (result.queued) {
      addLog(`${label}: mất mạng — đã xếp hàng chờ gửi`);
    } else if (!result.ok) {
      setError(errorMessage(result.error));
    } else if (!result.data.matched.length) {
      addLog(`${label}: chưa trong bán kính điểm nào`);
    } else {
      const names = result.data.matched.map((m) => `${m.name} (${m.distanceM} m)`).join(", ");
      addLog(`${label}: ${names} — ghi ${result.data.recorded} mốc${result.data.duplicates ? `, bỏ ${result.data.duplicates} trùng` : ""}`);
    }
  }, []);

  async function moveTo(target) {
    setError("");
    const saved = await setPosition(target);
    setPositionState(saved);
    if (auto) report(await sendCheckin(saved), "Tự check-in");
  }

  async function manual(point) {
    setError("");
    const here = getPosition();
    report(await sendCheckin({ lat: here.lat, lng: here.lng, pointId: point._id }), `Check-in tay ${point.code}`);
  }

  async function retry() {
    const sent = await flushQueue();
    addLog(sent ? `Đã gửi lại ${sent} check-in` : "Vẫn chưa có mạng");
  }

  return (
    <Screen title="Vị trí & check-in" subtitle="Tự check-in khi đi qua điểm đã cài đặt" accent={accent} onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.label}>Vị trí hiện tại (giả lập)</Text>
        <Text style={styles.title} testID="chk-position">
          {formatPosition(position)} · {position.label}
        </Text>
        <Button
          testID="chk-auto"
          title={auto ? "Tự động check-in: BẬT" : "Tự động check-in: TẮT"}
          size="sm"
          variant={auto ? "primary" : "secondary"}
          onPress={() => setAuto(!auto)}
        />
      </View>
      <Banner testID="chk-error">{error}</Banner>
      {pending ? (
        <View style={styles.pending} testID="chk-pending">
          <Text style={styles.pendingText}>Đang chờ gửi: {pending} check-in (mất mạng)</Text>
          <Button testID="chk-flush" title="Gửi lại" size="sm" variant="secondary" onPress={retry} />
        </View>
      ) : null}
      {log.length ? (
        <View style={styles.card} testID="chk-log">
          {log.map((line, i) => (
            <Text key={`${i}-${line}`} style={i === 0 ? styles.text : styles.muted} testID={i === 0 ? "chk-last" : undefined}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.row}>
        <TextField testID="chk-lat" label="Vĩ độ" keyboardType="decimal-pad" value={lat} onChangeText={setLat} style={styles.grow} />
        <TextField testID="chk-lng" label="Kinh độ" keyboardType="decimal-pad" value={lng} onChangeText={setLng} style={styles.grow} />
        <Button
          testID="chk-set"
          title="Đặt"
          onPress={() => {
            const target = { lat: Number(lat.replace(",", ".")), lng: Number(lng.replace(",", ".")) };
            if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) return setError("Nhập vĩ độ, kinh độ dạng số");
            return moveTo(target);
          }}
        />
      </View>

      <Text role="heading" style={styles.section}>
        Điểm check-in ({points.length})
      </Text>
      {points.map((p) => (
        <View key={p._id} style={styles.card} testID={`chk-point-${p.code}`}>
          <Text style={styles.title}>{p.name}</Text>
          <Text style={styles.muted}>
            {p.code} · {p.lat}, {p.lng} · bán kính {p.radiusM} m{p.address ? ` · ${p.address}` : ""}
          </Text>
          <View style={styles.row}>
            <Button
              title="Tôi đang ở đây"
              size="sm"
              accessibilityLabel={`Đang ở ${p.code}`}
              onPress={() => moveTo({ lat: p.lat, lng: p.lng, label: p.name })}
              style={styles.grow}
            />
            <Button
              title="Check-in tay"
              size="sm"
              variant="secondary"
              accessibilityLabel={`Check-in tay ${p.code}`}
              onPress={() => manual(p)}
              style={styles.grow}
            />
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
  pending: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: 10 },
  pendingText: { flex: 1, color: "#78350F", fontWeight: "700" },
  label: { fontSize: 13, color: colors.muted },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  section: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  grow: { flex: 1 },
});
