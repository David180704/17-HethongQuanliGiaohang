// Unit test tim kiem tieng Viet khong dau (ham thuan, khong can CSDL).
import { test } from "node:test";
import assert from "node:assert/strict";
import { toSearchRegex } from "../src/core/textSearch.js";

const matches = (search, text) => new RegExp(toSearchRegex(search), "i").test(text);

test("[PB-01] Go khong dau khop ten co dau: hoan kiem, ha noi, dong da", () => {
  assert.ok(matches("hoan kiem", "Hoàn Kiếm"));
  assert.ok(matches("ha noi", "Hà Nội"));
  assert.ok(matches("dong da", "Đống Đa"));
  assert.ok(matches("HAI BA TRUNG", "Hai Bà Trưng"));
  assert.ok(matches("thanh khe", "Thanh Khê"));
});

test("[PB-01] Chu da go co dau thi giu nguyen, tim chinh xac", () => {
  assert.ok(matches("Hoàn", "Hoàn Kiếm"));
  assert.ok(!matches("Hoàn", "Hoan Kiem"), "go 'Hoàn' khong khop 'Hoan'");
  assert.ok(matches("Hoàn kiem", "Hoàn Kiếm"), "tron co dau va khong dau");
});

test("[PB-01] Ky tu dac biet van duoc escape (khong regex injection)", () => {
  assert.ok(!matches("(((", "Hoàn Kiếm"));
  assert.ok(matches("Q.1", "Q.1 Sài Gòn"));
  assert.ok(!matches("Q.1", "Q11"), "dau cham la ky tu thuong, khong phai 'bat ky'");
  assert.doesNotThrow(() => new RegExp(toSearchRegex("(a+)+$[")));
});
