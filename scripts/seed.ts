import "dotenv/config";
import { db, pool } from "../src/lib/db/client";
import { users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "lucan@rallyad.com").toLowerCase();

  const existing = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (existing.length > 0) {
    if (existing[0].role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing[0].id));
      console.log(`Promoted ${adminEmail} to admin.`);
    } else {
      console.log(`Admin ${adminEmail} already exists.`);
    }
  } else {
    await db.insert(users).values({
      email: adminEmail,
      role: "admin",
      // No password yet — admin uses the password-reset / "set initial password" flow on first login.
    });
    console.log(`Created admin shell account ${adminEmail}. Use "Forgot password" on the login page to set the password.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
