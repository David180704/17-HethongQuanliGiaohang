// Uu tien gui nhanh (yeu cau 12/11/2026): don dich vu EXPRESS (phu phi 50%) di truoc o moi hang doi - hang cho phan
// cong, hang sap toi va ton kho cua kho - "container hang gui nhanh di truoc". Ham thuan, on dinh (giu thu tu cu).

/** Danh sach id dich vu gui nhanh -> ham kiem tra mot don. */
export function expressChecker(expressServiceTypeIds = []) {
  const ids = new Set(expressServiceTypeIds.map(String));
  return (order) => ids.has(String(order.serviceTypeId));
}

/** Sap xep on dinh: don gui nhanh len dau, con lai giu nguyen thu tu. */
export function expressFirst(orders, isExpress) {
  return orders
    .map((order, index) => ({ order, index, express: isExpress(order) }))
    .sort((a, b) => Number(b.express) - Number(a.express) || a.index - b.index)
    .map(({ order }) => order);
}
