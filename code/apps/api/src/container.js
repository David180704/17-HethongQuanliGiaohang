// Composition Root (Dependency Injection): NOI DUY NHAT biet lop cu the nao duoc
// dung va noi chung voi nhau. Moi lop khac chi nhan phu thuoc qua constructor
// (Dependency Inversion) -> muon doi Redis sang bo nho, bcrypt sang argon2...
// chi sua file nay.
//
//   HTTP -> Router (Factory) -> Controller -> Service (Template Method)
//        -> CachedRepository (Decorator) -> Repository -> MongoDB
//   Service --phat su kien--> EventBus (Observer) --> xoa cache lien quan
import { env } from "./config/env.js";
import { getRedis } from "./config/redis.js";
import { Role } from "./models/Role.js";
import { Route } from "./models/Route.js";
import { EventBus } from "./core/EventBus.js";
import { BaseRepository } from "./core/BaseRepository.js";
import { CachedRepository } from "./core/CachedRepository.js";
import { CacheService } from "./infrastructure/cache/CacheService.js";
import { RedisCacheStore } from "./infrastructure/cache/RedisCacheStore.js";
import { MemoryCacheStore } from "./infrastructure/cache/MemoryCacheStore.js";
import { BcryptPasswordHasher } from "./infrastructure/security/BcryptPasswordHasher.js";
import { RefreshTokenStore } from "./infrastructure/security/RefreshTokenStore.js";
import { JwtTokenService } from "./infrastructure/security/JwtTokenService.js";
import { LoginThrottle } from "./infrastructure/security/LoginThrottle.js";
import { MailService } from "./infrastructure/mail/MailService.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createRequirePermission } from "./middleware/rbac.js";
import { UserRepository } from "./modules/users/UserRepository.js";
import { UserService } from "./modules/users/UserService.js";
import { RouteService } from "./modules/routes/RouteService.js";
import { HubRepository } from "./modules/hubs/HubRepository.js";
import { HubService } from "./modules/hubs/HubService.js";
import { PickupLocationRepository } from "./modules/pickupLocations/PickupLocationRepository.js";
import { PickupLocationService } from "./modules/pickupLocations/PickupLocationService.js";
import { PricingService } from "./modules/pricing/PricingService.js";
import { OrderDraftRepository } from "./modules/orderDrafts/OrderDraftRepository.js";
import { OrderDraftService } from "./modules/orderDrafts/OrderDraftService.js";
import { ServiceAreaRepository } from "./modules/serviceAreas/ServiceAreaRepository.js";
import { ServiceAreaService } from "./modules/serviceAreas/ServiceAreaService.js";
import { ServiceTypeRepository } from "./modules/serviceTypes/ServiceTypeRepository.js";
import { ServiceTypeService } from "./modules/serviceTypes/ServiceTypeService.js";
import { PriceTableRepository } from "./modules/priceTables/PriceTableRepository.js";
import { PriceTableService } from "./modules/priceTables/PriceTableService.js";
import { Order } from "./models/Order.js";
import { PublicCatalogService } from "./modules/public/PublicCatalogService.js";
import { PermissionService } from "./modules/rbac/PermissionService.js";
import { AuthService } from "./modules/auth/AuthService.js";

// Danh muc nao doi thi phai xoa them cache cua man hinh cong khai nao.
// Them danh muc moi = them 1 dong o day, khong sua service (Open/Closed).
const DEPENDENT_CACHE_SCOPES = {
  serviceTypes: ["public:serviceTypes", "public:priceTables"],
  serviceAreas: ["public:serviceAreas"],
  priceTables: ["public:priceTables"],
};

/**
 * @param {object} [options]
 * @param {"redis"|"memory"} [options.cacheStore] mac dinh theo env CACHE_STORE (redis)
 * @param {number} [options.cacheTtlSeconds]      mac dinh theo env CACHE_TTL_SECONDS (30)
 */
export function buildContainer({ cacheStore = env.cache.store, cacheTtlSeconds = env.cache.ttlSeconds } = {}) {
  const redis = getRedis();
  const events = new EventBus();
  const cache = new CacheService({
    store: cacheStore === "memory" ? new MemoryCacheStore() : new RedisCacheStore(redis),
    defaultTtlSeconds: cacheTtlSeconds,
  });

  // ---- Ha tang (Adapter) ----
  const passwordHasher = new BcryptPasswordHasher(10);
  const tokenService = new JwtTokenService({ ...env.jwt, refreshTokenStore: new RefreshTokenStore(redis) });
  const loginThrottle = new LoginThrottle(redis);
  const mailService = new MailService(env.smtp);

  // ---- Repository: ban doc thang DB + ban co cache (Decorator) cho man hinh quan tri ----
  const withCache = (repository, scope) => new CachedRepository(repository, { cache, scope });
  const userRepository = new UserRepository();
  const routeRepository = new BaseRepository(Route, { searchFields: ["code", "name"] });
  const hubRepository = new HubRepository();
  const serviceAreaRepository = new ServiceAreaRepository();
  const serviceTypeRepository = new ServiceTypeRepository();
  const priceTableRepository = new PriceTableRepository();
  const roleRepository = new BaseRepository(Role);
  const orderRepository = new BaseRepository(Order);
  const pickupLocationRepository = new PickupLocationRepository();

  // ---- Service ----
  const permissionService = new PermissionService({ roleRepository, cache });
  // Dang nhap dung repository KHONG cache: vua bi khoa la phai chan ngay.
  const authService = new AuthService({ userRepository, passwordHasher, tokenService, loginThrottle, mailService });
  const services = {
    users: new UserService({ repository: withCache(userRepository, "users"), passwordHasher, events, hubRepository }),
    hubs: new HubService({
      repository: withCache(hubRepository, "hubs"),
      hubRepository,
      serviceAreaRepository,
      routeRepository,
      userRepository,
      events,
    }),
    routes: new RouteService({ repository: withCache(routeRepository, "routes"), hubRepository, events }),
    serviceAreas: new ServiceAreaService({
      repository: withCache(serviceAreaRepository, "serviceAreas"),
      hubRepository,
      pickupLocationRepository,
      events,
    }),
    serviceTypes: new ServiceTypeService({
      repository: withCache(serviceTypeRepository, "serviceTypes"),
      priceTableRepository,
      events,
    }),
    priceTables: new PriceTableService({
      repository: withCache(priceTableRepository, "priceTables"),
      priceTableRepository,
      serviceTypeRepository,
      orderRepository,
      events,
    }),
  };
  // Dia diem lay hang cua tung khach: khong cache (du lieu rieng, rang buoc can so moi nhat)
  services.pickupLocations = new PickupLocationService({
    repository: pickupLocationRepository,
    serviceAreaRepository,
    orderRepository,
  });
  // Tinh phi va nhap don: doc thang DB (phi theo bang gia moi nhat, nhap la du lieu rieng)
  const pricingService = new PricingService({ serviceTypeRepository, priceTableRepository, serviceAreaRepository });
  const orderDraftService = new OrderDraftService({ repository: new OrderDraftRepository() });
  const publicCatalogService = new PublicCatalogService({
    serviceTypeRepository,
    serviceAreaRepository,
    priceTableRepository,
    cache,
  });

  // ---- Observer: danh muc doi -> xoa cache trang cong khai phu thuoc ----
  events.on("catalog.changed", ({ resource }) => cache.invalidate(...(DEPENDENT_CACHE_SCOPES[resource] || [])));

  const { requireAuth, guardAuthenticated, optionalAuth } = createAuthMiddleware(tokenService);
  const requirePermission = createRequirePermission(permissionService);

  return {
    events,
    cache,
    tokenService,
    loginThrottle,
    permissionService,
    authService,
    publicCatalogService,
    pricingService,
    orderDraftService,
    services,
    middleware: { requireAuth, guardAuthenticated, optionalAuth, requirePermission },
  };
}

// Singleton: ca tien trinh dung chung mot container (mot ket noi Redis, mot EventBus).
let defaultContainer;
export function getContainer() {
  if (!defaultContainer) defaultContainer = buildContainer();
  return defaultContainer;
}
