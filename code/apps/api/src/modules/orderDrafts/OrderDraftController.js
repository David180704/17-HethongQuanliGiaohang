import { created, ok } from "../../core/response.js";

// Chi dich HTTP <-> OrderDraftService; req.user co the rong (khach vang lai).
export class OrderDraftController {
  /** @param {import("./OrderDraftService.js").OrderDraftService} service */
  constructor(service) {
    this.service = service;
  }

  create = async (req, res) => created(res, await this.service.create(req.body?.payload, req.user));

  get = async (req, res) => ok(res, await this.service.get(req.params.token, req.user));

  update = async (req, res) => ok(res, await this.service.update(req.params.token, req.body?.payload, req.user));
}
