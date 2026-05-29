import { requirePermission } from '@/lib/rbac';
import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';

export const GET = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'users.read');

  const all = await db.query.users.findMany({
    with: { role: { columns: { id: true, name: true, description: true } } },
    orderBy: (u, { asc }) => [asc(u.name)],
  });

  return apiResponse({ data: all }, 200, req);
});
