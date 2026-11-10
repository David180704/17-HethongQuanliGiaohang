import { ErrorCodes } from "../../core/errors.js";
import { normalizeVnPhone } from "../../core/phone.js";
import { parseArea, parseFlags, parseItem } from "../pricing/pricing.validator.js";
import { parseCod } from "./cod.js";
import { CUSTOMER_GROUPS } from "./orderStatus.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VN_OFFSET_MS = 7 * 3600 * 1000;

// Ngay "YYYY-MM-DD" theo gio Viet Nam: tu ngay = 00:00, den ngay = 23:59:59.999 cua ngay do.
function parseDay(value, label, endOfDay) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DAY.test(value)) {
    throw ErrorCodes.VALIDATION_ERROR(`${label} phải có dạng YYYY-MM-DD`);
  }
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  // 2026-02-30 van tao duoc Date (tran sang thang sau) -> doi chieu lai chuoi ngay
  if (Number.isNaN(date.getTime()) || new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10) !== value) {
    throw ErrorCodes.VALIDATION_ERROR(`${label} không tồn tại`);
  }
  return date;
}

const RECEIVER_LABELS = {
  name: "tên người nhận",
  address: "địa chỉ người nhận",
  province: "tỉnh/thành người nhận",
  district: "quận/huyện người nhận",
  ward: "phường/xã người nhận",
};

const isFilled = (value) => typeof value === "string" && value.trim() !== "";

// Ma don cua shop tren website ban hang (de 14 muc a): tuy chon, toi da 50 ky tu
function parseShopOrderCode(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > 50) {
    throw ErrorCodes.VALIDATION_ERROR("Mã đơn của shop tối đa 50 ký tự");
  }
  return value.trim() || null;
}

// Khach tai quay: so dien thoai bat buoc; ho ten chi can khi phai tao khach le moi
function parseCounterCustomer(customer) {
  if (!customer || typeof customer !== "object") throw ErrorCodes.VALIDATION_ERROR("Thiếu thông tin khách gửi");
  const phone = normalizeVnPhone(customer.phone);
  if (!phone) throw ErrorCodes.VALIDATION_ERROR("Số điện thoại khách gửi phải gồm 10–11 chữ số, bắt đầu bằng 0");
  return { phone, fullName: isFilled(customer.fullName) ? customer.fullName.trim() : null };
}

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
      shopOrderCode: parseShopOrderCode(body.shopOrderCode),
      draftToken: isFilled(body.draftToken) ? body.draftToken : null,
    };
  },

  /** Don tiep nhan tai quay (US-40): khong co dia diem lay hang; noi gui la diem cua nhan vien. */
  counter(body = {}) {
    if (!isFilled(body.serviceTypeId)) throw ErrorCodes.VALIDATION_ERROR("Chọn loại dịch vụ");
    return {
      customer: parseCounterCustomer(body.customer),
      serviceTypeId: body.serviceTypeId,
      receiver: parseReceiver(body.receiver),
      item: parseItem(body.item, { requireName: true }),
      flags: parseFlags(body.flags),
      cod: parseCod(body.cod),
      shopOrderCode: parseShopOrderCode(body.shopOrderCode),
    };
  },

  /** Bao gia tai quay: chi can noi nhan (tinh, quan) va kien hang. */
  counterQuote(body = {}) {
    return {
      receiver: parseArea(body.receiver, "nhận"),
      item: parseItem(body.item),
      flags: parseFlags(body.flags),
    };
  },

  counterPhone(query = {}) {
    const phone = normalizeVnPhone(query.phone);
    if (!phone) throw ErrorCodes.VALIDATION_ERROR("Số điện thoại phải gồm 10–11 chữ số, bắt đầu bằng 0");
    return phone;
  },

  /** Bo loc danh sach don (US-20): nhom trang thai cua khach va khoang ngay tao. */
  listQuery(query = {}) {
    const group = isFilled(query.group) ? query.group : null;
    if (group && !CUSTOMER_GROUPS.some((g) => g.code === group)) {
      throw ErrorCodes.VALIDATION_ERROR("Nhóm trạng thái không hợp lệ");
    }
    const from = parseDay(query.from, "Từ ngày", false);
    const to = parseDay(query.to, "Đến ngày", true);
    if (from && to && from > to) throw ErrorCodes.VALIDATION_ERROR("Từ ngày phải trước hoặc bằng đến ngày");
    return { group, from, to };
  },
};
