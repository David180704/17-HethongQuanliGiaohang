import { URL, URLSearchParams } from "node:url";
import { ErrorCodes } from "../../core/errors.js";
import { PAYMENT_CLIENT } from "../../constants/enums.js";
import { IPN_RESPONSE, buildPaymentUrl, isSuccess, verifySignature } from "./vnpay.js";

const PAYMENT_STATUS_LABELS = { PENDING: "Chờ thanh toán", SUCCESS: "Thanh toán thành công", FAILED: "Thanh toán không thành công" };

const withLabel = (payment) => payment && { ...payment, statusLabel: PAYMENT_STATUS_LABELS[payment.status] };

/**
 * Thanh toan phi van chuyen qua VNPay (US-44):
 *   1. Khach (chu don, nguoi gui tra truoc bang VNPay) tao giao dich -> API tra duong dan sang VNPay.
 *   2. VNPay goi IPN (may chu -> may chu) va chuyen trinh duyet ve trang return. Ca hai deu kiem chu ky roi
 *      xu ly DUNG MOT LAN (giao dich chi doi tu PENDING): thanh cong thi don ghi cod.feePaid trong cung transaction.
 *   3. Nguoi dung duoc chuyen ve returnTo cua app (trang chi tiet don tren web, deep link cua app di dong).
 */
export class PaymentService {
  constructor({ paymentRepository, orderRepository, orderService, transactions, config, publicApiUrl, allowedReturns, clock = () => new Date() }) {
    Object.assign(this, { paymentRepository, orderRepository, orderService, transactions, config, publicApiUrl, allowedReturns, clock });
  }

  get configured() {
    return Boolean(this.config?.tmnCode && this.config?.hashSecret);
  }

  /** returnTo chi nhan dia chi cua app minh (chong chuyen huong toi trang la sau khi thanh toan). */
  #checkReturnTo(returnTo) {
    if (returnTo === undefined || returnTo === null || returnTo === "") return null;
    if (typeof returnTo !== "string" || returnTo.length > 500) throw ErrorCodes.VALIDATION_ERROR("returnTo không hợp lệ");
    const { webOrigins = [], mobilePrefixes = [] } = this.allowedReturns || {};
    let webOk;
    try {
      webOk = webOrigins.includes(new URL(returnTo).origin);
    } catch {
      webOk = false;
    }
    if (!webOk && !mobilePrefixes.some((prefix) => returnTo.startsWith(prefix))) {
      throw ErrorCodes.VALIDATION_ERROR("returnTo phải là địa chỉ của ứng dụng EDMS");
    }
    return returnTo;
  }

  async createVnpay(user, input = {}, ipAddr) {
    if (!this.configured) throw ErrorCodes.PAYMENT_NOT_CONFIGURED();
    const client = input.client ?? "WEB";
    if (!PAYMENT_CLIENT.includes(client)) throw ErrorCodes.VALIDATION_ERROR("client phải là WEB hoặc MOBILE");
    const returnTo = this.#checkReturnTo(input.returnTo);
    if (!input.orderId) throw ErrorCodes.VALIDATION_ERROR("Thiếu orderId");

    // Chi chu don moi thanh toan duoc (khach thanh toan don cua minh)
    const order = await this.orderRepository.findOne({ _id: input.orderId, customerId: user.id });
    if (!order) throw ErrorCodes.NOT_FOUND("Không tìm thấy đơn hàng của bạn");
    if (order.cod?.feePayer !== "SHOP_PREPAID" || order.cod?.feePaymentMethod !== "VNPAY") {
      throw ErrorCodes.VALIDATION_ERROR("Đơn này không chọn trả trước phí vận chuyển qua VNPay");
    }
    if (order.cod.feePaid) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} đã thanh toán phí vận chuyển`);
    if (order.status === "CANCELLED") throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} đã hủy`);

    const now = this.clock();
    const expiresAt = new Date(now.getTime() + this.config.expireMinutes * 60 * 1000);
    // Ma giao dich: ma van don + thoi diem (chu so) - moi lan thu mot ma moi, VNPay yeu cau khong trung
    const txnRef = `${order.trackingCode}${now.getTime().toString().slice(-9)}`;
    const amount = order.fee.total;
    const payment = await this.paymentRepository.insert({
      orderId: order._id,
      trackingCode: order.trackingCode,
      customerId: order.customerId,
      txnRef,
      amount,
      client,
      returnTo,
      expiresAt,
    });
    const paymentUrl = buildPaymentUrl({
      payUrl: this.config.payUrl,
      tmnCode: this.config.tmnCode,
      secret: this.config.hashSecret,
      amount,
      txnRef,
      // VNPay khuyen noi dung khong dau, khong ky tu dac biet
      orderInfo: `Thanh toan phi van chuyen don ${order.trackingCode}`,
      returnUrl: `${this.publicApiUrl}/payments/vnpay/return`,
      ipAddr,
      createdAt: now,
      expiresAt,
    });
    return { ...withLabel(payment), paymentUrl };
  }

  /**
   * Ket qua VNPay gui ve (IPN hoac trang return) - kiem chu ky, so tien, roi xu ly dung mot lan.
   * Tra { response: ma tra loi IPN cho VNPay, payment }.
   */
  async handleVnpayResult(query = {}) {
    if (!this.configured) return { response: IPN_RESPONSE.UNKNOWN, payment: null };
    if (!verifySignature(query, this.config.hashSecret)) return { response: IPN_RESPONSE.INVALID_SIGNATURE, payment: null };
    const payment = await this.paymentRepository.findByTxnRef(String(query.vnp_TxnRef || ""));
    if (!payment) return { response: IPN_RESPONSE.NOT_FOUND, payment: null };
    if (Number(query.vnp_Amount) !== payment.amount * 100) return { response: IPN_RESPONSE.INVALID_AMOUNT, payment };
    if (payment.status !== "PENDING") return { response: IPN_RESPONSE.ALREADY_CONFIRMED, payment };

    const success = isSuccess(query);
    const at = this.clock();
    const result = {
      status: success ? "SUCCESS" : "FAILED",
      responseCode: query.vnp_ResponseCode ?? null,
      transactionNo: query.vnp_TransactionNo ?? null,
      bankCode: query.vnp_BankCode ?? null,
      paidAt: success ? at : null,
    };
    const updated = await this.transactions.run(async (session) => {
      const done = await this.paymentRepository.updateWhere({ _id: payment._id, status: "PENDING" }, { $set: result }, { session });
      if (!done) return null; // IPN va trang return den cung luc: ben kia da xu ly
      if (success) {
        await this.orderRepository.updateWhere(
          { _id: payment.orderId },
          { $set: { "cod.feePaid": true, "cod.feePaidAt": at, "cod.txnRef": payment.txnRef } },
          { session },
        );
      }
      return done;
    });
    if (!updated) return { response: IPN_RESPONSE.ALREADY_CONFIRMED, payment: await this.paymentRepository.findByTxnRef(payment.txnRef) };
    return { response: IPN_RESPONSE.OK, payment: updated };
  }

  /** Dia chi dua nguoi dung ve app sau trang return: them ket qua vao query. */
  resultRedirect(payment, response) {
    const status = payment?.status ?? "ERROR";
    const target = payment?.returnTo || null;
    if (!target) return null;
    const params = new URLSearchParams({ thanhToan: status, maGiaoDich: payment.txnRef, ma: response.RspCode });
    return `${target}${target.includes("?") ? "&" : "?"}${params}`;
  }

  /** Lich su thanh toan cua mot don - theo pham vi xem don (chu don, kho, admin). */
  async listForOrder(user, orderId) {
    if (!orderId) throw ErrorCodes.VALIDATION_ERROR("Thiếu orderId");
    const order = await this.orderService.get(user, orderId);
    const items = await this.paymentRepository.listByOrder(order._id);
    return items.map(withLabel);
  }
}
