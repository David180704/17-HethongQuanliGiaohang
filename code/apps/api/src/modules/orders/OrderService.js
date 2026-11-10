import { ErrorCodes } from "../../core/errors.js";
import { ORDER_STATUS } from "../../constants/enums.js";
import { orderValidator } from "./orders.validator.js";
import { TRACKING_COUNTER, formatTrackingCode } from "./CounterRepository.js";
import { assertCodCoversFee } from "./cod.js";
import { groupFilter, withDisplay } from "./orderStatus.js";
import { suggestVehicle } from "./vehicle.js";
import { randomBytes } from "node:crypto";

const MAX_LIMIT = 100;

/**
 * Don hang (US-18):
 *   - Tao don: chi nhan khi CA noi gui (dia diem lay hang) lan noi nhan thuoc vung phuc
 *     vu; phi tinh theo bang gia dang hieu luc luc tao don (PricingService).
 *   - Ghi trong MOT transaction: tang counter sinh ma van don EXP + 10 chu so, them don,
 *     xoa ban nhap (neu tao tu nhap) - loi giua chung thi ca ba cung huy.
 *   - Xac nhan (CREATED -> CONFIRMED) boi nhan vien hub phu trach: khoa phi (US-17).
 * Pham vi xem don theo vai tro: khach - don cua minh; nhan vien hub - don cua hub minh
 * va buu cuc truc thuoc; tai xe - don duoc giao; admin - tat ca.
 */
export class OrderService {
  constructor({
    orderRepository,
    counterRepository,
    orderDraftRepository,
    pickupLocationRepository,
    serviceAreaRepository,
    routeRepository,
    hubRepository,
    userRepository,
    pricingService,
    transactions,
    orderEvents = null,
    passwordHasher = null,
    validator = orderValidator,
  }) {
    Object.assign(this, {
      orderRepository,
      counterRepository,
      orderDraftRepository,
      pickupLocationRepository,
      serviceAreaRepository,
      routeRepository,
      hubRepository,
      userRepository,
      pricingService,
      transactions,
      orderEvents,
      passwordHasher,
      validator,
    });
  }

  // US-21: trang thai + statusHistory da ghi xong (nguon su that) moi phat su kien len hang doi. Phat loi
  // (Redis tam mat) khong lam hong thao tac: hanh trinh cong khai van dung lai duoc tu don khi doc.
  async #publishStatusChanged(order, from, by) {
    if (!this.orderEvents || !order) return;
    try {
      await this.orderEvents.publish("order.status.changed", {
        orderId: String(order._id),
        trackingCode: order.trackingCode,
        from,
        to: order.status,
        by: by ? String(by) : null,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Khong phat duoc su kien doi trang thai don ${order.trackingCode}:`, err.message);
    }
  }

  async create(user, input) {
    const data = this.validator.create(input);
    const customer = await this.userRepository.findById(user.id);
    if (customer?.status !== "ACTIVE") throw ErrorCodes.FORBIDDEN("Tài khoản chưa hoạt động nên chưa tạo được đơn");

    const location = await this.pickupLocationRepository.findActiveOwned(user.id, data.pickupLocationId);
    if (!location) throw ErrorCodes.NOT_FOUND("Không tìm thấy địa điểm lấy hàng của bạn");
    const pickupArea = await this.serviceAreaRepository.findById(location.serviceAreaId);
    if (!pickupArea) {
      throw ErrorCodes.OUT_OF_SERVICE_AREA(`Nơi gửi "${location.label}" không còn thuộc vùng phục vụ`);
    }
    const receiverArea = await this.pricingService.locate(data.receiver, "nhận");
    const serviceType = await this.pricingService.activeServiceType(data.serviceTypeId);
    const quote = await this.pricingService.quote({
      pickupArea,
      receiverArea,
      item: data.item,
      flags: data.flags,
      serviceType,
    });
    // Khau tru phi vao thu ho ma thu ho < phi -> chan luu (US-19)
    assertCodCoversFee(data.cod, quote.fee);
    const route = await this.routeRepository.findById(pickupArea.routeId);

    const now = new Date();
    const order = {
      customerId: customer._id,
      customerName: customer.shopName || customer.fullName,
      pickupLocationId: location._id,
      pickupWard: location.ward,
      pickupHubId: route?.hubId ?? null,
      receiver: { ...data.receiver, province: receiverArea.province, district: receiverArea.district },
      item: data.item,
      flags: quote.flags,
      serviceTypeId: serviceType._id,
      serviceName: serviceType.name,
      zone: quote.zone,
      chargeableWeight: quote.chargeableWeight,
      priceTableId: quote.priceTableId,
      fee: quote.fee,
      cod: data.cod,
      shopOrderCode: data.shopOrderCode,
      vehicle: suggestVehicle({ chargeableWeight: quote.chargeableWeight, item: data.item, flags: quote.flags }).code,
      status: "CREATED",
      statusHistory: [{ status: "CREATED", at: now, by: customer._id, note: "Khách tạo đơn" }],
    };

    // MOI lenh ghi deu truyen { session }: counter, orders, orderDrafts cung thanh cong hoac cung huy
    const saved = await this.transactions.run(async (session) => {
      const seq = await this.counterRepository.next(TRACKING_COUNTER, {
        session,
        startAfter: () => this.orderRepository.maxTrackingNumber({ session }),
      });
      const created = await this.orderRepository.insert({ ...order, trackingCode: formatTrackingCode(seq) }, { session });
      if (data.draftToken) await this.orderDraftRepository.consume(data.draftToken, customer._id, { session });
      return created;
    });
    await this.#publishStatusChanged(saved, null, customer._id);
    return withDisplay(saved);
  }

  // ---------------------------------------------------------------- tiep nhan tai quay (US-40)

  /** Diem (hub/buu cuc) cua nhan vien kho kem khu vuc phuc vu - noi gui cua don tai quay. */
  async #counterPoint(user) {
    const staff = await this.userRepository.findById(user.id);
    const hub = staff?.hubId ? await this.hubRepository.findById(staff.hubId) : null;
    if (!hub) throw ErrorCodes.FORBIDDEN("Tài khoản chưa được gán điểm tiếp nhận");
    const area = hub.serviceAreaId ? await this.serviceAreaRepository.findById(hub.serviceAreaId) : null;
    if (!area) throw ErrorCodes.OUT_OF_SERVICE_AREA(`Điểm ${hub.name} chưa gắn khu vực phục vụ`);
    return { staff, hub, area };
  }

  /** Tim khach theo so dien thoai (UC21). Khong co -> found = false, nhan vien tao khach le khi tao don. */
  async findCounterCustomer(user, query) {
    const phone = this.validator.counterPhone(query);
    await this.#counterPoint(user);
    const customer = await this.userRepository.findByPhone(phone);
    if (!customer) return { found: false, phone };
    if (customer.role !== "CUSTOMER") {
      throw ErrorCodes.VALIDATION_ERROR("Số điện thoại này thuộc tài khoản nhân viên, không phải khách hàng");
    }
    const { _id, fullName, customerType, shopName, status, walkIn } = customer;
    return { found: true, phone, customer: { _id, fullName, phone, customerType, shopName, status, walkIn } };
  }

  /** Bao gia tai quay: noi gui la diem cua nhan vien; moi loai dich vu kem goi y phuong tien. */
  async counterQuote(user, input) {
    const data = this.validator.counterQuote(input);
    const { hub } = await this.#counterPoint(user);
    const estimate = await this.pricingService.estimate({
      pickup: { province: hub.province, district: hub.district },
      receiver: data.receiver,
      item: data.item,
      flags: data.flags,
    });
    const vehicle = suggestVehicle({ chargeableWeight: estimate.chargeableWeight, item: data.item, flags: estimate.flags });
    return { ...estimate, vehicle, counter: { hubId: hub._id, hubName: hub.name } };
  }

  /**
   * Tao don tai quay trong MOT transaction: tim hoac tao khach le, sinh ma van don, phi khoa ngay, don di
   * CREATED -> CONFIRMED -> AT_HUB (hang da nam tai diem). Tra truoc tien mat -> ghi da thu phi.
   */
  async createAtCounter(user, input) {
    const data = this.validator.counter(input);
    const { staff, hub, area: pickupArea } = await this.#counterPoint(user);
    const receiverArea = await this.pricingService.locate(data.receiver, "nhận");
    const serviceType = await this.pricingService.activeServiceType(data.serviceTypeId);
    const quote = await this.pricingService.quote({ pickupArea, receiverArea, item: data.item, flags: data.flags, serviceType });
    assertCodCoversFee(data.cod, quote.fee);
    const vehicle = suggestVehicle({ chargeableWeight: quote.chargeableWeight, item: data.item, flags: quote.flags });

    const existing = await this.userRepository.findByPhone(data.customer.phone);
    if (existing && existing.role !== "CUSTOMER") {
      throw ErrorCodes.VALIDATION_ERROR("Số điện thoại này thuộc tài khoản nhân viên, không phải khách hàng");
    }
    if (existing && existing.status === "LOCKED") throw ErrorCodes.FORBIDDEN("Tài khoản khách đang bị khóa");
    if (!existing && !data.customer.fullName) {
      throw ErrorCodes.VALIDATION_ERROR("Khách chưa có tài khoản: nhập họ tên để tạo khách lẻ");
    }
    // Khach le: email noi bo theo so dien thoai, mat khau ngau nhien (chua dang nhap duoc)
    const walkInHash = existing ? null : await this.passwordHasher.hash(randomBytes(24).toString("hex"));

    const now = new Date();
    const paidAtCounter = data.cod.feePayer === "SHOP_PREPAID" && data.cod.feePaymentMethod === "CASH";
    const by = staff._id;
    const saved = await this.transactions.run(async (session) => {
      const customer =
        existing ||
        (await this.userRepository.insert(
          {
            email: `${data.customer.phone}@khachle.edms.vn`,
            phone: data.customer.phone,
            passwordHash: walkInHash,
            fullName: data.customer.fullName,
            role: "CUSTOMER",
            customerType: "INDIVIDUAL",
            status: "ACTIVE",
            walkIn: true,
          },
          { session },
        ));
      const seq = await this.counterRepository.next(TRACKING_COUNTER, {
        session,
        startAfter: () => this.orderRepository.maxTrackingNumber({ session }),
      });
      return this.orderRepository.insert(
        {
          trackingCode: formatTrackingCode(seq),
          channel: "COUNTER",
          receivedBy: by,
          customerId: customer._id,
          customerName: customer.shopName || customer.fullName,
          shopOrderCode: data.shopOrderCode,
          pickupLocationId: null,
          pickupWard: hub.address || hub.district,
          pickupHubId: hub._id,
          receiver: { ...data.receiver, province: receiverArea.province, district: receiverArea.district },
          item: data.item,
          flags: quote.flags,
          serviceTypeId: serviceType._id,
          serviceName: serviceType.name,
          zone: quote.zone,
          chargeableWeight: quote.chargeableWeight,
          priceTableId: quote.priceTableId,
          fee: { ...quote.fee, lockedAt: now },
          cod: { ...data.cod, feePaid: paidAtCounter, feePaidAt: paidAtCounter ? now : null },
          vehicle: vehicle.code,
          status: "AT_HUB",
          statusHistory: [
            { status: "CREATED", at: now, by, note: `Tiếp nhận tại quầy ${hub.name}` },
            { status: "CONFIRMED", at: now, by, note: "Kiểm hàng, báo giá và khóa phí tại quầy" },
            { status: "AT_HUB", at: now, by, note: `Hàng đã nhận tại ${hub.name}` },
          ],
        },
        { session },
      );
    });
    await this.#publishStatusChanged(saved, null, by);
    return { ...withDisplay(saved), vehicleSuggestion: vehicle, newCustomer: !existing };
  }

  async list(user, query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || 20));
    const { group, from, to } = this.validator.listQuery(query);
    const filters = await this.#scope(user);
    if (ORDER_STATUS.includes(query.status)) filters.status = query.status;
    // $and de khong dung khoa $or voi dieu kien tim kiem cua repository
    if (group) filters.$and = [groupFilter(group)];
    if (from || to) filters.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const search = typeof query.search === "string" ? query.search.trim() : "";
    const { items, total } = await this.orderRepository.findPage({ page, limit, search, filters });
    return { items: items.map(withDisplay), meta: { page, limit, total } };
  }

  async get(user, id) {
    return withDisplay(await this.#findInScope(user, id));
  }

  /** Nhan vien hub xac nhan don: CREATED -> CONFIRMED, khoa phi (khong tinh lai). */
  async confirm(user, id) {
    const order = await this.#findInScope(user, id);
    const conflict = () =>
      ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} đã được xử lý (không còn chờ xác nhận)`);
    if (order.status !== "CREATED") throw conflict();
    const now = new Date();
    const confirmed = await this.orderRepository.transition(order._id, "CREATED", {
      $set: { status: "CONFIRMED", "fee.lockedAt": now },
      $push: {
        statusHistory: { status: "CONFIRMED", at: now, by: user.id, note: "Bưu cục xác nhận đơn, khóa phí vận chuyển" },
      },
    });
    if (!confirmed) throw conflict(); // nguoi khac vua xac nhan truoc
    await this.#publishStatusChanged(confirmed, "CREATED", user.id);
    return withDisplay(confirmed);
  }

  async #findInScope(user, id) {
    const order = await this.orderRepository.findOne({ _id: id, ...(await this.#scope(user)) });
    if (!order) throw ErrorCodes.NOT_FOUND("Không tìm thấy đơn hàng");
    return order;
  }

  async #scope(user) {
    switch (user.role) {
      case "ADMIN":
        return {};
      case "CUSTOMER":
        return { customerId: user.id };
      case "SHIPPER":
        return { assignedTo: user.id };
      case "HUB_STAFF": {
        // Doc hub tu CSDL (khong tin hubId trong token): admin vua chuyen diem thi theo ngay
        const staff = await this.userRepository.findById(user.id);
        if (!staff?.hubId) return { _id: null };
        return { pickupHubId: { $in: await this.hubRepository.findFamilyIds(staff.hubId) } };
      }
      default:
        throw ErrorCodes.FORBIDDEN();
    }
  }
}
