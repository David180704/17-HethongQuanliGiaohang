import { ErrorCodes } from "./errors.js";

const MAX_LIMIT = 100;

// Template Method pattern: quy trinh CRUD danh muc co dinh o lop cha
//   kiem tra du lieu (validator) -> hook nghiep vu -> ghi (repository) -> phat su kien
// Lop con chi ghi de cac hook beforeCreate / beforeUpdate / beforeDelete de them
// rang buoc rieng, khong chep lai ca quy trinh (Open/Closed).
export class BaseCrudService {
  /**
   * @param {object} deps
   * @param {string} deps.resource       ten danh muc, dung cho su kien "catalog.changed"
   * @param {object} deps.repository     BaseRepository hoac CachedRepository (cung giao dien)
   * @param {{ create(body): object, update(body): object }} deps.validator  Strategy kiem tra du lieu
   * @param {import("./EventBus.js").EventBus} [deps.events]
   * @param {string[]} [deps.filterFields] field duoc phep loc qua query (?role=...)
   * @param {boolean} [deps.allowDelete]
   */
  constructor({ resource, repository, validator, events, filterFields = [], allowDelete = true }) {
    this.resource = resource;
    this.repository = repository;
    this.validator = validator;
    this.events = events;
    this.filterFields = filterFields;
    this.allowDelete = allowDelete;
  }

  // Chi giu field nam trong danh sach cho phep, gia tri phai la chuoi: tham so
  // la (vd ?abc=1) khong lot vao truy van va khong sinh khoa cache rac.
  parseListQuery(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || 20));
    const search = typeof query.search === "string" ? query.search.trim() : "";
    const filters = {};
    for (const field of this.filterFields) {
      if (typeof query[field] === "string" && query[field] !== "") filters[field] = query[field];
    }
    return { page, limit, search, filters };
  }

  async list(query) {
    const { page, limit, search, filters } = this.parseListQuery(query);
    const { items, total } = await this.repository.findPage({ page, limit, search, filters });
    return { items, meta: { page, limit, total } };
  }

  async get(id) {
    const item = await this.repository.findById(id);
    if (!item) throw ErrorCodes.NOT_FOUND();
    return item;
  }

  async create(input) {
    const data = await this.validator.create(input);
    await this.beforeCreate(data);
    const item = await this.repository.create(data);
    await this.publish("created", item);
    return item;
  }

  async update(id, input) {
    const data = await this.validator.update(input);
    await this.beforeUpdate(id, data);
    const item = await this.repository.updateById(id, data);
    if (!item) throw ErrorCodes.NOT_FOUND();
    await this.publish("updated", item);
    return item;
  }

  async remove(id) {
    if (!this.allowDelete) throw ErrorCodes.FORBIDDEN(`Không được xóa ${this.resource}`);
    const item = await this.repository.findById(id);
    if (!item) throw ErrorCodes.NOT_FOUND();
    await this.beforeDelete(item);
    await this.repository.deleteById(id);
    await this.publish("deleted", item);
  }

  // ---- Hook (mac dinh khong lam gi; lop con ghi de khi can) ----
  async beforeCreate(_data) {}

  async beforeUpdate(_id, _data) {}

  async beforeDelete(_item) {}

  async publish(action, item) {
    await this.events?.emit("catalog.changed", { resource: this.resource, action, id: item?._id });
  }
}
