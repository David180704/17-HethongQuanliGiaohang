import { created, ok } from "../../core/response.js";
import { MAX_PICKUP_LOCATIONS } from "./PickupLocationService.js";

// Nhu CrudController nhung moi thao tac kem chu so huu lay tu token (req.user.id).
export class PickupLocationController {
  /** @param {import("./PickupLocationService.js").PickupLocationService} service */
  constructor(service) {
    this.service = service;
  }

  list = async (req, res) => {
    const items = await this.service.list(req.user.id);
    return ok(res, items, { total: items.length, max: MAX_PICKUP_LOCATIONS });
  };

  get = async (req, res) => ok(res, await this.service.get(req.user.id, req.params.id));

  create = async (req, res) => created(res, await this.service.create(req.user.id, req.body || {}));

  update = async (req, res) => ok(res, await this.service.update(req.user.id, req.params.id, req.body || {}));

  remove = async (req, res) => {
    await this.service.remove(req.user.id, req.params.id);
    return ok(res, { deleted: true });
  };
}
