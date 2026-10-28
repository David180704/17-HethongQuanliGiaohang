import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import TextField from "./TextField";
import ChipSelect from "./ChipSelect";
import CheckboxRow from "./CheckboxRow";
import Button from "./Button";
import Banner from "./Banner";
import { apiClient, errorMessage } from "../lib/apiClient";
import { colors } from "../theme";

const KEYBOARD = { email: "email-address", phone: "phone-pad", number: "decimal-pad" };

function emptyValue(field) {
  if (field.type === "multiselect") return [];
  if (field.type === "checkbox") return false;
  return "";
}

// O nhap so giu dang chuoi trong luc go ("0." chua phai so hop le) - chi doi
// sang Number khi bam Luu. Doi ngay tung phim go se khong go duoc "0.5".
function initialState(fields, initialValues) {
  const state = {};
  for (const field of fields) {
    const raw = initialValues?.[field.name];
    if (raw !== undefined && raw !== null) state[field.name] = field.type === "number" ? String(raw) : raw;
    else if (field.defaultValue !== undefined) state[field.name] = field.defaultValue;
    else state[field.name] = emptyValue(field);
  }
  return state;
}

const isVisible = (field, values) => !field.showIf || field.showIf(values);

// Chi gui field dang hien (field bi an boi showIf - vd shopName khi doi sang
// ca nhan - khong gui len). Chuoi rong = khong gui (mat khau rong = khong doi).
export function buildPayload(fields, values) {
  const payload = {};
  for (const field of fields) {
    if (!isVisible(field, values)) continue;
    const value = values[field.name];
    const label = field.label.toLowerCase();

    if (field.type === "checkbox") {
      payload[field.name] = Boolean(value);
      continue;
    }
    if (field.type === "multiselect") {
      payload[field.name] = Array.isArray(value) ? value : [];
      continue;
    }
    if (field.type === "number") {
      // Ban phim tieng Viet hay go dau phay thap phan: "0,5" -> 0.5
      const text = String(value ?? "").trim().replace(",", ".");
      if (text === "") {
        if (field.required) throw new Error(`Vui lòng nhập ${label}`);
        continue;
      }
      const number = Number(text);
      if (!Number.isFinite(number)) throw new Error(`${field.label} phải là số`);
      payload[field.name] = number;
      continue;
    }

    const text = typeof value === "string" && field.type !== "password" ? value.trim() : value;
    if (text === "" || text === null || text === undefined) {
      if (field.required) throw new Error(`Vui lòng ${field.type === "select" ? "chọn" : "nhập"} ${label}`);
      continue;
    }
    payload[field.name] = text;
  }
  return payload;
}

// fields: [{ name, label, type: text|email|phone|password|number|checkbox|select|multiselect,
//   required, options: [{ value, label }], optionsFrom: { endpoint, label(item) },
//   showIf(values), help, placeholder, defaultValue, autoCapitalize }]
export default function ResourceForm({ fields, initialValues, onSubmit, onCancel, submitLabel = "Lưu" }) {
  const [values, setValues] = useState(() => initialState(fields, initialValues));
  const [dynamicOptions, setDynamicOptions] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    for (const field of fields.filter((f) => f.optionsFrom)) {
      apiClient
        .get(field.optionsFrom.endpoint, { params: { limit: 100 } })
        .then((res) => {
          if (cancelled) return;
          const options = res.data.data.map((item) => ({ value: item._id, label: field.optionsFrom.label(item) }));
          setDynamicOptions((prev) => ({ ...prev, [field.name]: options }));
        })
        .catch((err) => {
          if (!cancelled) setError(errorMessage(err, "Không tải được danh sách lựa chọn"));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [fields]);

  const setField = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  async function submit() {
    setError("");
    let payload;
    try {
      payload = buildPayload(fields, values);
    } catch (validationError) {
      setError(validationError.message);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(payload);
      // Thanh cong -> man hinh cha dong form (component unmount), khong set state nua.
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  function renderField(field) {
    if (field.type === "checkbox") {
      return (
        <CheckboxRow
          key={field.name}
          testID={`field-${field.name}`}
          label={field.label}
          value={values[field.name]}
          onChange={(v) => setField(field.name, v)}
        />
      );
    }
    if (field.type === "select" || field.type === "multiselect") {
      return (
        <ChipSelect
          key={field.name}
          testID={`field-${field.name}`}
          label={field.label}
          required={field.required}
          help={field.help}
          options={field.optionsFrom ? dynamicOptions[field.name] || [] : field.options || []}
          multiple={field.type === "multiselect"}
          loading={Boolean(field.optionsFrom) && !dynamicOptions[field.name]}
          value={values[field.name]}
          onChange={(v) => setField(field.name, v)}
        />
      );
    }
    return (
      <TextField
        key={field.name}
        testID={`field-${field.name}`}
        label={field.label}
        required={field.required}
        help={field.help}
        placeholder={field.placeholder}
        value={values[field.name] ?? ""}
        onChangeText={(v) => setField(field.name, v)}
        secureTextEntry={field.type === "password"}
        keyboardType={KEYBOARD[field.type] || "default"}
        autoCapitalize={field.autoCapitalize || "none"}
        autoCorrect={false}
      />
    );
  }

  // Thanh duoi (loi + Huy/Luu) dung yen ngoai vung cuon: form dai tren dien thoai
  // van luon thay nut Luu va thong bao loi, khong phai cuon xuong tim.
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.fields} keyboardShouldPersistTaps="handled">
        {fields.filter((field) => isVisible(field, values)).map(renderField)}
      </ScrollView>
      <View style={styles.footer}>
        <Banner>{error}</Banner>
        <View style={styles.actions}>
          <Button title="Hủy" variant="secondary" onPress={onCancel} style={styles.action} />
          <Button title={submitLabel} onPress={submit} loading={saving} style={styles.action} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  fields: { padding: 20, gap: 16 },
  footer: { gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderColor: colors.border },
  actions: { flexDirection: "row", gap: 12 },
  action: { flex: 1 },
});
