import { ok } from "../../core/response.js";
import { ErrorCodes } from "../../core/errors.js";

const TRACKING_CODE = /^EXP\d{10}$/;

// Tra cuu cong khai (US-22): chi dich HTTP; hanh trinh do JourneyService doc (Redis, thieu thi dung lai).
export class TrackingController {
  /** @param {{ journeyService: import("../orders/JourneyService.js").JourneyService }} deps */
  constructor({ journeyService }) {
    this.journeyService = journeyService;
  }

  get = async (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!TRACKING_CODE.test(code)) {
      throw ErrorCodes.VALIDATION_ERROR("Mã vận đơn gồm EXP và 10 chữ số, ví dụ EXP1000000001");
    }
    const journey = await this.journeyService.get(code);
    if (!journey) throw ErrorCodes.NOT_FOUND(`Không tìm thấy đơn ${code}`);
    return ok(res, journey);
  };
}
