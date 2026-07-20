import "dotenv/config";
import { db, pool } from "../src/lib/db/client";
import { users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "lucan@rallyad.com").toLowerCase();

  const existing = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (existing.length > 0) {
    if (!(existing[0].roles ?? []).includes("admin")) {
      await db.update(users).set({ roles: ["admin"] }).where(eq(users.id, existing[0].id));
      console.log(`Promoted ${adminEmail} to admin.`);
    } else {
      console.log(`Admin ${adminEmail} already exists.`);
    }
  } else {
    await db.insert(users).values({
      email: adminEmail,
      roles: ["admin"],
      // No local password — the admin signs in via the Internal Portal (SSO).
      // This row links to the Portal account by email on first SSO login.
    });
    console.log(`Created admin profile ${adminEmail}. Sign in via the Internal Portal (no local password).`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
