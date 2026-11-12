// Cong thuc doi soat voi shop (US-34, de 02) - ham thuan, khong DB.
//
//   moi don trong ky (DELIVERED hoac RETURNED):
//     codCollected = tien thu ho da thu (don giao thanh cong, co thu ho, shipper da thu)
//     feeDeducted  = phi Express tru vao tien tra shop:
//                      DEDUCT_FROM_COD           -> toan bo phi
//                      SHOP_PREPAID chua tra phi -> toan bo phi (shop no phi)
//                      RECIPIENT_PAID da giao    -> 0 (nguoi nhan da tra cung luc nhan hang)
//                      RETURNED                  -> toan bo phi neu chua tra (shop chiu phi khi hang hoan)
//   ky: netPayable = tong codCollected - tong feeDeducted + tong dieu chinh (boi thuong +, chi phi phat sinh -)
//   netPayable < 0: shop con no Express.

export const SETTLEABLE_STATUS = ["DELIVERED", "RETURNED"];

/** Thoi diem don ket thuc (moc DELIVERED / RETURNED cuoi cung trong hanh trinh). */
export function finishedAt(order) {
  const history = order.statusHistory || [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (SETTLEABLE_STATUS.includes(history[i].status)) return new Date(history[i].at);
  }
  return null;
}

export function orderLine(order) {
  const fee = Number(order.fee?.total) || 0;
  const cod = order.cod || {};
  const delivered = order.status === "DELIVERED";
  const codCollected = delivered && cod.enabled && cod.collected ? Number(cod.amount) || 0 : 0;
  let feeDeducted = 0;
  if (!cod.feePaid) {
    if (!delivered) feeDeducted = fee; // hang hoan: shop chiu phi
    else if (cod.feePayer === "DEDUCT_FROM_COD" || cod.feePayer === "SHOP_PREPAID") feeDeducted = fee;
  }
  return {
    orderId: order._id,
    trackingCode: order.trackingCode,
    status: order.status,
    finishedAt: finishedAt(order),
    feePayer: cod.feePayer || null,
    codCollected,
    feeTotal: fee,
    feeDeducted,
  };
}

export function totals(lines, adjustments = []) {
  const cod = lines.reduce((sum, l) => sum + l.codCollected, 0);
  const feeDeducted = lines.reduce((sum, l) => sum + l.feeDeducted, 0);
  const adjust = adjustments.reduce((sum, a) => sum + a.amount, 0);
  return { orders: lines.length, cod, feeDeducted, adjustments: adjust, netPayable: cod - feeDeducted + adjust };
}
