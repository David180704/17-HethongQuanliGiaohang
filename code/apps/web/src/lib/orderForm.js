// Du lieu form tao don / uoc tinh phi <-> body API. Tach khoi file component de Fast
// Refresh cua Vite hoat dong (file component chi export component).
import { plainText } from "./format.js";

export const EMPTY_PARCEL = { weightGram: "", length: "", width: "", height: "", declaredValue: "", fragile: false, isVehicle: false };

export const FEE_PAYERS = [
  { value: "RECIPIENT_PAID", label: "Người nhận trả phí", hint: "Shipper thu phí ship cùng tiền thu hộ khi giao" },
  { value: "SHOP_PREPAID", label: "Người gửi trả trước", hint: "Chuyển khoản QR hoặc trả tiền mặt khi shipper đến lấy hàng" },
  { value: "DEDUCT_FROM_COD", label: "Khấu trừ vào tiền thu hộ", hint: "Express trừ phí ship khi trả tiền thu hộ cho bạn" },
];

export const PACKING_TYPES = [
  { value: "BOX", label: "Hộp" },
  { value: "BAG", label: "Túi" },
  { value: "ENVELOPE", label: "Phong bì" },
  { value: "PALLET", label: "Pallet" },
  { value: "OTHER", label: "Khác" },
];

/** Trang thai form tao don 4 buoc - cung la noi dung ban nhap (orderDrafts.payload). */
export const EMPTY_ORDER = {
  source: "wizard",
  step: 1,
  pickupLocationId: "",
  receiver: { name: "", phone: "", address: "", province: "", district: "", ward: "" },
  item: { name: "", packingType: "BOX", note: "", ...EMPTY_PARCEL },
  serviceTypeId: "",
  cod: { enabled: false, amount: "", feePayer: "RECIPIENT_PAID", feePaymentMethod: "QR" },
};

const text = (value) => (value === undefined || value === null ? "" : String(value));

/**
 * Ban nhap -> form. Nhap tu trang uoc tinh phi (source "estimate") chi co tinh/quan hai dau,
 * kich thuoc, dich vu: dien vao dung o va chon dia diem lay hang cung quan/huyen (neu co).
 */
export function fromDraft(payload, locations = []) {
  if (!payload) return null;
  if (payload.source !== "estimate") {
    return {
      ...EMPTY_ORDER,
      ...payload,
      // Phi o buoc 4 phai tinh lai theo bang gia luc nay -> mo lai toi da buoc 3
      step: Math.min(Number(payload.step) || 1, 3),
      receiver: { ...EMPTY_ORDER.receiver, ...payload.receiver },
      item: { ...EMPTY_ORDER.item, ...payload.item },
      cod: { ...EMPTY_ORDER.cod, ...payload.cod },
    };
  }
  const sameArea = locations.find(
    (location) =>
      plainText(location.province) === plainText(payload.pickup?.province) &&
      plainText(location.district) === plainText(payload.pickup?.district),
  );
  const item = payload.item || {};
  return {
    ...EMPTY_ORDER,
    pickupLocationId: sameArea?._id || "",
    receiver: { ...EMPTY_ORDER.receiver, province: text(payload.receiver?.province), district: text(payload.receiver?.district) },
    item: {
      ...EMPTY_ORDER.item,
      weightGram: text(item.weightGram),
      length: text(item.length),
      width: text(item.width),
      height: text(item.height),
      declaredValue: item.declaredValue ? text(item.declaredValue) : "",
      fragile: Boolean(payload.flags?.fragile),
      isVehicle: Boolean(payload.flags?.isVehicle),
    },
    serviceTypeId: text(payload.serviceTypeId),
    estimatedPickup: payload.pickup,
  };
}

/** Du lieu form -> body API (chuoi so -> Number; o bo trong -> 0 voi gia tri khai bao). */
export function toItemPayload(value) {
  return {
    weightGram: Number(value.weightGram),
    length: Number(value.length),
    width: Number(value.width),
    height: Number(value.height),
    declaredValue: value.declaredValue === "" ? 0 : Number(value.declaredValue),
  };
}

export function toFlagsPayload(value) {
  return { fragile: Boolean(value.fragile), isVehicle: Boolean(value.isVehicle) };
}

export function toCodPayload(cod) {
  return {
    enabled: cod.enabled,
    amount: cod.enabled ? Number(cod.amount) : 0,
    feePayer: cod.feePayer,
    feePaymentMethod: cod.feePayer === "SHOP_PREPAID" ? cod.feePaymentMethod : null,
  };
}

export function toOrderPayload(form, draftToken) {
  return {
    pickupLocationId: form.pickupLocationId,
    serviceTypeId: form.serviceTypeId,
    receiver: form.receiver,
    item: { ...toItemPayload(form.item), name: form.item.name, packingType: form.item.packingType, note: form.item.note },
    flags: toFlagsPayload(form.item),
    cod: toCodPayload(form.cod),
    ...(draftToken ? { draftToken } : {}),
  };
}

/** Shipper thu cua nguoi nhan / Express tra lai shop (giong ham codSummary phia server). */
export function codSummary(cod, feeTotal) {
  const amount = cod.enabled ? Number(cod.amount) || 0 : 0;
  return {
    collectFromReceiver: amount + (cod.feePayer === "RECIPIENT_PAID" ? feeTotal : 0),
    payToShop: amount - (cod.feePayer === "DEDUCT_FROM_COD" ? feeTotal : 0),
  };
}

const filled = (value) => String(value ?? "").trim() !== "";
const positive = (value) => Number(value) > 0;

/**
 * Kiem tra nhanh tung buoc truoc khi sang buoc sau (server van kiem day du khi tao don).
 * areas: vung phuc vu (/public/service-areas) de bao som quan/huyen nguoi nhan ngoai vung.
 */
export function stepError(step, form, areas = []) {
  if (step === 1 && !form.pickupLocationId) return "Chọn địa điểm lấy hàng (hoặc thêm địa điểm mới)";
  if (step === 2) {
    const { receiver } = form;
    if (!["name", "phone", "address", "province", "district", "ward"].every((key) => filled(receiver[key]))) {
      return "Nhập đủ tên, số điện thoại và địa chỉ người nhận";
    }
    if (!/^0\d{9,10}$/.test(receiver.phone.replace(/[\s.-]/g, ""))) return "Số điện thoại người nhận phải gồm 10–11 chữ số, bắt đầu bằng 0";
    const served = areas.some(
      (area) => plainText(area.province) === plainText(receiver.province) && plainText(area.district) === plainText(receiver.district),
    );
    if (areas.length && !served) return `${receiver.district}, ${receiver.province} chưa thuộc vùng phục vụ`;
  }
  if (step === 3) {
    const { item, cod } = form;
    if (!filled(item.name)) return "Nhập tên hàng hóa";
    if (!["weightGram", "length", "width", "height"].every((key) => positive(item[key]))) {
      return "Khối lượng và kích thước phải lớn hơn 0";
    }
    if (!form.serviceTypeId) return "Chọn gói dịch vụ";
    if (cod.enabled && !(positive(cod.amount) && Number(cod.amount) <= 20000000)) {
      return "Tiền thu hộ phải lớn hơn 0 và tối đa 20.000.000 đ";
    }
    if (cod.feePayer === "DEDUCT_FROM_COD" && !cod.enabled) return "Khấu trừ phí vào tiền thu hộ thì phải bật thu hộ";
  }
  return "";
}
