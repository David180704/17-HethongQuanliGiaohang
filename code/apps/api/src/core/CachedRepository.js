// Decorator pattern: boc mot repository, them cache cho thao tac DOC va xoa cache
// khi GHI. Giu nguyen giao dien cua repository goc (Liskov) nen service khong biet
// - va khong can biet - minh dang dung ban co cache hay khong.
export class CachedRepository {
  /**
   * @param {import("./BaseRepository.js").BaseRepository} inner
   * @param {{ cache: import("../infrastructure/cache/CacheService.js").CacheService, scope: string }} options
   */
  constructor(inner, { cache, scope }) {
    this.inner = inner;
    this.cache = cache;
    this.scope = scope;
  }

  async findPage(args) {
    const { value } = await this.cache.getOrSet(this.scope, ["page", args], () => this.inner.findPage(args));
    return value;
  }

  async findById(id) {
    const { value } = await this.cache.getOrSet(this.scope, ["id", String(id)], () => this.inner.findById(id));
    return value;
  }

  // Truy van tuy y / kiem tra rang buoc: luon doc thang DB, khong cache (rang
  // buoc nghiep vu phai dua tren du lieu moi nhat).
  findOne(filter) {
    return this.inner.findOne(filter);
  }

  exists(filter) {
    return this.inner.exists(filter);
  }

  async create(data) {
    const result = await this.inner.create(data);
    await this.cache.invalidate(this.scope);
    return result;
  }

  async updateById(id, data) {
    const result = await this.inner.updateById(id, data);
    await this.cache.invalidate(this.scope);
    return result;
  }

  async deleteById(id) {
    const result = await this.inner.deleteById(id);
    await this.cache.invalidate(this.scope);
    return result;
  }
}
