/* global fetch */
// US-46: ban chay thu cong khai (code/chay-cong-khai.ps1 + Cloudflare Quick Tunnel). Proxy phuc vu trang web tinh va
// chuyen /api/... sang API cung mot dia chi (khong can sua CORS); khong cho doc file ngoai thu muc build.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const PROXY = fileURLToPath(new URL("../../../scripts/public-demo/proxy.mjs", import.meta.url));
const PROXY_PORT = 18090;
const API_PORT = 18091;
let api;
let proxy;
let dir;

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "edms-public-"));
  await fs.writeFile(path.join(dir, "index.html"), "<div id=root>EDMS</div>");
  await fs.mkdir(path.join(dir, "assets"));
  await fs.writeFile(path.join(dir, "assets", "app-1a2b3c4d.js"), "console.log(1)");
  await fs.writeFile(path.join(os.tmpdir(), "edms-bi-mat.txt"), "khong duoc lo");
  // API gia: tra lai phuong thuc, duong dan, than yeu cau va IP chuyen tiep
  api = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(201, { "content-type": "application/json" });
      res.end(JSON.stringify({ method: req.method, url: req.url, body, xff: req.headers["x-forwarded-for"] }));
    });
  });
  await new Promise((r) => api.listen(API_PORT, r));
  proxy = spawn(process.execPath, [PROXY, "--port", String(PROXY_PORT), "--static", dir, "--api", `http://localhost:${API_PORT}`]);
  await new Promise((resolve, reject) => {
    proxy.stdout.on("data", (d) => String(d).includes("proxy") && resolve());
    proxy.on("exit", (code) => reject(new Error(`proxy thoat ${code}`)));
  });
});

after(async () => {
  proxy?.kill();
  await new Promise((r) => api.close(r));
  await fs.rm(dir, { recursive: true, force: true });
  await fs.rm(path.join(os.tmpdir(), "edms-bi-mat.txt"), { force: true });
});

const base = `http://localhost:${PROXY_PORT}`;

test("[US-46] ban cong khai: proxy tra trang web (ca duong dan cua ung dung mot trang) va chuyen /api sang API", async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /EDMS/);
  const deep = await fetch(`${base}/tao-don?buoc=2`);
  assert.match(await deep.text(), /EDMS/, "duong dan cua React Router tra ve index.html");
  const asset = await fetch(`${base}/assets/app-1a2b3c4d.js`);
  assert.match(asset.headers.get("content-type"), /javascript/);
  assert.match(asset.headers.get("cache-control"), /immutable/, "file co ma bam duoc luu dem lau");

  const res = await fetch(`${base}/api/auth/login?app=STAFF`, { method: "POST", body: JSON.stringify({ a: "Tiếng Việt" }) });
  assert.equal(res.status, 201);
  const echoed = await res.json();
  assert.equal(echoed.method, "POST");
  assert.equal(echoed.url, "/auth/login?app=STAFF", "bo tien to /api");
  assert.equal(JSON.parse(echoed.body).a, "Tiếng Việt");
  assert.ok(echoed.xff, "gui kem IP nguoi dung (X-Forwarded-For)");
});

test("[US-46] ban cong khai: khong doc duoc file ngoai thu muc build; API tat thi bao 502 ro rang; script khong co ky tu ngoai ASCII", async () => {
  const sneaky = await new Promise((resolve) => {
    http.get({ host: "localhost", port: PROXY_PORT, path: "/../edms-bi-mat.txt" }, (r) => {
      let t = "";
      r.on("data", (c) => (t += c));
      r.on("end", () => resolve({ status: r.statusCode, text: t }));
    });
  });
  assert.doesNotMatch(sneaky.text, /khong duoc lo/);

  await new Promise((r) => api.close(r));
  const down = await fetch(`${base}/api/health`);
  assert.equal(down.status, 502);
  assert.equal((await down.json()).error.code, "API_DOWN");
  api = http.createServer().listen(API_PORT); // de after() dong duoc

  const ps1 = readFileSync(fileURLToPath(new URL("../../../chay-cong-khai.ps1", import.meta.url)));
  assert.ok(ps1.every((b) => b < 128), "PowerShell 5.1 doc .ps1 theo ANSI: chi dung ASCII");
  assert.match(ps1.toString(), /trycloudflare\.com/);
  assert.match(ps1.toString(), /-Stop/);
});
