// Composition Root (Dependency Injection): NOI DUY NHAT biet lop cu the nao duoc
// dung va noi chung voi nhau. Moi lop khac chi nhan phu thuoc qua constructor
// (Dependency Inversion) -> muon doi Redis sang bo nho, bcrypt sang argon2...
// chi sua file nay.
//
//   HTTP -> Router (Factory) -> Controller -> Service (Template Method)
//        -> CachedRepository (Decorator) -> Repository -> MongoDB
//   Service --phat su kien--> EventBus (Observer) --> xoa cache lien quan
//   OrderService --order.status.changed--> hang doi BullMQ --> consumer (hanh trinh cong khai, ...)
import { env } from "./config/env.js";
import { getRedis } from "./config/redis.js";
import { Role } from "./models/Role.js";
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
import { RateLimiter } from "./infrastructure/security/RateLimiter.js";
import { MailService } from "./infrastructure/mail/MailService.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createRequirePermission } from "./middleware/rbac.js";
import { createRateLimit } from "./middleware/rateLimit.js";
import { UserRepository } from "./modules/users/UserRepository.js";
import { UserService } from "./modules/users/UserService.js";
import { RouteService } from "./modules/routes/RouteService.js";
import { RouteRepository } from "./modules/routes/RouteRepository.js";
import { ShiftRepository } from "./modules/shifts/ShiftRepository.js";
import { ShiftService } from "./modules/shifts/ShiftService.js";
import { CapacityService } from "./modules/capacity/CapacityService.js";
import { SettingRepository } from "./modules/capacity/SettingRepository.js";
import { AssignmentRepository } from "./modules/assignments/AssignmentRepository.js";
import { AssignmentService } from "./modules/assignments/AssignmentService.js";
import { DeliveryService } from "./modules/delivery/DeliveryService.js";
import { IncidentRepository } from "./modules/incidents/IncidentRepository.js";
import { IncidentService } from "./modules/incidents/IncidentService.js";
import { SettlementRepository } from "./modules/settlements/SettlementRepository.js";
import { SettlementService } from "./modules/settlements/SettlementService.js";
import { StatsService } from "./modules/stats/StatsService.js";
import { Order as OrderModel, Assignment as AssignmentModel, Settlement as SettlementModel } from "./models/index.js";
import { WarehouseService } from "./modules/warehouse/WarehouseService.js";
import { CheckinPointRepository, CheckinLogRepository } from "./modules/checkins/CheckinRepositories.js";
import { CheckinPointService } from "./modules/checkins/CheckinPointService.js";
import { CheckinService } from "./modules/checkins/CheckinService.js";
import { ProfileService } from "./modules/profile/ProfileService.js";
import { HubRepository } from "./modules/hubs/HubRepository.js";
import { HubService } from "./modules/hubs/HubService.js";
import { PickupLocationRepository } from "./modules/pickupLocations/PickupLocationRepository.js";
import { PickupLocationService } from "./modules/pickupLocations/PickupLocationService.js";
import { PricingService } from "./modules/pricing/PricingService.js";
import { OrderDraftRepository } from "./modules/orderDrafts/OrderDraftRepository.js";
import { OrderDraftService } from "./modules/orderDrafts/OrderDraftService.js";
import { OrderRepository } from "./modules/orders/OrderRepository.js";
import { CounterRepository } from "./modules/orders/CounterRepository.js";
import { OrderService } from "./modules/orders/OrderService.js";
import { MongooseTransactionRunner } from "./infrastructure/db/MongooseTransactionRunner.js";
import { BullEventQueue, workerConnectionFromUrl } from "./infrastructure/queue/BullEventQueue.js";
import { JourneyService } from "./modules/orders/JourneyService.js";
import { ServiceAreaRepository } from "./modules/serviceAreas/ServiceAreaRepository.js";
import { ServiceAreaService } from "./modules/serviceAreas/ServiceAreaService.js";
import { ServiceTypeRepository } from "./modules/serviceTypes/ServiceTypeRepository.js";
import { ServiceTypeService } from "./modules/serviceTypes/ServiceTypeService.js";
import { PriceTableRepository } from "./modules/priceTables/PriceTableRepository.js";
import { PriceTableService } from "./modules/priceTables/PriceTableService.js";
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
  const routeRepository = new RouteRepository();
  const hubRepository = new HubRepository();
  const serviceAreaRepository = new ServiceAreaRepository();
  const serviceTypeRepository = new ServiceTypeRepository();
  const priceTableRepository = new PriceTableRepository();
  const roleRepository = new BaseRepository(Role);
  const orderRepository = new OrderRepository();
  const pickupLocationRepository = new PickupLocationRepository();
  const checkinPointRepository = new CheckinPointRepository();

  // ---- Service ----
  const permissionService = new PermissionService({ roleRepository, cache });
  // Dang nhap dung repository KHONG cache: vua bi khoa la phai chan ngay.
  const authService = new AuthService({ userRepository, passwordHasher, tokenService, loginThrottle, mailService });
  const services = {
    users: new UserService({
      repository: withCache(userRepository, "users"),
      passwordHasher,
      events,
      hubRepository,
      routeRepository,
      checkinPointRepository,
    }),
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
  const orderDraftRepository = new OrderDraftRepository();
  const orderDraftService = new OrderDraftService({ repository: orderDraftRepository });
  // US-21: hang doi su kien ben vung (BullMQ) - khac EventBus o tren (chi trong mot tien trinh)
  const orderEvents = new BullEventQueue({
    connection: redis,
    workerConnection: workerConnectionFromUrl(env.redisUrl),
    name: env.orderEvents.queueName,
    attempts: env.orderEvents.attempts,
    backoffMs: env.orderEvents.backoffMs,
  });
  // Hanh trinh cong khai kem cac moc check-in (US-30); checkinService tao ben duoi
  const journeyService = new JourneyService({ orderRepository, redis, checkinsOf: (orderId) => checkinService.forOrder(orderId) });
  // Consumer: moi loai su kien mot handler; handler goi lan luot cac consumer (dat ben duoi khi da tao
  // xong service). Moi consumer idempotent vi BullMQ co the chay lai job.
  const orderEventHandlers = {
    "order.status.changed": async (event) => {
      await journeyService.project(event);
      await assignmentService.onOrderStatusChanged(event);
      // Consumer thu ba (US-35, US-37): toi kho dich / cho giao lai -> phan cong giao; dang hoan -> phan cong hoan
      await deliveryService.onOrderStatusChanged(event);
    },
    "order.checkin.recorded": (event) => journeyService.project(event),
  };
  const orderService = new OrderService({
    orderRepository,
    counterRepository: new CounterRepository(),
    orderDraftRepository,
    pickupLocationRepository,
    serviceAreaRepository,
    routeRepository,
    hubRepository,
    userRepository,
    pricingService,
    transactions: new MongooseTransactionRunner(),
    orderEvents,
    passwordHasher,
  });
  // US-23: ca lam viec - doc tuyen / nguoi giao hang KHONG cache (rang buoc can so moi nhat)
  const shiftRepository = new ShiftRepository();
  const shiftService = new ShiftService({
    shiftRepository,
    routeRepository,
    userRepository,
    hubRepository,
  });
  const settingRepository = new SettingRepository();
  // US-24: nang luc 3 cap (nguoi giao hang -> tuyen -> mac dinh he thong)
  const capacityService = new CapacityService({
    settingRepository,
    routeRepository,
    userRepository,
    hubRepository,
    cache,
  });
  // US-25, US-27: phan cong lay hang (consumer thu hai cua order.status.changed) va don can lay cua tai xe
  const assignmentService = new AssignmentService({
    assignmentRepository: new AssignmentRepository(),
    shiftRepository,
    orderRepository,
    routeRepository,
    userRepository,
    hubRepository,
    pickupLocationRepository,
    serviceAreaRepository,
    serviceTypeRepository,
    capacityService,
    transactions: new MongooseTransactionRunner(),
    orderEvents,
  });
  // Sprint 6 (de 02): phan cong giao, giao hang, thu COD, giao lai, hoan hang
  const deliveryService = new DeliveryService({
    assignmentRepository: new AssignmentRepository(),
    shiftRepository,
    orderRepository,
    routeRepository,
    userRepository,
    hubRepository,
    pickupLocationRepository,
    serviceAreaRepository,
    serviceTypeRepository,
    settingRepository,
    capacityService,
    transactions: new MongooseTransactionRunner(),
    orderEvents,
  });
  // US-38 (de 02): su co, khieu nai - ma SC tang trong transaction
  const incidentRepository = new IncidentRepository();
  const incidentService = new IncidentService({
    incidentRepository,
    orderRepository,
    userRepository,
    hubRepository,
    counterRepository: new CounterRepository(),
    transactions: new MongooseTransactionRunner(),
    orderEvents,
  });
  // US-34, US-43 (de 02): doi soat dinh ky voi shop
  const settlementService = new SettlementService({
    settlementRepository: new SettlementRepository(),
    orderRepository,
    incidentRepository,
    userRepository,
    counterRepository: new CounterRepository(),
    transactions: new MongooseTransactionRunner(),
  });
  // US-39 (de 02): thong ke bang aggregation pipeline (doc thang model, khong qua cache)
  const statsService = new StatsService({
    orderModel: OrderModel,
    assignmentModel: AssignmentModel,
    settlementModel: SettlementModel,
    userRepository,
    hubRepository,
  });
  // US-29, US-30: diem check-in (danh muc admin) va check-in vi tri cua tai xe
  services.checkinPoints = new CheckinPointService({
    repository: withCache(checkinPointRepository, "checkinPoints"),
    hubRepository,
    events,
  });
  const checkinService = new CheckinService({
    checkinPointRepository,
    checkinLogRepository: new CheckinLogRepository(),
    orderRepository,
    userRepository,
    orderEvents,
  });
  // US-41: quy trinh tai kho (nhap kho, phan loai, xuat kho) - doc thang DB
  const warehouseService = new WarehouseService({
    orderRepository,
    userRepository,
    hubRepository,
    serviceAreaRepository,
    routeRepository,
    serviceTypeRepository,
    orderEvents,
  });
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
  // US-22: tra cuu cong khai toi da 20 lan/phut moi IP (dem tren Redis, dung chung moi tien trinh)
  const trackingRateLimit = createRateLimit({ limiter: new RateLimiter(redis), name: "tracking", ...env.trackingRateLimit });

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
    orderService,
    shiftService,
    capacityService,
    assignmentService,
    deliveryService,
    incidentService,
    settlementService,
    statsService,
    warehouseService,
    checkinService,
    profileService: new ProfileService({ userRepository, cache }),
    orderEvents,
    journeyService,
    orderEventHandlers,
    /** Chay consumer hang doi su kien don (server.js goi; test US-21 tu chay worker rieng). */
    startOrderEventWorker: () => orderEvents.startWorker(orderEventHandlers),
    services,
    middleware: { requireAuth, guardAuthenticated, optionalAuth, requirePermission, trackingRateLimit },
  };
}

// Singleton: ca tien trinh dung chung mot container (mot ket noi Redis, mot EventBus).
let defaultContainer;
export function getContainer() {
  if (!defaultContainer) defaultContainer = buildContainer();
  return defaultContainer;
}
