// Chup tung so do SVG trong mot trang HTML thanh PNG (dung Playwright cua code/apps/web).
//   node docs/uml/render_svg.mjs <trang.html> <thu-muc-png>
// Moi so do nam trong <div class="fig" data-name="ten-file">...</div>.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webPackage = fileURLToPath(new URL("../../code/apps/web/package.json", import.meta.url));
const { chromium } = createRequire(webPackage)("@playwright/test");
const [htmlPath, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(htmlPath).href);
const figures = await page.locator(".fig").all();
for (const fig of figures) {
  const name = await fig.getAttribute("data-name");
  await fig.screenshot({ path: join(outDir, `${name}.png`) });
}
await browser.close();
console.log(`Da chup ${figures.length} so do vao ${outDir}`);
