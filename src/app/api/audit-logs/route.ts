import { auditLogs, users } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { getBufferAuditLog } from '@/lib/audit';
import { inArray } from 'drizzle-orm';

export const GET = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'audit_logs.view');

  const fromDb = await db.query.auditLogs.findMany({
    orderBy: (a, { desc }) => [desc(a.id)],
    limit: 200,
  });

  const fromBuffer = getBufferAuditLog();

  const merged = [...fromBuffer.reverse(), ...fromDb].slice(0, 200);

  const userIds = [...new Set(merged.map(e => e.userId).filter(Boolean))] as string[];

  const userMap = new Map<string, { id: string; name: string; email: string; avatarUrl: string | null; role: { id: number; name: string } | null }>();
  if (userIds.length > 0) {
    const found = await db.query.users.findMany({
      where: inArray(users.id, userIds),
      columns: { id: true, name: true, email: true, avatarUrl: true },
      with: {
        role: { columns: { id: true, name: true } },
      },
    });
    for (const u of found) {
      userMap.set(u.id, u);
    }
  }

  const sanitized = merged.map(({ resBody: _, ...rest }) => ({
    ...rest,
    user: rest.userId ? userMap.get(rest.userId) ?? null : null,
  }));

  return apiResponse({ data: sanitized }, 200, req);
});
