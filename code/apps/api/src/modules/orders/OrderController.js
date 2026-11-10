import { created, ok } from "../../core/response.js";

// Chi dich HTTP <-> service don hang / tinh phi. Moi luat nghiep vu nam trong service.
export class OrderController {
  /**
   * @param {object} deps
   * @param {import("../pricing/PricingService.js").PricingService} deps.pricingService
   * @param {import("./OrderService.js").OrderService} deps.orderService
   */
  constructor({ pricingService, orderService }) {
    this.pricingService = pricingService;
    this.orderService = orderService;
  }

  estimateFee = async (req, res) => ok(res, await this.pricingService.estimate(req.body || {}));

  create = async (req, res) => created(res, await this.orderService.create(req.user, req.body || {}));

  list = async (req, res) => {
    const { items, meta } = await this.orderService.list(req.user, req.query);
    return ok(res, items, meta);
  };

  get = async (req, res) => ok(res, await this.orderService.get(req.user, req.params.id));

  confirm = async (req, res) => ok(res, await this.orderService.confirm(req.user, req.params.id));

  // Tiep nhan tai quay (US-40)
  counterCustomer = async (req, res) => ok(res, await this.orderService.findCounterCustomer(req.user, req.query));

  counterQuote = async (req, res) => ok(res, await this.orderService.counterQuote(req.user, req.body || {}));

  createAtCounter = async (req, res) => created(res, await this.orderService.createAtCounter(req.user, req.body || {}));
}
