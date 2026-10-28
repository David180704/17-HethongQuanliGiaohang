import { ok, created } from "./response.js";

// Controller chi dich HTTP <-> service: doc req, goi service, dinh dang response.
// Khong chua nghiep vu (Single Responsibility) -> doi sang giao thuc khac
// (GraphQL, gRPC) khong dong vao service.
//
// Method viet dang arrow field de truyen thang vao Express ma khong mat "this".
export class CrudController {
  /** @param {import("./BaseCrudService.js").BaseCrudService} service */
  constructor(service) {
    this.service = service;
  }

  list = async (req, res) => {
    const { items, meta } = await this.service.list(req.query);
    return ok(res, items, meta);
  };

  get = async (req, res) => ok(res, await this.service.get(req.params.id));

  create = async (req, res) => created(res, await this.service.create(req.body || {}));

  update = async (req, res) => ok(res, await this.service.update(req.params.id, req.body || {}));

  remove = async (req, res) => {
    await this.service.remove(req.params.id);
    return ok(res, { deleted: true });
  };
}
