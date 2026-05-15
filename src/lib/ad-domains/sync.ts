import { db } from "@/lib/db/client";
import { adDomains, appSettings } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

const BLOCKLIST_URL = "https://raw.githubusercontent.com/blocklistproject/Lists/master/ads.txt";
const REFRESH_DAYS = 90;
const SETTING_KEY = "ad_domains_last_sync";

export async function syncAdDomains(): Promise<{ inserted: number; skipped: boolean }> {
  // Check when we last synced
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(sql`${appSettings.key} = ${SETTING_KEY}`)
    .limit(1);

  if (setting) {
    const lastSync = new Date(setting.value);
    const daysSince = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < REFRESH_DAYS) {
      console.log(`[ad-domains] last sync ${Math.floor(daysSince)}d ago — skipping`);
      return { inserted: 0, skipped: true };
    }
  }

  console.log("[ad-domains] fetching blocklist from blocklistproject/Lists...");
  const res = await fetch(BLOCKLIST_URL);
  if (!res.ok) throw new Error(`Failed to fetch blocklist: ${res.status}`);

  const text = await res.text();
  const domains: string[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Format: "0.0.0.0 domain.com" or just "domain.com"
    const parts = trimmed.split(/\s+/);
    const domain = parts.length >= 2 ? parts[1] : parts[0];
    if (domain && domain !== "0.0.0.0" && domain.includes(".")) {
      domains.push(domain.toLowerCase());
    }
  }

  console.log(`[ad-domains] parsed ${domains.length} domains — inserting...`);

  // Batch insert in chunks of 1000 to avoid query size limits
  let inserted = 0;
  const CHUNK = 1000;
  for (let i = 0; i < domains.length; i += CHUNK) {
    const chunk = domains.slice(i, i + CHUNK).map((domain) => ({ domain, source: "github" as const }));
    await db
      .insert(adDomains)
      .values(chunk)
      .onConflictDoNothing();
    inserted += chunk.length;
  }

  // Record sync timestamp
  await db
    .insert(appSettings)
    .values({ key: SETTING_KEY, value: new Date().toISOString() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: new Date().toISOString(), updatedAt: new Date() } });

  console.log(`[ad-domains] sync complete — ${inserted} domains upserted`);
  return { inserted, skipped: false };
}

// Load all ad domains into a Set for fast in-memory lookup
let _domainSet: Set<string> | null = null;

export async function loadAdDomainSet(): Promise<Set<string>> {
  if (_domainSet) return _domainSet;
  const rows = await db.select({ domain: adDomains.domain }).from(adDomains);
  _domainSet = new Set(rows.map((r) => r.domain));
  console.log(`[ad-domains] loaded ${_domainSet.size} domains into memory`);
  return _domainSet;
}

export function invalidateDomainCache() {
  _domainSet = null;
}
