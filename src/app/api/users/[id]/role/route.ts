import { users, roles } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireUser } from '@/lib/db-helpers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  roleId: z.number().int().positive(),
});

export const PATCH = withHandler(async ({ req, params: { id }, user: caller, db }) => {
  await requirePermission(caller.id, 'roles.assign');
  const body = schema.parse(await req.json());
  const target = await requireUser(db, id);

  const role = await db.query.roles.findFirst({ where: eq(roles.id, body.roleId) });
  if (!role) throw new AppError('Role not found', 404);

  await db.update(users).set({ roleId: body.roleId }).where(eq(users.id, id));

  return apiResponse({ data: { success: true } }, 200, req);
});
