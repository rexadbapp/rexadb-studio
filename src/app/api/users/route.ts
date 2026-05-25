import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'users.read');

    const all = await db.query.users.findMany({
      with: { role: { columns: { id: true, name: true, description: true } } },
      orderBy: (u, { asc }) => [asc(u.name)],
    });

    return apiResponse({ data: all }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
