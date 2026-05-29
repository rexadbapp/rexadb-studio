import { connectionAccess } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireTeam, requireConnection, upsertEntity } from '@/lib/db-helpers';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

export const GET = withHandler(async ({ req, params, user, db }) => {
  const { id } = params;
  await requirePermission(user.id, 'teams.manage_access');
  const team = await requireTeam(db, id);
  const entries = await db.query.connectionAccess.findMany({
    where: eq(connectionAccess.teamId, team.id),
    with: { connection: { columns: { id: true, name: true } } },
  });
  return apiResponse({ data: entries }, 200, req);
});

const setAccessSchema = z.object({
  connectionId: z.string().min(1),
  accessType: z.enum(['FULL_ACCESS', 'READ_ONLY', 'READ_AND_REQUEST', 'CUSTOM']),
  queryPattern: z.string().optional(),
  allowedQueryIds: z.array(z.number()).optional(),
});

export const PUT = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'teams.manage_access');
  const body = setAccessSchema.parse(await req.json());
  const team = await requireTeam(db, id);
  await requireConnection(db, body.connectionId);

  const existing = await db.query.connectionAccess.findFirst({
    where: and(
      eq(connectionAccess.connectionId, body.connectionId),
      eq(connectionAccess.teamId, team.id)
    ),
  });

  const base = {
    accessType: body.accessType,
    queryPattern: body.queryPattern ?? null,
    allowedQueryIds: body.allowedQueryIds ? JSON.stringify(body.allowedQueryIds) : null,
  };
  const values = { connectionId: body.connectionId, teamId: team.id, ...base };

  await upsertEntity(db, connectionAccess, existing, values);
  return apiResponse({ data: values }, 200, req);
});
