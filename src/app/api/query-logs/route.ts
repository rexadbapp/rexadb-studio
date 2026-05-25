import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { queryLogs, connections } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse } from '@/lib/errors';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    await requirePermission(user.id, 'query_logs.view');

    const db = getDb();
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
  } catch (err) {
    return apiError(err, req);
  }
}
