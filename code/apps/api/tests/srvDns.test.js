// Unit test chuyen DNS khi DNS cua may tu choi truy van SRV (chuoi mongodb+srv:// cua Atlas).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureSrvDns, FALLBACK_DNS_SERVERS } from "../src/config/db.js";

function fakeDns(errorCode) {
  const calls = { srv: [], setServers: [] };
  return {
    calls,
    setServers: (servers) => calls.setServers.push(servers),
    promises: {
      resolveSrv: async (name) => {
        calls.srv.push(name);
        if (errorCode) throw Object.assign(new Error(errorCode), { code: errorCode });
        return [{ name: "x", port: 27017 }];
      },
    },
  };
}

test("[US-02] DNS may tu choi truy van SRV -> chuyen sang DNS cong cong", async () => {
  const dns = fakeDns("ECONNREFUSED");
  assert.equal(await ensureSrvDns("mongodb+srv://u:p@edms.abc.mongodb.net/edms", dns), true);
  assert.deepEqual(dns.calls.srv, ["_mongodb._tcp.edms.abc.mongodb.net"]);
  assert.deepEqual(dns.calls.setServers, [FALLBACK_DNS_SERVERS]);
});

test("[US-02] SRV tra loi binh thuong, cluster khong ton tai, hoac CSDL local: giu DNS cua may", async () => {
  for (const [uri, code] of [
    ["mongodb+srv://u:p@edms.abc.mongodb.net/edms", null],
    ["mongodb+srv://u:p@sai-ten.mongodb.net/edms", "ENOTFOUND"],
    ["mongodb://localhost:27017/edms?directConnection=true", "ECONNREFUSED"],
  ]) {
    const dns = fakeDns(code);
    assert.equal(await ensureSrvDns(uri, dns), false, uri);
    assert.deepEqual(dns.calls.setServers, [], uri);
  }
});
