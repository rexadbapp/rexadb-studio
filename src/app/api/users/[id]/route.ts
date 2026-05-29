import { users, invites } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireUser } from '@/lib/db-helpers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = withHandler(async ({ req, params: { id }, user: caller, db }) => {
  await requirePermission(caller.id, 'users.manage');
  const body = updateSchema.parse(await req.json());
  await requireUser(db, id);

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.email !== undefined) updates.email = body.email;
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, id));
  }

  return apiResponse({ data: { success: true } }, 200, req);
});

export const DELETE = withHandler(async ({ req, params: { id }, user: caller, db }) => {
  await requirePermission(caller.id, 'users.manage');
  await requireUser(db, id);

  await db.delete(invites).where(eq(invites.createdBy, id));
  await db.delete(users).where(eq(users.id, id));

  return apiResponse({ data: { success: true } }, 200, req);
});
