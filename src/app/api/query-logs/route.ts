import { queryLogs, connections } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { eq, desc } from 'drizzle-orm';

export const GET = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'query_logs.view');

  const all = await db.query.queryLogs.findMany({
    with: {
      connection: { columns: { id: true, name: true, type: true } },
      user: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
        with: {
          role: { columns: { id: true, name: true } },
        },
      },
    },
    orderBy: (q, { desc }) => [desc(q.executedAt)],
    limit: 200,
  });

  return apiResponse({ data: all }, 200, req);
});
