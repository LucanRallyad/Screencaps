/**
 * Dev helper: set a password for a user directly in the DB.
 * Usage:  npx tsx scripts/set-password.ts <email> <password>
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db/client";
import { users } from "../src/lib/db/schema";

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const password = process.argv[3];
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/set-password.ts <email> <password>");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await db
    .update(users)
    .set({ passwordHash: hash, emailVerifiedAt: new Date() })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email });

  if (result.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  console.log(`Password set for ${result[0].email}. You can now sign in.`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
