import { ErrorCodes } from "../../core/errors.js";
import { normalizeVnPhone } from "../../core/phone.js";
import { parseFlags, parseItem } from "../pricing/pricing.validator.js";
import { parseCod } from "./cod.js";

const RECEIVER_LABELS = {
  name: "tên người nhận",
  address: "địa chỉ người nhận",
  province: "tỉnh/thành người nhận",
  district: "quận/huyện người nhận",
  ward: "phường/xã người nhận",
};

const isFilled = (value) => typeof value === "string" && value.trim() !== "";

function parseReceiver(receiver) {
  if (!receiver || typeof receiver !== "object") throw ErrorCodes.VALIDATION_ERROR("Thiếu thông tin người nhận");
  const missing = Object.keys(RECEIVER_LABELS).filter((field) => !isFilled(receiver[field]));
  if (missing.length) {
    throw ErrorCodes.VALIDATION_ERROR(`Thiếu ${missing.map((field) => RECEIVER_LABELS[field]).join(", ")}`);
  }
  const phone = normalizeVnPhone(receiver.phone);
  if (!phone) throw ErrorCodes.VALIDATION_ERROR("Số điện thoại người nhận phải gồm 10–11 chữ số, bắt đầu bằng 0");
  return { ...Object.fromEntries(Object.keys(RECEIVER_LABELS).map((field) => [field, receiver[field].trim()])), phone };
}

// Strategy kiem tra don tao moi (US-18). Ham thuan; khu vuc phuc vu, bang gia, chu so
// huu dia diem lay hang kiem o OrderService.
export const orderValidator = {
  create(body = {}) {
    if (!isFilled(body.pickupLocationId)) throw ErrorCodes.VALIDATION_ERROR("Chọn địa điểm lấy hàng");
    if (!isFilled(body.serviceTypeId)) throw ErrorCodes.VALIDATION_ERROR("Chọn loại dịch vụ");
    return {
      pickupLocationId: body.pickupLocationId,
      serviceTypeId: body.serviceTypeId,
      receiver: parseReceiver(body.receiver),
      item: parseItem(body.item, { requireName: true }),
      flags: parseFlags(body.flags),
      cod: parseCod(body.cod),
      draftToken: isFilled(body.draftToken) ? body.draftToken : null,
    };
  },
};
