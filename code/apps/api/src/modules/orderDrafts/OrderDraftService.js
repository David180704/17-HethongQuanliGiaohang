import { randomBytes } from "node:crypto";
import { ErrorCodes } from "../../core/errors.js";
import { parseDraftPayload } from "./orderDrafts.validator.js";

// draftToken ngau nhien 144 bit: ai giu token moi doc duoc nhap (khong doan duoc)
const defaultTokenFactory = () => randomBytes(18).toString("base64url");

/**
 * Ban nhap don hang (US-16): khach vang lai uoc tinh phi -> "Gui hang" -> luu nhap,
 * nhan draftToken -> dang ky / dang nhap -> mo lai nhap, du lieu con nguyen.
 *   - Nhap song 24 gio (TTL index tren createdAt).
 *   - Khach da dang nhap mo nhap chua co chu -> nhap thuoc ve khach do; tu do chi
 *     chinh khach do doc / sua duoc (nguoi khac co token cung khong mo duoc).
 *   - Tao don tu nhap thi xoa nhap trong cung transaction (OrderService, US-18).
 */
export class OrderDraftService {
  /**
   * @param {object} deps
   * @param {import("./OrderDraftRepository.js").OrderDraftRepository} deps.repository
   * @param {() => string} [deps.tokenFactory]
   */
  constructor({ repository, tokenFactory = defaultTokenFactory }) {
    this.repository = repository;
    this.tokenFactory = tokenFactory;
  }

  async create(payload, user) {
    const draft = await this.repository.create({
      draftToken: this.tokenFactory(),
      payload: parseDraftPayload(payload),
      customerId: customerIdOf(user),
    });
    return this.#view(draft);
  }

  async get(token, user) {
    const draft = await this.#accessible(token, user);
    return this.#view(await this.#claim(draft, user));
  }

  async update(token, payload, user) {
    const draft = await this.#accessible(token, user);
    const data = { payload: parseDraftPayload(payload) };
    const owner = customerIdOf(user);
    if (!draft.customerId && owner) data.customerId = owner;
    return this.#view(await this.repository.updateById(draft._id, data));
  }

  // Nhap da co chu thi chi chu doc duoc; tra 404 (khong lo la nhap co ton tai)
  async #accessible(token, user) {
    const draft = typeof token === "string" ? await this.repository.findLive(token) : null;
    const owner = draft?.customerId ? String(draft.customerId) : null;
    if (!draft || (owner && owner !== customerIdOf(user))) {
      throw ErrorCodes.NOT_FOUND("Bản nháp không tồn tại hoặc đã hết hạn (24 giờ)");
    }
    return draft;
  }

  async #claim(draft, user) {
    const owner = customerIdOf(user);
    if (draft.customerId || !owner) return draft;
    return this.repository.updateById(draft._id, { customerId: owner });
  }

  #view(draft) {
    return {
      draftToken: draft.draftToken,
      payload: draft.payload,
      claimed: Boolean(draft.customerId),
      expiresAt: this.repository.expiresAt(draft),
    };
  }
}

// Chi tai khoan khach hang moi so huu nhap don (nhan vien thu API thi coi nhu khach vang lai)
function customerIdOf(user) {
  return user?.role === "CUSTOMER" ? String(user.id) : null;
}
