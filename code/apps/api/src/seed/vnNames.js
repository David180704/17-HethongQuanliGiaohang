import { faker } from "@faker-js/faker";

const HO = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Huynh", "Vu", "Vo", "Dang", "Bui", "Do", "Ngo", "Duong"];
const TEN_DEM = ["Van", "Thi", "Minh", "Quoc", "Thanh", "Huu", "Ngoc", "Gia", "Xuan"];
const TEN = ["An", "Binh", "Chau", "Dung", "Giang", "Ha", "Khanh", "Lan", "Linh", "Long", "Mai", "Nam", "Phuong", "Quyen", "Son", "Tam", "Thao", "Trang", "Tuan", "Yen"];

export function randomVnName() {
  return `${faker.helpers.arrayElement(HO)} ${faker.helpers.arrayElement(TEN_DEM)} ${faker.helpers.arrayElement(TEN)}`;
}

export function randomVnPhone() {
  const prefixes = ["090", "091", "093", "094", "096", "097", "098", "032", "033", "035", "070", "079"];
  const prefix = faker.helpers.arrayElement(prefixes);
  const rest = faker.string.numeric(7);
  return prefix + rest;
}
