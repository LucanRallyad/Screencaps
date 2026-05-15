import "dotenv/config";
import { syncAdDomains } from "../src/lib/ad-domains/sync";
import { pool } from "../src/lib/db/client";

async function main() {
  const result = await syncAdDomains();
  if (result.skipped) {
    console.log("Ad domain list is up to date — nothing to do.");
  } else {
    console.log(`Synced ${result.inserted} domains.`);
  }
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
