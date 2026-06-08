import { requirePendingQuery, requirePendingQueryApproval, updatePendingQueryStatus } from '@/lib/rbac';
import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireConnection } from '@/lib/db-helpers';
import { decrypt } from '@/lib/encryption';
import { createDriverFromConnection } from '@/lib/drivers';
import { executeAndLogQuery } from '@/lib/query-executor';

const MAX_ROWS = 2000;

export const POST = withHandler(async ({ req, params: { id, pqId }, user, db }) => {
  const conn = await requireConnection(db, id);
  const pq = await requirePendingQuery(db, pqId);
  await requirePendingQueryApproval(user.id, pq.teamId);
  await updatePendingQueryStatus(db, pq.id, 'APPROVED', user.id);

  const driver = await createDriverFromConnection(id, conn, decrypt(conn.encryptedPassword));
  const queryParams = pq.params ? JSON.parse(pq.params) : undefined;
  const { result, duration } = await executeAndLogQuery(db, id, user.id, driver, pq.sql, queryParams);

  const truncated = result.rows.length > MAX_ROWS;
  return apiResponse({
    data: { rows: truncated ? result.rows.slice(0, MAX_ROWS) : result.rows, fields: result.fields, rowCount: result.rowCount, duration, truncated },
  }, 200, req);
});
