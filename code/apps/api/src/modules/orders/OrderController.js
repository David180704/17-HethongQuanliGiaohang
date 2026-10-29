import { ok } from "../../core/response.js";

// Chi dich HTTP <-> service don hang / tinh phi. Moi luat nghiep vu nam trong service.
export class OrderController {
  /** @param {{ pricingService: import("../pricing/PricingService.js").PricingService }} deps */
  constructor({ pricingService }) {
    this.pricingService = pricingService;
  }

  estimateFee = async (req, res) => ok(res, await this.pricingService.estimate(req.body || {}));
}
