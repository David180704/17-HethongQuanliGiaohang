import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, errorMessage } from "../lib/apiClient.js";
import { formatVnd } from "../lib/format.js";
import { EMPTY_PARCEL, toFlagsPayload, toItemPayload } from "../lib/orderForm.js";
import AreaFields from "../components/AreaFields.jsx";
import ParcelFields from "../components/ParcelFields.jsx";
import FeeBreakdown from "../components/FeeBreakdown.jsx";

const EMPTY_AREA = { province: "", district: "" };

// Uoc tinh phi cong khai (US-16): khach vang lai nhap noi gui, noi nhan, kien hang ->
// phi tung goi dich vu. Bam "Gui hang" -> luu nhap (draftToken) -> dang nhap/dang ky
// -> man hinh tao don con nguyen du lieu da nhap.
export default function EstimatePage() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState(EMPTY_AREA);
  const [receiver, setReceiver] = useState(EMPTY_AREA);
  const [parcel, setParcel] = useState(EMPTY_PARCEL);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const request = () => ({ pickup, receiver, item: toItemPayload(parcel), flags: toFlagsPayload(parcel) });
  const edit = (setter) => (patch) => {
    setter((prev) => ({ ...prev, ...patch }));
    setResult(null); // so lieu doi -> phi cu khong con dung
  };

  async function estimate(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      setResult((await apiClient.post("/orders/estimate-fee", request())).data.data);
    } catch (err) {
      setError(errorMessage(err, "Không ước tính được phí"));
    } finally {
      setBusy(false);
    }
  }

  async function ship(option) {
    setError("");
    setBusy(true);
    try {
      const payload = { source: "estimate", ...request(), serviceTypeId: option.serviceTypeId };
      const { draftToken } = (await apiClient.post("/orderDrafts", { payload })).data.data;
      navigate(`/tao-don?draft=${encodeURIComponent(draftToken)}`);
    } catch (err) {
      setError(errorMessage(err, "Không lưu được thông tin, vui lòng thử lại"));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Ước tính phí vận chuyển</h1>
      <p className="mt-1 text-gray-600">
        Không cần đăng nhập. Bấm “Gửi hàng” để tạo đơn — thông tin đã nhập được giữ lại 24 giờ, kể cả khi bạn cần đăng
        ký tài khoản.
      </p>

      <form onSubmit={estimate} className="mt-6 space-y-6 rounded-xl border border-gray-200 bg-white p-5" aria-label="Ước tính phí">
        <div className="grid gap-6 md:grid-cols-2">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-semibold">Gửi từ</legend>
            <AreaFields idPrefix="from" value={pickup} onChange={edit(setPickup)} />
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-semibold">Gửi đến</legend>
            <AreaFields idPrefix="to" value={receiver} onChange={edit(setReceiver)} />
          </fieldset>
        </div>
        <ParcelFields idPrefix="est" value={parcel} onChange={edit(setParcel)} />
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {busy && !result ? "Đang tính..." : "Tính phí"}
        </button>
      </form>

      {result && (
        <section className="mt-6" aria-label="Kết quả ước tính">
          <p className="text-sm text-gray-600" role="status">
            {result.pickupArea.district}, {result.pickupArea.province} → {result.receiverArea.district},{" "}
            {result.receiverArea.province} · tuyến {result.zoneLabel} · tính theo {result.chargeableWeight.toLocaleString("vi-VN")} g
            {result.volumetricWeight > Number(parcel.weightGram) ? " (khối lượng quy đổi theo kích thước)" : ""}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {result.options.map((option) => (
              <article key={option.code} className="rounded-xl border border-gray-200 bg-white p-5" aria-label={option.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">{option.name}</h2>
                  <span className="text-xl font-bold text-brand-600">{formatVnd(option.fee.total)}</span>
                </div>
                <p className="text-sm text-gray-500">Dự kiến giao trong {option.estimatedDays} ngày</p>
                <div className="mt-3">
                  <FeeBreakdown fee={option.fee} label={`Chi tiết phí ${option.name}`} />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ship(option)}
                  className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  Gửi hàng gói {option.name}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
