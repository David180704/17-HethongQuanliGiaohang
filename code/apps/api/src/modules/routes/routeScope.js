/**
 * Pham vi tuyen cua nguoi dung (US-23, US-24, US-25): nhan vien kho quan ly cac tuyen cua hub minh va
 * buu cuc truc thuoc; quan tri vien quan ly moi tuyen (tra null). Doc qua repository KHONG cache.
 * @returns {Promise<string[] | null>}
 */
export async function routeScopeFor(user, { userRepository, hubRepository, routeRepository }) {
  if (user.role === "ADMIN") return null;
  const staff = await userRepository.findById(user.id);
  if (!staff?.hubId) return [];
  const hubIds = await hubRepository.findFamilyIds(staff.hubId);
  const routes = await routeRepository.findByHubs(hubIds);
  return routes.map((r) => String(r._id));
}
