import { permissions } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';

export const GET = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'permissions.view');

  const all = await db.query.permissions.findMany({
    orderBy: (p, { asc }) => [asc(p.code)],
  });

  return apiResponse({ data: all }, 200, req);
});
