import { useEffect, useState } from "react";
import { apiClient, errorMessage } from "../lib/apiClient.js";
import { inputClass } from "../lib/ui.js";
import { Field } from "./AuthShell.jsx";

const EMPTY = { bankCode: "", accountNumber: "", accountName: "" };

// US-42: tai khoan ngan hang nhan tien thu ho (doi soat Sprint 7 chuyen tien vao day). Ten chu tai khoan server tu
// bo dau, in hoa nhu tren the.
export default function BankAccountSection() {
  const [banks, setBanks] = useState([]);
  const [account, setAccount] = useState(undefined); // undefined = dang tai, null = chua khai bao
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

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function save(event) {
    event.preventDefault();
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

  async function remove() {
    if (!window.confirm("Xóa tài khoản nhận tiền thu hộ?")) return;
    try {
      await apiClient.delete("/profile/bank-account");
      setAccount(null);
      setNotice("Đã xóa tài khoản nhận tiền thu hộ");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section aria-label="Tài khoản nhận tiền thu hộ" className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Tài khoản nhận tiền thu hộ</h2>
          <p className="mt-1 text-sm text-gray-500" data-testid="bank-summary">
            {account === undefined
              ? "Đang tải..."
              : account
                ? `${account.bankName} · ${account.accountNumber} · ${account.accountName}`
                : "Chưa khai báo — tiền thu hộ sẽ chuyển vào tài khoản này khi đối soát."}
          </p>
        </div>
        {!form && account !== undefined && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setNotice("");
                setForm(account ? { bankCode: account.bankCode, accountNumber: account.accountNumber, accountName: account.accountName } : EMPTY);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              {account ? "Đổi tài khoản" : "Khai báo"}
            </button>
            {account && (
              <button type="button" onClick={remove} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                Xóa
              </button>
            )}
          </div>
        )}
      </div>
      {notice && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {form && (
        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field id="bank-code" label="Ngân hàng">
            <select id="bank-code" className={inputClass} value={form.bankCode} onChange={set("bankCode")}>
              <option value="">— Chọn ngân hàng —</option>
              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="bank-number" label="Số tài khoản">
            <input id="bank-number" inputMode="numeric" className={inputClass} value={form.accountNumber} onChange={set("accountNumber")} />
          </Field>
          <Field id="bank-name" label="Chủ tài khoản" hint="Ghi đúng như trên thẻ, hệ thống tự bỏ dấu.">
            <input id="bank-name" className={inputClass} value={form.accountName} onChange={set("accountName")} />
          </Field>
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {saving ? "Đang lưu..." : "Lưu tài khoản"}
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold hover:bg-gray-50">
              Hủy
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
