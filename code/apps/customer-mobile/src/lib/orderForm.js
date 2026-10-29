// Du lieu form tao don / uoc tinh phi <-> body API - cung luat voi Web Khach hang
// (apps/web/src/lib/orderForm.js), server van kiem day du khi tao don.

// "Hà Nội" -> "ha noi": so ten dia danh khi nguoi dung go khong dau
export function plainText(text = "") {
  return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
}

export const EMPTY_PARCEL = { weightGram: "", length: "", width: "", height: "", declaredValue: "", fragile: false, isVehicle: false };

export const FEE_PAYERS = [
  { value: "RECIPIENT_PAID", label: "Người nhận trả phí", hint: "Shipper thu phí ship cùng tiền thu hộ khi giao" },
  { value: "SHOP_PREPAID", label: "Người gửi trả trước", hint: "Chuyển khoản QR hoặc tiền mặt khi shipper đến lấy hàng" },
  { value: "DEDUCT_FROM_COD", label: "Khấu trừ vào tiền thu hộ", hint: "Express trừ phí ship khi trả tiền thu hộ cho bạn" },
];

export const PREPAID_METHODS = [
  { value: "QR", label: "Chuyển khoản QR" },
  { value: "CASH", label: "Tiền mặt khi lấy hàng" },
];

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

/** Ban nhap -> form; nhap tu man hinh Uoc tinh phi chi co tinh/quan hai dau, kien hang, dich vu. */
export function fromDraft(payload, locations = []) {
  if (!payload) return null;
  if (payload.source !== "estimate") {
    return {
      ...EMPTY_ORDER,
      ...payload,
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

// "1.000" hay "1,5" go tu ban phim so -> Number
const toNumber = (value) => Number(String(value ?? "").replace(/\./g, "").replace(",", "."));

export function toItemPayload(value) {
  return {
    weightGram: toNumber(value.weightGram),
    length: toNumber(value.length),
    width: toNumber(value.width),
    height: toNumber(value.height),
    declaredValue: value.declaredValue === "" ? 0 : toNumber(value.declaredValue),
  };
}

export function toFlagsPayload(value) {
  return { fragile: Boolean(value.fragile), isVehicle: Boolean(value.isVehicle) };
}

export function toOrderPayload(form, draftToken) {
  const { cod } = form;
  return {
    pickupLocationId: form.pickupLocationId,
    serviceTypeId: form.serviceTypeId,
    receiver: form.receiver,
    item: { ...toItemPayload(form.item), name: form.item.name, packingType: form.item.packingType, note: form.item.note },
    flags: toFlagsPayload(form.item),
    cod: {
      enabled: cod.enabled,
      amount: cod.enabled ? toNumber(cod.amount) : 0,
      feePayer: cod.feePayer,
      feePaymentMethod: cod.feePayer === "SHOP_PREPAID" ? cod.feePaymentMethod : null,
    },
    ...(draftToken ? { draftToken } : {}),
  };
}

export function codSummary(cod, feeTotal) {
  const amount = cod.enabled ? toNumber(cod.amount) || 0 : 0;
  return {
    collectFromReceiver: amount + (cod.feePayer === "RECIPIENT_PAID" ? feeTotal : 0),
    payToShop: amount - (cod.feePayer === "DEDUCT_FROM_COD" ? feeTotal : 0),
  };
}

const filled = (value) => String(value ?? "").trim() !== "";
const positive = (value) => toNumber(value) > 0;

/** Kiem tra nhanh tung buoc truoc khi sang buoc sau. areas: vung phuc vu cong khai. */
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
    if (cod.enabled && !(positive(cod.amount) && toNumber(cod.amount) <= 20000000)) {
      return "Tiền thu hộ phải lớn hơn 0 và tối đa 20.000.000 đ";
    }
    if (cod.feePayer === "DEDUCT_FROM_COD" && !cod.enabled) return "Khấu trừ phí vào tiền thu hộ thì phải bật thu hộ";
  }
  return "";
}
