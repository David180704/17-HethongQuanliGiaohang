import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Banner from "../../components/Banner";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import { apiClient, errorMessage } from "../../lib/apiClient";
import {
  distanceM,
  formatPosition,
  getGpsState,
  getPosition,
  loadPosition,
  onGpsStateChange,
  onPositionChange,
  setMode,
  setPosition,
  startGps,
  toPayload,
} from "../../lib/location";
import { flushQueue, onPendingChange, sendCheckin } from "../../lib/checkinQueue";
import { formatTime } from "../../lib/queryCache";
import { colors, radius } from "../../theme";

const FLUSH_INTERVAL_MS = 15_000;
// Che do GPS: chi tu gui khi da vao ban kinh diem dang ky; gui lai sau it nhat 60 giay (server chan trung 30 phut)
const GPS_RESEND_MS = 60_000;
const GPS_MAX_ACCURACY_M = 200;

const distanceText = (m) => (m >= 1000 ? `${(m / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`);

// Tu 12/11/2026: moi tai xe chi co MOT diem check-in hop le (admin gan) - server tu choi check-in o noi khac.
// US-30 (22/11/2026 dung GPS that): app theo doi vi tri cua dien thoai khi dang mo; vao ban kinh diem dang ky thi
// tu gui check-in, server ghi moc cho cac don dang cam. Che do gia lap (chon "dang o" mot diem / nhap toa do) giu
// lai cho kiem thu va khi may khong co GPS. Mat mang -> xep hang doi, tu gui lai moi 15 giay. Check-in tay du phong.
export default function CheckinScreen({ accent, onBack }) {
  const [points, setPoints] = useState([]);
  const [position, setPositionState] = useState(getPosition());
  const [gpsState, setGpsStateView] = useState(getGpsState());
  const [auto, setAuto] = useState(true);
  const [pending, setPending] = useState(0);
  const [log, setLog] = useState([]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState("");
  const lastGpsSent = useRef(0);

  useEffect(() => {
    loadPosition().then(setPositionState);
    apiClient
      .get("/checkins/points")
      .then((res) => setPoints(res.data.data))
      .catch((err) => setError(errorMessage(err, "Không tải được điểm check-in")));
    const offPending = onPendingChange(setPending);
    const offPosition = onPositionChange(setPositionState);
    const offState = onGpsStateChange(setGpsStateView);
    flushQueue();
    const timer = setInterval(() => flushQueue(), FLUSH_INTERVAL_MS);
    return () => {
      offPending();
      offPosition();
      offState();
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

  // GPS that: moi lan dien thoai bao vi tri moi, vao ban kinh diem dang ky (va sai so du nho) thi tu check-in
  const point = points[0];
  const gpsInRange =
    position.source === "GPS" && point && distanceM(position, point) <= (point.radiusM ?? 150) && (position.accuracyM ?? 0) <= GPS_MAX_ACCURACY_M;
  useEffect(() => {
    if (!auto || !gpsInRange || Date.now() - lastGpsSent.current < GPS_RESEND_MS) return;
    lastGpsSent.current = Date.now();
    setError("");
    sendCheckin(toPayload(position)).then((result) => report(result, "Tự check-in (GPS)"));
  }, [auto, gpsInRange, position, report]);

  async function moveTo(target) {
    setError("");
    const saved = await setPosition(target);
    setPositionState(saved);
    if (auto) report(await sendCheckin(toPayload(saved)), "Tự check-in");
  }

  async function manual(target) {
    setError("");
    report(await sendCheckin({ ...toPayload(getPosition()), pointId: target._id }), `Check-in tay ${target.code}`);
  }

  async function retry() {
    const sent = await flushQueue();
    addLog(sent ? `Đã gửi lại ${sent} check-in` : "Vẫn chưa có mạng");
  }

  const usingGps = position.source === "GPS";
  const gpsMode = gpsState.mode === "GPS";

  return (
    <Screen title="Vị trí & check-in" subtitle="Tự check-in khi đi qua điểm đã đăng ký" accent={accent} onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.label} testID="chk-source">
          {usingGps ? "Vị trí hiện tại (GPS của máy)" : "Vị trí hiện tại (giả lập)"}
        </Text>
        <Text style={styles.title} testID="chk-position">
          {formatPosition(position)} · {position.label}
        </Text>
        {point ? (
          <Text style={styles.muted} testID="chk-distance">
            Cách {point.name}: {distanceText(distanceM(position, point))} (bán kính {point.radiusM ?? 150} m)
          </Text>
        ) : null}
        {gpsMode && gpsState.state !== "ok" && gpsState.message ? (
          <Text style={styles.note} testID="chk-gps-state">
            {gpsState.message}
          </Text>
        ) : null}
        {usingGps && (position.accuracyM ?? 0) > GPS_MAX_ACCURACY_M ? (
          <Text style={styles.note}>Tín hiệu GPS yếu (±{position.accuracyM} m) — ra chỗ thoáng để tự check-in, hoặc check-in tay.</Text>
        ) : null}
        <View style={styles.row}>
          <Button
            testID="chk-use-gps"
            title="Dùng GPS của máy"
            size="sm"
            variant={gpsMode ? "primary" : "secondary"}
            onPress={() => (gpsMode ? startGps() : setMode("GPS"))}
            style={styles.grow}
          />
          <Button
            testID="chk-use-sim"
            title="Vị trí giả lập"
            size="sm"
            variant={gpsMode ? "secondary" : "primary"}
            onPress={() => setMode("SIMULATED")}
            style={styles.grow}
          />
        </View>
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

      <Text style={styles.muted}>Vị trí giả lập (kiểm thử, máy không có GPS): nhập tọa độ hoặc bấm "Tôi đang ở đây".</Text>
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
        Điểm check-in đăng ký
      </Text>
      {points.length === 0 ? (
        <Text style={styles.muted} testID="chk-no-point">
          Bạn chưa được đăng ký điểm check-in — liên hệ quản trị viên.
        </Text>
      ) : (
        <Text style={styles.muted}>Chỉ check-in tại điểm này mới được nhận.</Text>
      )}
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
  note: { fontSize: 13, color: "#92400E" },
  section: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  grow: { flex: 1 },
});
