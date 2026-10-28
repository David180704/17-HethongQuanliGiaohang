/**
 * Du lieu cong khai cho khach vang lai (GUEST): doc rat nhieu, doi rat it -> cache
 * (mac dinh 30 giay, xoa ngay khi admin sua danh muc - xem container.js).
 * Moi ham tra { value, hit } de controller gan header X-Cache: HIT | MISS.
 */
export class PublicCatalogService {
  /**
   * @param {object} deps
   * @param {import("../serviceTypes/ServiceTypeRepository.js").ServiceTypeRepository} deps.serviceTypeRepository
   * @param {import("../serviceAreas/ServiceAreaRepository.js").ServiceAreaRepository} deps.serviceAreaRepository
   * @param {import("../priceTables/PriceTableRepository.js").PriceTableRepository} deps.priceTableRepository
   * @param {import("../../infrastructure/cache/CacheService.js").CacheService} deps.cache
   */
  constructor({ serviceTypeRepository, serviceAreaRepository, priceTableRepository, cache }) {
    this.serviceTypeRepository = serviceTypeRepository;
    this.serviceAreaRepository = serviceAreaRepository;
    this.priceTableRepository = priceTableRepository;
    this.cache = cache;
  }

  listServiceTypes() {
    return this.cache.getOrSet("public:serviceTypes", ["active"], () => this.serviceTypeRepository.findActivePublic());
  }

  listServiceAreas({ search = "" } = {}) {
    return this.cache.getOrSet("public:serviceAreas", [search], () => this.serviceAreaRepository.searchPublic(search));
  }

  // Bang gia hien hanh duoc cache. Hoi theo mot thoi diem cu the (bao cao, test)
  // thi doc thang DB - khoa cache khong the chua moi moc thoi gian.
  async listActivePriceTables({ at } = {}) {
    if (at) return { value: await this.priceTableRepository.findEffectiveAt(at), hit: false };
    return this.cache.getOrSet("public:priceTables", ["current"], () =>
      this.priceTableRepository.findEffectiveAt(new Date()),
    );
  }
}
