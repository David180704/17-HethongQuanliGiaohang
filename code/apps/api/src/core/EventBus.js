// Observer pattern: noi phat su kien (service) khong biet ai dang nghe; noi nghe
// (vd xoa cache) tu dang ky. Them hanh vi moi khi danh muc thay doi = them mot
// subscriber, khong phai sua service (Open/Closed).
export class EventBus {
  #handlers = new Map();

  on(eventName, handler) {
    if (!this.#handlers.has(eventName)) this.#handlers.set(eventName, new Set());
    this.#handlers.get(eventName).add(handler);
    return () => this.#handlers.get(eventName)?.delete(handler);
  }

  // Subscriber loi khong duoc lam hong thao tac ghi da thanh cong truoc do.
  async emit(eventName, payload) {
    const handlers = [...(this.#handlers.get(eventName) || [])];
    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`[EventBus] subscriber cua "${eventName}" loi: ${err.message}`);
      }
    }
  }
}
