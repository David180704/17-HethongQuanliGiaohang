import { faker } from "@faker-js/faker";

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Ngô", "Dương"];
const TEN_DEM = ["Văn", "Thị", "Minh", "Quốc", "Thanh", "Hữu", "Ngọc", "Gia", "Xuân"];
const TEN = ["An", "Bình", "Châu", "Dũng", "Giang", "Hà", "Khánh", "Lan", "Linh", "Long", "Mai", "Nam", "Phương", "Quyên", "Sơn", "Tâm", "Thảo", "Trang", "Tuấn", "Yến"];

export function randomVnName() {
  return `${faker.helpers.arrayElement(HO)} ${faker.helpers.arrayElement(TEN_DEM)} ${faker.helpers.arrayElement(TEN)}`;
}

export function randomVnPhone() {
  const prefixes = ["090", "091", "093", "094", "096", "097", "098", "032", "033", "035", "070", "079"];
  const prefix = faker.helpers.arrayElement(prefixes);
  const rest = faker.string.numeric(7);
  return prefix + rest;
}
