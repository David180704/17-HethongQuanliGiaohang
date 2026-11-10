import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Banner from "../components/Banner";
import Button from "../components/Button";
import TextField from "../components/TextField";
import { apiClient, errorMessage } from "../lib/apiClient";
import { GROUP_FILTERS, formatDateTime } from "../lib/orderView";
import { colors, radius } from "../theme";

const STAGES = GROUP_FILTERS.filter((g) => g.code);

// US-22: tra cuu cong khai bang ma van don (khong can dang nhap). Khong tu lam moi: API gioi han 20 lan/phut.
export default function TrackingScreen({ initialCode = "", onBack }) {
  const [input, setInput] = useState(initialCode);
  const [code, setCode] = useState(initialCode.trim().toUpperCase());
  const [state, setState] = useState({ loading: false, data: null, error: "" });

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    setState({ loading: true, data: null, error: "" });
    apiClient
      .get(`/tracking/${encodeURIComponent(code)}`)
      .then((res) => !cancelled && setState({ loading: false, data: res.data.data, error: "" }))
      .catch((err) => !cancelled && setState({ loading: false, data: null, error: errorMessage(err, "Không tra cứu được đơn") }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const { data, loading, error } = state;
  const stageIndex = data ? STAGES.findIndex((s) => s.code === data.group) : -1;
  const submit = () => setCode(input.trim().toUpperCase());

  return (
    <Screen title="Tra cứu đơn hàng" subtitle="Không cần đăng nhập" onBack={onBack}>
      <View style={styles.searchRow}>
        <TextField
          testID="track-code"
          label="Mã vận đơn"
          placeholder="EXP1000000001"
          autoCapitalize="characters"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submit}
          style={styles.searchField}
        />
        <Button testID="track-submit" title="Tra cứu" size="sm" onPress={submit} />
      </View>

      {loading ? <Text style={styles.muted}>Đang tra cứu...</Text> : null}
      <Banner testID="track-error">{error}</Banner>

      {data ? (
        <>
          <Card testID="track-result">
            <Text style={styles.code}>{data.trackingCode}</Text>
            <Text style={styles.group} testID="track-group">
              {data.groupLabel}
            </Text>
            <Text style={styles.muted}>{data.statusLabel}</Text>
            <View style={styles.stages}>
              {STAGES.map((stage, index) => (
                <Text
                  key={stage.code}
                  style={[styles.stage, index < stageIndex && styles.stagePast, index === stageIndex && styles.stageNow]}
                >
                  {stage.label}
                </Text>
              ))}
            </View>
            <Text style={styles.small}>Người gửi: {data.sender.name}</Text>
            <Text style={styles.small}>
              Giao đến: {data.receiver.district}, {data.receiver.province} · {data.receiver.phone}
            </Text>
          </Card>
          <Card title="Hành trình" testID="track-journey">
            {[...data.events].reverse().map((event, index) => (
              <View key={`${event.status}-${event.at}`} style={styles.step} testID={`track-event-${index}`}>
                <View style={[styles.dot, index === 0 && styles.dotNow]} />
                <View style={styles.stepText}>
                  <Text style={[styles.stepLabel, index === 0 && styles.stepLabelNow]}>{event.label}</Text>
                  <Text style={styles.small}>{formatDateTime(event.at)}</Text>
                </View>
              </View>
            ))}
          </Card>
          {data.checkins?.length ? (
            <Card title="Đã đi qua" testID="track-checkins">
              {data.checkins.map((checkin, index) => (
                <Text key={`${checkin.point}-${checkin.at}`} style={styles.muted} testID={`track-checkin-${index}`}>
                  {checkin.point} · {formatDateTime(checkin.at)}
                </Text>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, color: colors.muted },
  small: { fontSize: 12, color: colors.muted },
  searchRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  searchField: { flex: 1 },
  code: { fontSize: 20, fontWeight: "800", color: colors.primary, letterSpacing: 0.3 },
  group: { fontSize: 17, fontWeight: "800", color: colors.text },
  stages: { flexDirection: "row", gap: 6 },
  stage: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 6,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.bg,
    color: colors.faint,
  },
  stagePast: { backgroundColor: colors.primarySoft, color: colors.primary },
  stageNow: { backgroundColor: colors.primary, color: "#FFFFFF" },
  step: { flexDirection: "row", gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border, marginTop: 4 },
  dotNow: { backgroundColor: colors.primary },
  stepText: { flex: 1, gap: 1 },
  stepLabel: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  stepLabelNow: { color: colors.text, fontWeight: "800" },
});
