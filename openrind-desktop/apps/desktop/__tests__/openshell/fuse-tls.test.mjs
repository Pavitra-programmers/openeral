import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";

const setupSource = readFileSync(
  new URL("../../../../../sandboxes/openeral/setup-fuse.sh", import.meta.url),
  "utf8",
);
const pgClientSource = readFileSync(
  new URL("../../../../../sandboxes/openeral/pg-client-fuse.mjs", import.meta.url),
  "utf8",
);
const poolSource = readFileSync(
  new URL("../../../../../openeral-js/src/db/pool.ts", import.meta.url),
  "utf8",
);
const fusedConnectorSource = readFileSync(
  new URL("../../../../../crates/openeral-fused/src/connect.rs", import.meta.url),
  "utf8",
);
const supabaseRoot = readFileSync(
  new URL("../../../../../sandboxes/openeral/supabase-root-2021-ca.pem", import.meta.url),
  "utf8",
);

test("FUSE PostgreSQL TLS retains public roots while adding OpenShell's CA", () => {
  assert.match(setupSource, /NODE_EXTRA_CA_CERTS/);
  assert.match(setupSource, /SSL_CERT_FILE/);
  assert.doesNotMatch(setupSource, /--use-openssl-ca/);
  assert.match(setupSource, /export NODE_EXTRA_CA_CERTS=/);
  assert.doesNotMatch(pgClientSource, /--use-openssl-ca/);
});
test("FUSE PostgreSQL TLS pins Supabase's root and ignores URL TLS overrides", () => {
  assert.equal(
    new X509Certificate(supabaseRoot).fingerprint256,
    "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA",
  );
  assert.match(poolSource, /CONNECTION_STRING_TLS_OPTIONS/);
  assert.match(poolSource, /parsedConnectionString\.searchParams\.delete\(option\)/);
  assert.match(poolSource, /ca: readFileSync\(SUPABASE_ROOT_2021_CA_PATH, 'utf8'\)/);
  assert.match(poolSource, /rejectUnauthorized: true/);
  assert.match(fusedConnectorSource, /fn tls_connector\(host: &str\)/);
  assert.match(fusedConnectorSource, /CertificateDer::pem_slice_iter/);
});