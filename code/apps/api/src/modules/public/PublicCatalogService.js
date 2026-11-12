import { ErrorCodes } from "../../core/errors.js";
import { PROVINCES, findProvince } from "../adminUnits/adminUnits.js";

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

  /** 34 tinh/thanh (dia gioi 2025) kem so xa/phuong va so xa/phuong dang phuc vu - goi y o form dia chi. */
  listProvinces() {
    return this.cache.getOrSet("public:serviceAreas", ["provinces"], async () => {
      const served = await this.serviceAreaRepository.servedCountByProvince();
      return PROVINCES.map((p) => ({ name: p.name, fullName: p.fullName, wardCount: p.wards.length, servedCount: served[p.name] || 0 }));
    });
  }

  /** Xa/phuong cua mot tinh (go khong dau duoc), danh dau xa/phuong dang phuc vu. */
  listWards(provinceText) {
    const province = findProvince(provinceText);
    if (!province) throw ErrorCodes.VALIDATION_ERROR(`Tỉnh/thành "${provinceText}" không có trong danh mục 34 tỉnh/thành`);
    return this.cache.getOrSet("public:serviceAreas", ["wards", province.name], async () => {
      const served = new Set(await this.serviceAreaRepository.servedWards(province.name));
      return { province: province.name, wards: province.wards.map((name) => ({ name, served: served.has(name) })) };
    });
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
