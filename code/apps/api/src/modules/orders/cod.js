// Thu ho COD va ai tra phi van chuyen (US-19) - ham thuan.
//   SHOP_PREPAID    nguoi gui tra truoc: online qua VNPay (US-44) hoac tien mat luc shipper lay hang / tai quay
//   RECIPIENT_PAID  nguoi nhan tra luc giao: shipper thu cod.amount + phi
//   DEDUCT_FROM_COD khau tru phi vao tien thu ho: thu ho phai >= phi (chan luu, khong chi canh bao)
import { ErrorCodes } from "../../core/errors.js";
import { FEE_PAYER, FEE_PAYMENT_METHOD } from "../../constants/enums.js";

export const COD_MAX = 20_000_000;

const vnd = (amount) => `${amount.toLocaleString("vi-VN")} đ`;

/** Doc phan thu ho tu body tao don (chua biet phi). Mac dinh: khong thu ho, nguoi nhan tra phi. */
export function parseCod(cod) {
  const source = cod && typeof cod === "object" ? cod : {};
  const enabled = source.enabled === true;
  const feePayer = source.feePayer ?? "RECIPIENT_PAID";
  if (!FEE_PAYER.includes(feePayer)) {
    throw ErrorCodes.VALIDATION_ERROR("Hình thức trả phí phải là SHOP_PREPAID, RECIPIENT_PAID hoặc DEDUCT_FROM_COD");
  }

  let amount = 0;
  if (enabled) {
    amount = Math.round(Number(source.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw ErrorCodes.VALIDATION_ERROR("Bật thu hộ thì tiền thu hộ phải lớn hơn 0");
    if (amount > COD_MAX) throw ErrorCodes.VALIDATION_ERROR(`Tiền thu hộ tối đa ${vnd(COD_MAX)}`);
  }
  if (feePayer === "DEDUCT_FROM_COD" && !enabled) {
    throw ErrorCodes.VALIDATION_ERROR("Khấu trừ phí vào tiền thu hộ thì phải bật thu hộ");
  }

  let feePaymentMethod = null;
  if (feePayer === "SHOP_PREPAID") {
    if (!FEE_PAYMENT_METHOD.includes(source.feePaymentMethod)) {
      throw ErrorCodes.VALIDATION_ERROR("Người gửi trả trước: chọn thanh toán online VNPay hoặc tiền mặt khi shipper đến lấy hàng");
    }
    feePaymentMethod = source.feePaymentMethod;
  }
  return { enabled, amount, feePayer, feePaymentMethod };
}

/** Khach le gui hang khong kem thu ho; chi shop doi tac (doanh nghiep) duoc thu ho / tru phi vao thu ho. */
export const isShop = (customer) => customer?.role === "CUSTOMER" && customer?.customerType === "BUSINESS";

export function assertCodAllowed(cod, customer) {
  if ((cod.enabled || cod.feePayer === "DEDUCT_FROM_COD") && !isShop(customer)) {
    throw ErrorCodes.SHOP_ONLY("Thu hộ (COD) chỉ dành cho shop đối tác — khách lẻ gửi hàng không kèm thu hộ");
  }
}

/** Gui nhanh bat buoc nguoi gui tra truoc phi van chuyen (US-44, de 14). */
export function assertExpressPrepaid(cod, serviceType) {
  if (serviceType?.code === "EXPRESS" && cod.feePayer !== "SHOP_PREPAID") {
    throw ErrorCodes.VALIDATION_ERROR("Gửi nhanh: người gửi phải trả trước phí vận chuyển (thanh toán online VNPay hoặc tiền mặt)");
  }
}

/** Rang buoc can biet phi: khau tru phi vao thu ho thi tien thu ho phai du tra phi. */
export function assertCodCoversFee(cod, fee) {
  if (cod.feePayer === "DEDUCT_FROM_COD" && cod.amount < fee.total) {
    throw ErrorCodes.COD_LESS_THAN_FEE(
      `Tiền thu hộ ${vnd(cod.amount)} nhỏ hơn phí vận chuyển ${vnd(fee.total)} — không khấu trừ phí vào thu hộ được`,
    );
  }
}

/** Shipper thu cua nguoi nhan bao nhieu, Express tra lai shop bao nhieu (doi soat, US-34). */
export function codSummary(cod, fee) {
  const codAmount = cod.enabled ? cod.amount : 0;
  return {
    collectFromReceiver: codAmount + (cod.feePayer === "RECIPIENT_PAID" ? fee.total : 0),
    payToShop: codAmount - (cod.feePayer === "DEDUCT_FROM_COD" ? fee.total : 0),
  };
}
