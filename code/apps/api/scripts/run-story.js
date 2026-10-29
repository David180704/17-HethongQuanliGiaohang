// Ten file KHONG duoc bat dau bang "test-": node --test tu coi file "test-*.js" la file test.
// Chay test cua MOT story:  npm run test:story -- 6     (6, 06, US-06, us-6 deu duoc)
// Nhieu story:              npm run test:story -- 6 7 8
// Nhan khac:                npm run test:story -- CACHE   |   PB-01
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("Cach dung: npm run test:story -- <so story>   vd: npm run test:story -- 6");
  process.exit(1);
}

function toTag(raw) {
  const text = raw.trim().toUpperCase();
  const number = text.match(/^(?:US-?)?(\d{1,2})$/);
  if (number) return `US-${number[1].padStart(2, "0")}`;
  return text;
}

const tags = args.map(toTag);
const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const testsDir = path.join(apiRoot, "tests");

// Chi chay file CO test mang nhan can tim. File khong co test nao khop van chay
// hook before() (mo ket noi DB/Redis) nhung bo qua after() -> tien trinh treo.
const files = readdirSync(testsDir)
  .filter((name) => name.endsWith(".test.js"))
  .filter((name) => {
    const source = readFileSync(path.join(testsDir, name), "utf8");
    return tags.some((tag) => source.includes(`[${tag}]`) || source.includes(`"${tag}"`));
  })
  .map((name) => path.join("tests", name));

if (files.length === 0) {
  console.log(`Khong co test nao mang nhan ${tags.join(", ")}.`);
  process.exit(1);
}

console.log(`Chay test cua: ${tags.join(", ")}  (file: ${files.map((f) => path.basename(f)).join(", ")})\n`);
const result = spawnSync(process.execPath, ["--test", "--test-name-pattern", `\\[(${tags.join("|")})\\]`, ...files], {
  stdio: "inherit",
  cwd: apiRoot,
});
process.exit(result.status ?? 1);
