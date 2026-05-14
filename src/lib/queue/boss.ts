import PgBoss from "pg-boss";

const globalForBoss = globalThis as unknown as { pgBoss?: PgBoss };

export async function getBoss(): Promise<PgBoss> {
  if (globalForBoss.pgBoss) return globalForBoss.pgBoss;
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    retryLimit: 1,
    retryDelay: 30,
    archiveCompletedAfterSeconds: 60 * 60 * 24, // 1 day
  });
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();
  globalForBoss.pgBoss = boss;
  return boss;
}

export const QUEUE_CAPTURE = "screencaps.capture";

export type CaptureJobData = {
  projectId: string;
  targetId: string;
  url: string;
  device: "desktop" | "mobile";
};
