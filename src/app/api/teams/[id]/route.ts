import { teams } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { getTeamWithMembers, requireTeam } from '@/lib/db-helpers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
});

export const GET = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'teams.read');
  const { team, members } = await getTeamWithMembers(db, id);
  return apiResponse({ data: { ...team, members } }, 200, req);
});

export const PUT = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'teams.update');

  const body = updateSchema.parse(await req.json());
  await requireTeam(db, id);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;

  await db.update(teams).set(updates).where(eq(teams.id, Number(id)));

  const updated = await db.query.teams.findFirst({
    where: eq(teams.id, Number(id)),
  });
  return apiResponse({ data: updated }, 200, req);
});

export const DELETE = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'teams.delete');
  await requireTeam(db, id);
  await db.delete(teams).where(eq(teams.id, Number(id)));
  return apiResponse({ data: { success: true } }, 200, req);
});
