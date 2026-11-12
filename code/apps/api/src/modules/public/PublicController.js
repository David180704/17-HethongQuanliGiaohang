import { ok } from "../../core/response.js";

// X-Cache: HIT = lay tu cache (khong cham MongoDB), MISS = vua doc DB roi cache lai.
// Mo DevTools > Network (hoac curl -i) de thay cache hoat dong.
function sendCached(res, { value, hit }) {
  res.set("X-Cache", hit ? "HIT" : "MISS");
  return ok(res, value);
}

export class PublicController {
  /** @param {import("./PublicCatalogService.js").PublicCatalogService} service */
  constructor(service) {
    this.service = service;
  }

  serviceTypes = async (req, res) => sendCached(res, await this.service.listServiceTypes());

  serviceAreas = async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    return sendCached(res, await this.service.listServiceAreas({ search }));
  };

  provinces = async (req, res) => sendCached(res, await this.service.listProvinces());

  wards = async (req, res) => {
    const province = typeof req.query.province === "string" ? req.query.province.trim() : "";
    return sendCached(res, await this.service.listWards(province));
  };

  priceTables = async (req, res) => sendCached(res, await this.service.listActivePriceTables());
}
