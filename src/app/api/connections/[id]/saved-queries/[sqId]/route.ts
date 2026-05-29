import { savedQueries } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireSavedQuery } from '@/lib/db-helpers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  queryText: z.string().min(1).optional(),
});

export const PUT = withHandler(async ({ req, params: { id, sqId }, user, db }) => {
  await requirePermission(user.id, 'queries.saved');
  const body = updateSchema.parse(await req.json());
  await requireSavedQuery(db, sqId, id);

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.queryText !== undefined) updates.queryText = body.queryText;

  if (Object.keys(updates).length > 0) {
    await db.update(savedQueries).set(updates).where(eq(savedQueries.id, Number(sqId)));
  }

  const updated = await db.query.savedQueries.findFirst({ where: eq(savedQueries.id, Number(sqId)) });
  return apiResponse({ data: updated }, 200, req);
});

export const DELETE = withHandler(async ({ req, params: { id, sqId }, user, db }) => {
  await requirePermission(user.id, 'queries.saved');
  await requireSavedQuery(db, sqId, id);
  await db.delete(savedQueries).where(eq(savedQueries.id, Number(sqId)));
  return apiResponse({ data: { success: true } }, 200, req);
});
