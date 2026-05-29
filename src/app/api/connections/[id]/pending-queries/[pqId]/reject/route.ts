import { requirePendingQuery, requirePendingQueryApproval, updatePendingQueryStatus } from '@/lib/rbac';
import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireConnection } from '@/lib/db-helpers';

export const POST = withHandler(async ({ req, params: { id, pqId }, user, db }) => {
  await requireConnection(db, id);
  const pq = await requirePendingQuery(db, pqId);
  await requirePendingQueryApproval(user.id, pq.teamId);
  await updatePendingQueryStatus(db, pq.id, 'REJECTED', user.id);
  return apiResponse({ data: { success: true } }, 200, req);
});
