// ── Durable job queue (BullMQ on Redis) ────────────────────────────────────
// Replaces the in-process setInterval agent loop with a real queue: repeatable
// schedules, retries with backoff, concurrency control, and survival across
// restarts. Dormant unless REDIS_URL is set — initProactiveAgents() falls back
// to setInterval when it isn't, so nothing breaks before Redis is deployed.
import { Queue, Worker } from "bullmq";
import { PROACTIVE_JOBS, type ProactiveJobName } from "./proactiveAgents";

const QUEUE_NAME = "proactive-agents";

// Cadence mirrors the old setInterval loop (ms).
const SCHEDULE: Record<ProactiveJobName, number> = {
  scorer: 10 * 60_000,
  guardian: 10 * 60_000,
  scout: 60 * 60_000,
  followup: 12 * 3600_000,
  opportunities: 60 * 60_000,
  modelwatch: 60 * 60_000, // gap-guarded internally to ≤1 real run per ~20h
  sourcesrefresh: 60 * 60_000, // self-gates to 4am ET; retention purge runs every pass
};

let started = false;

export async function startQueue(): Promise<boolean> {
  if (started) return true;
  const url = process.env.REDIS_URL;
  if (!url) return false;
  // Pass host/port options so BullMQ builds its own ioredis (correct version,
  // sets maxRetriesPerRequest: null itself) — avoids a dual-package type clash.
  const u = new URL(url);
  const connection = { host: u.hostname, port: Number(u.port) || 6379 };

  try {
    const queue = new Queue(QUEUE_NAME, { connection });

    // Register repeatable jobs (idempotent — same jobId replaces the schedule).
    for (const [name, every] of Object.entries(SCHEDULE) as Array<[ProactiveJobName, number]>) {
      await queue.add(
        name,
        {},
        {
          repeat: { every },
          jobId: `repeat:${name}`,
          removeOnComplete: 50,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
        },
      );
    }

    // One worker processes all proactive jobs. Concurrency 2 = a slow scout
    // won't block the scorer/guardian, but we never hammer the LLM/DB.
    const worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const fn = PROACTIVE_JOBS[job.name as ProactiveJobName];
        if (fn) await fn();
      },
      { connection, concurrency: 2 },
    );
    worker.on("failed", (job, err) => console.warn(`[queue] ${job?.name} failed:`, err?.message));
    worker.on("error", (err) => console.warn("[queue] worker error:", err?.message));

    started = true;
    console.log("[queue] BullMQ armed on Redis — scout/scorer/guardian/followup are durable repeatable jobs");
    return true;
  } catch (err) {
    console.warn("[queue] Redis unavailable, falling back to in-process loop:", err instanceof Error ? err.message : err);
    return false;
  }
}
