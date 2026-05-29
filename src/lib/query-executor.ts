import { queryLogs } from '@/db/schema';
import { getDb } from '@/db';
import { evictDriverIfAuthError } from '@/lib/drivers';
import type { DatabaseDriver } from '@/lib/drivers';

export async function executeAndLogQuery(
  db: ReturnType<typeof getDb>,
  connectionId: string,
  userId: string,
  driver: DatabaseDriver,
  sql: string,
  params?: unknown[]
) {
  const start = performance.now();
  let result: Awaited<ReturnType<typeof driver.query>>;
  try {
    result = await driver.query(sql, params);
  } catch (qErr) {
    evictDriverIfAuthError(connectionId, qErr);
    throw qErr;
  }
  const duration = Math.round(performance.now() - start);

  await db.insert(queryLogs).values({
    connectionId,
    userId,
    query: sql,
    duration,
    executedAt: new Date().toISOString(),
  });

  return { result, duration };
}
