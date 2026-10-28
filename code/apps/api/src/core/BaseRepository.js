// Repository pattern: moi truy cap MongoDB cua mot collection nam o day. Service
// chi noi chuyen voi repository, khong goi thang Model -> doi CSDL/ORM chi sua tang nay.
//
// Ket qua tra ve la object thuong (.lean()) de cache duoc va khong lo method cua
// Mongoose ra ngoai tang du lieu.

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class BaseRepository {
  /**
   * @param {import("mongoose").Model} model
   * @param {{ searchFields?: string[], projection?: string, defaultSort?: object }} [options]
   *   searchFields: cac field tim theo ?search= ; projection: an field nhay cam (vd "-passwordHash")
   */
  constructor(model, { searchFields = [], projection, defaultSort = { createdAt: -1 } } = {}) {
    this.model = model;
    this.searchFields = searchFields;
    this.projection = projection;
    this.defaultSort = defaultSort;
  }

  /** filters: { field: value } da duoc service loc theo danh sach cho phep. */
  async findPage({ page = 1, limit = 20, search = "", filters = {} } = {}) {
    const query = this.buildQuery({ search, filters });
    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .select(this.projection)
        .sort(this.defaultSort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.model.countDocuments(query),
    ]);
    return { items, total };
  }

  // Tu khoa tim kiem do nguoi dung go -> escape truoc khi dua vao $regex (chan
  // regex injection / ReDoS kieu "(a+)+$").
  buildQuery({ search, filters }) {
    const query = { ...filters };
    if (search && this.searchFields.length) {
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      query.$or = this.searchFields.map((field) => ({ [field]: pattern }));
    }
    return query;
  }

  findById(id) {
    return this.model.findById(id).select(this.projection).lean();
  }

  findOne(filter) {
    return this.model.findOne(filter).select(this.projection).lean();
  }

  async exists(filter) {
    return Boolean(await this.model.exists(filter));
  }

  // Doc lai sau khi tao de ap projection (model.create tra ve document day du,
  // vd van con passwordHash).
  async create(data) {
    const doc = await this.model.create(data);
    return this.findById(doc._id);
  }

  updateById(id, data) {
    return this.model
      .findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .select(this.projection)
      .lean();
  }

  async deleteById(id) {
    const result = await this.model.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}
