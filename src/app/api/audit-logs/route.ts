import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse } from '@/lib/errors';
import { getBufferAuditLog } from '@/lib/audit';
import { desc, inArray } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    await requirePermission(user.id, 'audit_logs.view');

    const db = getDb();
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
  } catch (err) {
    return apiError(err, req);
  }
}
