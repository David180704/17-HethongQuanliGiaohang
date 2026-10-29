import bcrypt from "bcrypt";

// Adapter cho bcrypt (cost 10 theo CLAUDE.md). Service chi phu thuoc giao dien
// hash/compare (Dependency Inversion) -> doi sang argon2 chi can adapter khac.
export class BcryptPasswordHasher {
  constructor(cost = 10) {
    this.cost = cost;
  }

  hash(plain) {
    return bcrypt.hash(plain, this.cost);
  }

  compare(plain, hash) {
    return bcrypt.compare(plain, hash);
  }
}
