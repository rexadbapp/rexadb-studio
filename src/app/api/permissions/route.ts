import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { permissions } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'permissions.view');

    const all = await db.query.permissions.findMany({
      orderBy: (p, { asc }) => [asc(p.code)],
    });

    return apiResponse({ data: all }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
