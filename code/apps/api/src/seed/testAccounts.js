// Tai khoan test de nho cho moi truong DEV/TEST - sua o day la doi tai khoan seed.
// Mat khau chung 123456: CHI dung cho du lieu thu nghiem. Khong dua bo tai khoan
// nay len he thong that (mat khau yeu, ai doc file nay cung biet).
//
// Dang nhap bang email HOAC so dien thoai deu duoc.
//   admin@edms.vn            0900000000   Quan tri
//   kho1..kho3@edms.vn       090000001x   Nhan vien kho (Hub HN, Hub HCM, Buu cuc DN)
//   taixe1..taixe5@edms.vn   090000002x   Tai xe (moi nguoi 1 tuyen)
//   khach1..khach6@edms.vn   090000003x   Khach ca nhan
//   shop1..shop4@edms.vn     090000004x   Khach doanh nghiep (shop4 dang CHO DUYET)
export const TEST_PASSWORD = "123456";

export function buildTestAccounts({ hubDocs, routeDocs }) {
  const admin = {
    email: "admin@edms.vn",
    phone: "0900000000",
    fullName: "Admin EDMS",
    role: "ADMIN",
  };

  const hubStaff = hubDocs.map((hub, i) => ({
    email: `kho${i + 1}@edms.vn`,
    phone: `090000001${i + 1}`,
    fullName: `Nhân Viên Kho ${i + 1}`,
    role: "HUB_STAFF",
    hubId: hub._id,
  }));

  const shippers = Array.from({ length: 5 }, (_, i) => ({
    email: `taixe${i + 1}@edms.vn`,
    phone: `090000002${i + 1}`,
    fullName: `Tài Xế ${i + 1}`,
    role: "SHIPPER",
    routeIds: [routeDocs[i % routeDocs.length]._id],
  }));

  const individuals = Array.from({ length: 6 }, (_, i) => ({
    email: `khach${i + 1}@edms.vn`,
    phone: `090000003${i + 1}`,
    fullName: `Khách Hàng ${i + 1}`,
    role: "CUSTOMER",
    customerType: "INDIVIDUAL",
  }));

  const shops = Array.from({ length: 4 }, (_, i) => ({
    email: `shop${i + 1}@edms.vn`,
    phone: `090000004${i + 1}`,
    fullName: `Chủ Shop ${i + 1}`,
    role: "CUSTOMER",
    customerType: "BUSINESS",
    shopName: `Shop ${i + 1}`,
    taxCode: `010000000${i + 1}`,
    // Shop cuoi de demo luong duyet tai khoan doanh nghiep (#7)
    status: i === 3 ? "PENDING" : "ACTIVE",
  }));

  return { admin, hubStaff, shippers, customers: [...individuals, ...shops] };
}
