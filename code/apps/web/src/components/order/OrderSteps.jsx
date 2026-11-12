import { useState } from "react";
import { inputClass } from "../../lib/ui.js";
import { distanceText, formatVnd } from "../../lib/format.js";
import { FEE_PAYERS, PACKING_TYPES, codSummary } from "../../lib/orderForm.js";
import { Field } from "../AuthShell.jsx";
import AddressFields from "../AddressFields.jsx";
import ParcelFields from "../ParcelFields.jsx";
import PickupLocationForm from "../PickupLocationForm.jsx";
import FeeBreakdown from "../FeeBreakdown.jsx";

const STEP_TITLES = ["Lấy hàng", "Người nhận", "Hàng hóa & thanh toán", "Xác nhận"];

export function StepIndicator({ step }) {
  return (
    <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Các bước tạo đơn">
      {STEP_TITLES.map((title, index) => {
        const number = index + 1;
        const state = number < step ? "done" : number === step ? "current" : "todo";
        return (
          <li key={title} aria-current={state === "current" ? "step" : undefined} className="flex flex-col items-center gap-1 text-center">
            <span
              className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
                state === "todo" ? "bg-gray-200 text-gray-500" : "bg-brand-600 text-white"
              }`}
            >
              {state === "done" ? "✓" : number}
            </span>
            <span className={`text-xs ${state === "current" ? "font-semibold text-gray-900" : "text-gray-500"}`}>{title}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Buoc 1: chon dia diem lay hang da luu (US-15) hoac them moi ngay tai day.
export function PickupStep({ form, update, locations, onLocationAdded, hint }) {
  const [adding, setAdding] = useState(false);
  const full = locations.length >= 10;
  const showForm = adding || locations.length === 0;
  return (
    <section aria-label="Bước 1: Lấy hàng" className="space-y-3">
      <h2 className="text-lg font-semibold">Shipper đến lấy hàng ở đâu?</h2>
      {hint && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{hint}</p>}
      <div role="radiogroup" aria-label="Địa điểm lấy hàng" className="space-y-2">
        {locations.map((location) => (
          <label
            key={location._id}
            className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${
              form.pickupLocationId === location._id ? "border-brand-600 bg-brand-50" : "border-gray-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="pickupLocationId"
              value={location._id}
              checked={form.pickupLocationId === location._id}
              onChange={() => update({ pickupLocationId: location._id })}
              aria-label={location.label}
            />
            <span className="text-sm">
              <span className="font-semibold">{location.label}</span>
              {location.isDefault && <span className="ml-2 text-xs font-semibold text-brand-700">Mặc định</span>}
              <span className="block text-gray-600">
                {location.contactName} · {location.contactPhone}
              </span>
              <span className="block text-gray-600">
                {location.address}, {location.ward}, {location.province}
              </span>
            </span>
          </label>
        ))}
      </div>
      {showForm ? (
        <div className="rounded-xl border border-brand-200 bg-white p-5">
          <h3 className="mb-3 font-semibold">Thêm địa điểm lấy hàng</h3>
          <PickupLocationForm
            onCancel={locations.length ? () => setAdding(false) : undefined}
            onSaved={(saved) => {
              setAdding(false);
              onLocationAdded(saved);
            }}
            submitLabel="Lưu và dùng địa điểm này"
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={full}
          onClick={() => setAdding(true)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          + Thêm địa điểm khác
        </button>
      )}
    </section>
  );
}

export function ReceiverStep({ form, update }) {
  const receiver = form.receiver;
  const set = (patch) => update({ receiver: { ...receiver, ...patch } });
  const input = (name, props = {}) => (
    <input id={`rc-${name}`} required value={receiver[name]} onChange={(e) => set({ [name]: e.target.value })} className={inputClass} {...props} />
  );
  return (
    <section aria-label="Bước 2: Người nhận" className="space-y-4">
      <h2 className="text-lg font-semibold">Giao cho ai?</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rc-name" label="Tên người nhận">
          {input("name", { autoComplete: "name" })}
        </Field>
        <Field id="rc-phone" label="Số điện thoại người nhận">
          {input("phone", { type: "tel", autoComplete: "tel" })}
        </Field>
      </div>
      <AddressFields idPrefix="rc" value={receiver} onChange={set} addressLabel="Địa chỉ nhận (số nhà, đường)" />
    </section>
  );
}

// Buoc 3: kien hang, goi dich vu, thu ho va ai tra phi (US-19)
export function ParcelStep({ form, update, serviceTypes, crossProvince = false }) {
  const { item, cod } = form;
  const setItem = (patch) => update({ item: { ...item, ...patch } });
  const setCod = (patch) => update({ cod: { ...cod, ...patch } });
  return (
    <section aria-label="Bước 3: Hàng hóa và thanh toán" className="space-y-5">
      <h2 className="text-lg font-semibold">Gửi gì, gói nào, ai trả phí?</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="it-name" label="Tên hàng hóa">
          <input id="it-name" required value={item.name} onChange={(e) => setItem({ name: e.target.value })} className={inputClass} />
        </Field>
        <Field id="it-packingType" label="Đóng gói">
          <select id="it-packingType" value={item.packingType} onChange={(e) => setItem({ packingType: e.target.value })} className={inputClass}>
            {PACKING_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ParcelFields idPrefix="it" value={item} onChange={setItem} />
      <Field id="it-note" label="Ghi chú cho shipper (không bắt buộc)">
        <input id="it-note" value={item.note} onChange={(e) => setItem({ note: e.target.value })} className={inputClass} />
      </Field>

      <fieldset>
        <legend className="mb-2 font-semibold">Gói dịch vụ</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {serviceTypes.map((type) => {
            // Giao nhanh chi trong cung tinh/thanh
            const blocked = crossProvince && type.code === "EXPRESS";
            return (
              <label
                key={type._id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${form.serviceTypeId === type._id ? "border-brand-600 bg-brand-50" : "border-gray-200 bg-white"}`}
              >
                <input
                  type="radio"
                  name="serviceTypeId"
                  disabled={blocked}
                  checked={form.serviceTypeId === type._id}
                  onChange={() => update({ serviceTypeId: type._id })}
                  aria-label={type.name}
                />
                <span className="text-sm">
                  <span className="font-semibold">{type.name}</span>
                  <span className="block text-gray-500">
                    {blocked ? "Chỉ giao trong cùng tỉnh/thành — đơn này gửi sang tỉnh khác" : `Dự kiến ${type.estimatedDays} ngày`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <legend className="px-1 font-semibold">Thu hộ và phí vận chuyển</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cod.enabled}
            onChange={(e) => setCod({ enabled: e.target.checked, ...(e.target.checked || cod.feePayer !== "DEDUCT_FROM_COD" ? {} : { feePayer: "RECIPIENT_PAID" }) })}
          />
          Thu hộ tiền hàng (COD)
        </label>
        {cod.enabled && (
          <Field id="cod-amount" label="Số tiền thu hộ (đ)" hint="Lớn hơn 0, tối đa 20.000.000 đ">
            <input id="cod-amount" type="number" min="1" max="20000000" required value={cod.amount} onChange={(e) => setCod({ amount: e.target.value })} className={inputClass} />
          </Field>
        )}
        <div role="radiogroup" aria-label="Ai trả phí vận chuyển" className="space-y-2">
          {FEE_PAYERS.map((payer) => {
            const disabled = payer.value === "DEDUCT_FROM_COD" && !cod.enabled;
            return (
              <label key={payer.value} className={`flex gap-2 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}>
                <input type="radio" name="feePayer" disabled={disabled} checked={cod.feePayer === payer.value} onChange={() => setCod({ feePayer: payer.value })} aria-label={payer.label} />
                <span>
                  <span className="font-medium">{payer.label}</span>
                  <span className="block text-xs text-gray-500">{disabled ? "Cần bật thu hộ" : payer.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        {cod.feePayer === "SHOP_PREPAID" && (
          <div role="radiogroup" aria-label="Cách trả trước" className="flex flex-wrap gap-4 pl-6 text-sm">
            {[
              ["QR", "Chuyển khoản QR"],
              ["CASH", "Tiền mặt khi lấy hàng"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="feePaymentMethod" checked={cod.feePaymentMethod === value} onChange={() => setCod({ feePaymentMethod: value })} aria-label={label} />
                {label}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </section>
  );
}

// Buoc 4: xem lai + phi du kien (US-17) truoc khi xac nhan tao don
export function ConfirmStep({ form, location, quote, quoteError, serviceTypes }) {
  const service = serviceTypes.find((type) => type._id === form.serviceTypeId);
  const option = quote?.options?.[0];
  const summary = option ? codSummary(form.cod, option.fee.total) : null;
  const { receiver, item, cod } = form;
  return (
    <section aria-label="Bước 4: Xác nhận" className="space-y-4">
      <h2 className="text-lg font-semibold">Kiểm tra và xác nhận đơn</h2>
      <dl className="grid gap-3 rounded-xl border border-gray-200 bg-white p-5 text-sm sm:grid-cols-2">
        <Info label="Lấy hàng tại" value={location ? `${location.label} — ${location.address}, ${location.ward}, ${location.province}` : "—"} />
        <Info label="Giao đến" value={`${receiver.name} · ${receiver.phone} — ${receiver.address}, ${receiver.ward}, ${receiver.province}`} />
        <Info label="Hàng hóa" value={`${item.name} · ${item.weightGram} g · ${item.length}×${item.width}×${item.height} cm`} />
        <Info label="Gói dịch vụ" value={service?.name || "—"} />
        <Info label="Thu hộ" value={cod.enabled ? formatVnd(Number(cod.amount) || 0) : "Không thu hộ"} />
        <Info label="Phí vận chuyển" value={FEE_PAYERS.find((p) => p.value === cod.feePayer)?.label} />
      </dl>
      {quoteError && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {quoteError}
        </div>
      )}
      {!quote && !quoteError && <p className="text-sm text-gray-500">Đang tính phí...</p>}
      {option && (
        <section className="rounded-xl border border-gray-200 bg-white p-5" aria-label="Phí dự kiến">
          <p className="mb-2 text-sm text-gray-600">
            Tuyến {quote.zoneLabel} · tính theo {quote.chargeableWeight.toLocaleString("vi-VN")} g
          </p>
          {quote.distanceKm !== null && quote.distanceKm !== undefined && (
            <p className="mb-2 text-sm text-gray-600" aria-label="Khoảng cách">
              Khoảng cách: <span className="font-semibold">{distanceText(quote)}</span>
            </p>
          )}
          <FeeBreakdown fee={option.fee} label="Chi tiết phí dự kiến" />
          {summary && (
            <dl className="mt-3 space-y-1 border-t border-gray-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Shipper thu của người nhận</dt>
                <dd className="font-semibold">{formatVnd(summary.collectFromReceiver)}</dd>
              </div>
              {cod.enabled && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Express trả lại bạn (tiền thu hộ)</dt>
                  <dd className="font-semibold">{formatVnd(summary.payToShop)}</dd>
                </div>
              )}
            </dl>
          )}
          {summary && summary.payToShop < 0 && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Tiền thu hộ nhỏ hơn phí vận chuyển — không khấu trừ được. Tăng tiền thu hộ hoặc chọn hình thức trả phí khác.
            </p>
          )}
          <p className="mt-3 text-xs text-gray-500">Phí được chốt khi bưu cục xác nhận đơn; bảng giá đổi về sau không ảnh hưởng đơn này.</p>
        </section>
      )}
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
