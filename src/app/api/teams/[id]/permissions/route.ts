import { teamPermissions } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireTeam, upsertEntity } from '@/lib/db-helpers';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

async function findTeamPermission(db: any, teamId: number, code: string) {
  return await db.query.teamPermissions.findFirst({
    where: and(eq(teamPermissions.teamId, teamId), eq(teamPermissions.permissionCode, code)),
  });
}

const permissionSchema = z.object({
  permissionCode: z.string().min(1),
});

export const GET = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'teams.manage_access');
  const permissions = await db.query.teamPermissions.findMany({ where: eq(teamPermissions.teamId, Number(id)) });
  return apiResponse({ data: permissions }, 200, req);
});

export const POST = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'teams.manage_access');
  const body = permissionSchema.parse(await req.json());
  const team = await requireTeam(db, id);

  const existing = await findTeamPermission(db, team.id, body.permissionCode);
  if (existing) throw new AppError('Team permission already exists', 409);

  const now = new Date().toISOString();
  const [tp] = await db.insert(teamPermissions).values({ teamId: team.id, permissionCode: body.permissionCode, grantedBy: user.id, grantedAt: now }).returning();

  return apiResponse({ data: tp }, 201, req);
});

export const DELETE = withHandler(async ({ req, params: params, user, db }) => {
  await requirePermission(user.id, 'teams.manage_access');
  const body = permissionSchema.parse(await req.json());
  const team = await requireTeam(db, params.id);

  const existing = await findTeamPermission(db, team.id, body.permissionCode);
  if (!existing) throw new AppError('Team permission not found', 404);

  await db.delete(teamPermissions).where(and(eq(teamPermissions.teamId, team.id), eq(teamPermissions.permissionCode, body.permissionCode)));

  return apiResponse({ data: { success: true } }, 200, req);
});
