import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient, errorMessage } from "../lib/apiClient.js";
import { queryCache } from "../lib/queryCache.js";
import { useCachedQuery } from "../lib/useCachedQuery.js";
import { useOrderDraft } from "../lib/useOrderDraft.js";
import { formatVnd } from "../lib/format.js";
import { EMPTY_ORDER, fromDraft, stepError, toFlagsPayload, toItemPayload, toOrderPayload } from "../lib/orderForm.js";
import { ConfirmStep, ParcelStep, PickupStep, ReceiverStep, StepIndicator } from "../components/order/OrderSteps.jsx";

// Tao don 4 buoc (US-18), thu ho va ai tra phi (US-19), xem phi du kien truoc khi xac
// nhan (US-17). Moi lan bam "Tiep tuc" luu nhap (orderDrafts, 24 gio): tai lai trang hay
// di dang ky giua chung van giu du lieu; nhap tu trang Uoc tinh phi thi dien san (US-16).
export default function CreateOrderPage() {
  const [params, setParams] = useSearchParams();
  const [openedDraft] = useState(() => params.get("draft")); // nhap mo luc vao trang
  const [draftToken, setDraftToken] = useState(openedDraft);
  const { draft, error: draftError } = useOrderDraft(openedDraft);
  const { data: locationData, refresh: refreshLocations } = useCachedQuery("/pickupLocations");
  const { data: serviceTypes } = useCachedQuery("/public/service-types");
  const { data: areas } = useCachedQuery("/public/service-areas");
  const locations = locationData || [];

  const [form, setForm] = useState(EMPTY_ORDER);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // Dien form MOT lan khi da tai xong nhap, dia diem lay hang va goi dich vu (du lieu tu API)
  useEffect(() => {
    if (hydrated || !locationData || !serviceTypes) return;
    if (openedDraft && !draft && !draftError) return; // nhap dang tai
    const restored = fromDraft(draft?.payload, locationData);
    const defaultLocation = locationData.find((location) => location.isDefault)?._id || "";
    // oxlint-disable-next-line react/set-state-in-effect
    setForm({
      ...EMPTY_ORDER,
      ...restored,
      pickupLocationId: restored?.pickupLocationId || defaultLocation,
      serviceTypeId: restored?.serviceTypeId || serviceTypes[0]?._id || "",
    });
    setHydrated(true);
  }, [hydrated, locationData, serviceTypes, draft, draftError, openedDraft]);

  const location = locations.find((l) => l._id === form.pickupLocationId);
  const hint =
    form.estimatedPickup && !form.pickupLocationId
      ? `Bạn ước tính phí gửi từ ${form.estimatedPickup.district}, ${form.estimatedPickup.province} — chọn hoặc thêm địa điểm lấy hàng ở đó.`
      : "";

  async function saveDraft(next) {
    try {
      if (draftToken) {
        await apiClient.put(`/orderDrafts/${encodeURIComponent(draftToken)}`, { payload: next });
      } else {
        const token = (await apiClient.post("/orderDrafts", { payload: next })).data.data.draftToken;
        setDraftToken(token);
        setParams({ draft: token }, { replace: true });
      }
    } catch {
      // Luu nhap loi khong chan viec tao don
    }
  }

  async function loadQuote(current) {
    setQuote(null);
    setQuoteError("");
    try {
      const res = await apiClient.post("/orders/estimate-fee", {
        pickup: { province: location.province, district: location.district },
        receiver: current.receiver,
        item: toItemPayload(current.item),
        flags: toFlagsPayload(current.item),
        serviceTypeId: current.serviceTypeId,
      });
      setQuote(res.data.data);
    } catch (err) {
      setQuoteError(errorMessage(err, "Không tính được phí"));
    }
  }

  async function next() {
    const problem = stepError(form.step, form, areas || []);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    const advanced = { ...form, step: form.step + 1 };
    setForm(advanced);
    saveDraft(advanced);
    if (advanced.step === 4) loadQuote(advanced);
  }

  const back = () => {
    setError("");
    update({ step: form.step - 1 });
  };

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await apiClient.post("/orders", toOrderPayload(form, draftToken));
      queryCache.invalidate("/orders");
      setCreated(res.data.data);
      setParams({}, { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Không tạo được đơn"));
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setCreated(null);
    setDraftToken(null);
    setQuote(null);
    const defaultLocation = locations.find((l) => l.isDefault)?._id || "";
    setForm({ ...EMPTY_ORDER, pickupLocationId: defaultLocation, serviceTypeId: serviceTypes?.[0]?._id || "" });
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div role="status" className="rounded-2xl border border-green-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-gray-500">Đã tạo đơn hàng</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-wide text-brand-600">{created.trackingCode}</h1>
          <p className="mt-2 text-gray-700">Trạng thái: chờ bưu cục xác nhận</p>
          <p className="mt-1 text-gray-700">
            Phí vận chuyển: <span className="font-semibold">{formatVnd(created.fee.total)}</span>
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={startOver} className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">
              Tạo đơn khác
            </button>
            <Link to="/tai-khoan" className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold hover:bg-gray-50">
              Về tài khoản
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const blockedByCod = quote?.options?.[0] && form.cod.feePayer === "DEDUCT_FROM_COD" && Number(form.cod.amount) < quote.options[0].fee.total;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Tạo đơn hàng</h1>
      {draftToken && <p className="mt-1 text-xs text-gray-500">Thông tin đang nhập được lưu tạm 24 giờ.</p>}
      <StepIndicator step={form.step} />

      {draftError && (
        <div role="alert" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {errorMessage(draftError, "Không mở được thông tin đã nhập")} — bạn nhập lại từ đầu nhé.
        </div>
      )}

      <div className="mt-6">
        {!hydrated ? (
          <p className="text-gray-500">Đang tải...</p>
        ) : (
          <>
            {form.step === 1 && (
              <PickupStep
                form={form}
                update={update}
                locations={locations}
                hint={hint}
                onLocationAdded={(saved) => {
                  update({ pickupLocationId: saved._id });
                  refreshLocations();
                }}
              />
            )}
            {form.step === 2 && <ReceiverStep form={form} update={update} />}
            {form.step === 3 && <ParcelStep form={form} update={update} serviceTypes={serviceTypes || []} />}
            {form.step === 4 && (
              <ConfirmStep form={form} location={location} quote={quote} quoteError={quoteError} serviceTypes={serviceTypes || []} />
            )}
          </>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-between gap-3">
        <button
          type="button"
          onClick={back}
          disabled={form.step === 1 || submitting}
          className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold hover:bg-gray-50 disabled:invisible"
        >
          Quay lại
        </button>
        {form.step < 4 ? (
          <button type="button" onClick={next} disabled={!hydrated} className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            Tiếp tục
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !quote || blockedByCod}
            className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Đang tạo đơn..." : "Xác nhận tạo đơn"}
          </button>
        )}
      </div>
    </div>
  );
}
