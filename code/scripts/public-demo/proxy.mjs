// Proxy nho cho ban chay thu cong khai (Cloudflare Quick Tunnel): mot dia chi phuc vu ca trang web (ban build tinh)
// va API (duong dan /api/... chuyen tiep sang API dang chay o may nay). Cung mot nguon (origin) nen khong can sua CORS.
//   node proxy.mjs --port 8090 --static <thu muc build> [--api http://localhost:4044]
// Khong dung thu vien ngoai (chi node:http, node:fs).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const PORT = Number(arg("--port", "8090"));
const STATIC_DIR = path.resolve(arg("--static", "."));
const API = new URL(arg("--api", "http://localhost:4044"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function forwardToApi(req, res) {
  const target = req.url.replace(/^\/api(?=\/|$|\?)/, "") || "/";
  const headers = { ...req.headers, host: API.host };
  headers["x-forwarded-for"] = req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "";
  headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || "https";
  const upstream = http.request(
    { hostname: API.hostname, port: API.port, path: target, method: req.method, headers },
    (apiRes) => {
      res.writeHead(apiRes.statusCode || 502, apiRes.headers);
      apiRes.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { code: "API_DOWN", message: "API trên máy chủ demo chưa chạy" } }));
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(STATIC_DIR, pathname));
  if (!file.startsWith(STATIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  // Ung dung mot trang (SPA): duong dan khong phai file -> tra index.html; Expo web xuat them <trang>.html
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const html = `${file.replace(/[\\/]$/, "")}.html`;
    file = fs.existsSync(html) ? html : path.join(STATIC_DIR, "index.html");
  }
  const ext = path.extname(file).toLowerCase();
  const immutable = /[.-][0-9a-f]{8,}\./i.test(path.basename(file));
  res.writeHead(200, {
    "content-type": TYPES[ext] || "application/octet-stream",
    "cache-control": ext === ".html" ? "no-cache" : immutable ? "public, max-age=31536000, immutable" : "public, max-age=300",
  });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => (req.url.startsWith("/api/") || req.url === "/api" ? forwardToApi(req, res) : serveStatic(req, res)))
  .listen(PORT, () => console.log(`proxy ${PORT}: web ${STATIC_DIR} + /api -> ${API.origin}`));
