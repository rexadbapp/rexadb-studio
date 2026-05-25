import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { connections, pendingQueries, teamMembers, teamPermissions, users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq, and } from 'drizzle-orm';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; pqId: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);

    const { id, pqId } = await params;

    const conn = await db.query.connections.findFirst({
      where: eq(connections.id, id),
    });
    if (!conn) throw new AppError('Connection not found', 404);

    const pq = await db.query.pendingQueries.findFirst({
      where: eq(pendingQueries.id, Number(pqId)),
    });
    if (!pq) throw new AppError('Pending query not found', 404);
    if (pq.status !== 'PENDING') throw new AppError('Query is not in PENDING status', 400);

    const hasGlobal = await (async () => {
      try {
        await requirePermission(user.id, 'queries.approve');
        return true;
      } catch {
        return false;
      }
    })();

    if (!hasGlobal) {
      if (pq.teamId) {
        const tp = await db.query.teamPermissions.findFirst({
          where: and(
            eq(teamPermissions.teamId, pq.teamId),
            eq(teamPermissions.permissionCode, 'queries.approve')
          ),
        });
        if (!tp) throw new AppError('Missing required permission: queries.approve', 403);

        const member = await db.query.teamMembers.findFirst({
          where: and(
            eq(teamMembers.teamId, pq.teamId),
            eq(teamMembers.userId, user.id)
          ),
        });
        if (!member) throw new AppError('You are not a member of the query team', 403);
      } else {
        throw new AppError('Missing required permission: queries.approve', 403);
      }
    }

    const now = new Date().toISOString();
    await db
      .update(pendingQueries)
      .set({
        status: 'REJECTED',
        approvedBy: user.id,
        approvedAt: now,
      })
      .where(eq(pendingQueries.id, pq.id));

    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
