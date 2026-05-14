/**
 * One-time helper: creates the target database if it doesn't already exist.
 * Reads DATABASE_URL from .env, connects to the server's default `postgres`
 * database, and issues a CREATE DATABASE for whatever name DATABASE_URL points at.
 */
import "dotenv/config";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!dbName) throw new Error("DATABASE_URL has no database name");

  // Connect to the maintenance database to issue CREATE DATABASE.
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();

  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount && exists.rowCount > 0) {
    console.log(`Database "${dbName}" already exists — nothing to do.`);
  } else {
    // pg_database name can't be parameterized; we identifier-quote it instead.
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database "${dbName}".`);
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
