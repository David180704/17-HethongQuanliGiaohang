import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Card from "./Card";
import Banner from "./Banner";
import Button from "./Button";
import TextField from "./TextField";
import { ChoiceGroup } from "./Choice";
import { apiClient, errorMessage } from "../lib/apiClient";
import { colors } from "../theme";

const EMPTY = { bankCode: "", accountNumber: "", accountName: "" };

// US-42: tai khoan ngan hang nhan tien thu ho (giong Web Khach hang).
export default function BankAccountCard() {
  const [banks, setBanks] = useState([]);
  const [account, setAccount] = useState(undefined);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get("/profile/banks").then((res) => setBanks(res.data.data)).catch(() => {});
    apiClient
      .get("/profile/bank-account")
      .then((res) => setAccount(res.data.data))
      .catch((err) => setError(errorMessage(err, "Không tải được tài khoản nhận thu hộ")));
  }, []);

  const set = (key) => (value) => setForm({ ...form, [key]: value });

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await apiClient.put("/profile/bank-account", form);
      setAccount(res.data.data);
      setForm(null);
      setNotice("Đã lưu tài khoản nhận tiền thu hộ");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Tài khoản nhận tiền thu hộ" testID="bank-card">
      <Text style={styles.muted} testID="bank-summary">
        {account === undefined
          ? "Đang tải..."
          : account
            ? `${account.bankName} · ${account.accountNumber} · ${account.accountName}`
            : "Chưa khai báo — tiền thu hộ sẽ chuyển vào tài khoản này khi đối soát."}
      </Text>
      <Banner testID="bank-error">{error}</Banner>
      <Banner tone="success" testID="bank-notice">
        {notice}
      </Banner>
      {form ? (
        <View style={styles.form}>
          <ChoiceGroup
            testID="bank-code"
            label="Ngân hàng"
            options={banks.map((bank) => ({ value: bank.code, label: bank.name }))}
            value={form.bankCode}
            onChange={set("bankCode")}
          />
          <TextField testID="bank-number" label="Số tài khoản" keyboardType="number-pad" value={form.accountNumber} onChangeText={set("accountNumber")} />
          <TextField
            testID="bank-name"
            label="Chủ tài khoản"
            help="Ghi đúng như trên thẻ, hệ thống tự bỏ dấu."
            value={form.accountName}
            onChangeText={set("accountName")}
          />
          <Button testID="bank-save" title="Lưu tài khoản" loading={saving} onPress={save} />
          <Button title="Hủy" variant="secondary" onPress={() => setForm(null)} />
        </View>
      ) : account !== undefined ? (
        <Button
          testID="bank-edit"
          title={account ? "Đổi tài khoản" : "Khai báo tài khoản"}
          variant="secondary"
          onPress={() => {
            setNotice("");
            setForm(account ? { bankCode: account.bankCode, accountNumber: account.accountNumber, accountName: account.accountName } : EMPTY);
          }}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  form: { gap: 10 },
});
