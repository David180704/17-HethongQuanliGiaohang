import { URL } from "node:url";
import { Queue, Worker } from "bullmq";

// Adapter hang doi su kien tren BullMQ (Redis) - US-21. Service chi goi publish(type, payload); muon doi
// sang hang doi khac chi sua lop nay va container.js.
//   - Moi job thu lai toi da `attempts` lan, gian cach tang dan (exponential backoff tu `backoffMs`)
//   - Het luot thu ma van loi -> chep sang dead-letter queue `<name>-dlq` kem ly do de nguoi van hanh xem
//   - Queue dung chung ket noi Redis cua ung dung (dong cung ung dung); Worker can ket noi rieng
//     (lenh cho chan BRPOPLPUSH, BullMQ bat buoc maxRetriesPerRequest = null) nen nhan cau hinh ket noi.
export class BullEventQueue {
  #queue;
  #deadLetter;

  /**
   * @param {object} options
   * @param {import("ioredis").Redis} options.connection ket noi dung chung (de ghi job)
   * @param {object} options.workerConnection cau hinh ket noi cho Worker ({ host, port, ... })
   * @param {string} options.name ten hang doi
   */
  constructor({ connection, workerConnection, name, attempts = 5, backoffMs = 2000 }) {
    Object.assign(this, { connection, workerConnection, name, attempts, backoffMs });
    this.deadLetterName = `${name}-dlq`;
  }

  get queue() {
    this.#queue ??= new Queue(this.name, { connection: this.connection });
    return this.#queue;
  }

  get deadLetter() {
    this.#deadLetter ??= new Queue(this.deadLetterName, { connection: this.connection });
    return this.#deadLetter;
  }

  publish(type, payload) {
    return this.queue.add(type, payload, {
      attempts: this.attempts,
      backoff: { type: "exponential", delay: this.backoffMs },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
  }

  /**
   * Chay consumer: handlers = { [ten su kien]: async (payload) => {} }. Job khong co handler -> bo qua.
   * @returns {Worker}
   */
  startWorker(handlers) {
    const worker = new Worker(
      this.name,
      async (job) => {
        const handler = handlers[job.name];
        if (handler) await handler(job.data);
      },
      { connection: this.workerConnection },
    );
    worker.on("failed", async (job, err) => {
      if (!job || job.attemptsMade < (job.opts.attempts || 1)) return;
      await this.deadLetter.add(job.name, {
        event: job.data,
        error: err?.message || String(err),
        attempts: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
    });
    return worker;
  }

  async close() {
    await this.#queue?.close();
    await this.#deadLetter?.close();
  }
}

/** "redis://user:pass@host:6379/0" -> tuy chon ket noi ioredis cho Worker. */
export function workerConnectionFromUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname && u.pathname !== "/" ? Number(u.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
  };
}
