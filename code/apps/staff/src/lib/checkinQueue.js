import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "./apiClient";

// Hang doi check-in khi mat mang (US-30): moi su kien mang thoi diem goc (at) va ma su kien (clientEventId).
// Gui that bai vi MAT MANG (khong co phan hoi) -> luu AsyncStorage, gui lai sau (tu dong hoac bam "Gui lai");
// server bo qua su kien da ghi (cung clientEventId) nen gui lai bao nhieu lan cung khong trung.
// Server tu choi (4xx: qua 24 gio, sai toa do...) -> bo su kien, khong gui lai mai.
const KEY = "edms.checkinQueue";
let queue = [];
let loaded = false;
let flushing = null;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener(queue.length));
const isOffline = (err) => !err?.response;

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    queue = JSON.parse((await AsyncStorage.getItem(KEY)) || "[]");
  } catch {
    queue = [];
  }
  notify();
}

async function save() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // bo qua: hang doi van con trong bo nho phien nay
  }
  notify();
}

export const newEventId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function onPendingChange(listener) {
  listeners.add(listener);
  load().then(() => listener(queue.length));
  return () => listeners.delete(listener);
}

export async function pendingCount() {
  await load();
  return queue.length;
}

/**
 * Gui mot check-in. Tra { ok, data } khi server nhan; { queued: true } khi mat mang (da xep hang doi);
 * { ok: false, error } khi server tu choi.
 */
export async function sendCheckin({ lat, lng, pointId }) {
  await load();
  const event = { lat, lng, at: new Date().toISOString(), clientEventId: newEventId(), ...(pointId && { pointId }) };
  try {
    const res = await apiClient.post("/checkins", event);
    flushQueue(); // co mang lai -> gui luon cac su kien dang cho
    return { ok: true, data: res.data.data };
  } catch (err) {
    if (isOffline(err)) {
      queue.push(event);
      await save();
      return { ok: false, queued: true };
    }
    return { ok: false, error: err };
  }
}

/** Gui lai cac su kien dang cho theo thu tu; dung lai khi van mat mang. Tra so su kien da gui. */
export function flushQueue() {
  if (flushing) return flushing;
  flushing = (async () => {
    await load();
    let sent = 0;
    while (queue.length) {
      try {
        await apiClient.post("/checkins", queue[0]);
        sent += 1;
      } catch (err) {
        if (isOffline(err)) break;
        // server tu choi -> bo su kien nay
      }
      queue.shift();
      await save();
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
