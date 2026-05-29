import { connectionAccess } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireConnection, upsertEntity } from '@/lib/db-helpers';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

function av(body: { accessType: string; queryPattern?: string; allowedQueryIds?: number[] }) {
  return {
    accessType: body.accessType,
    queryPattern: body.queryPattern ?? null,
    allowedQueryIds: body.allowedQueryIds ? JSON.stringify(body.allowedQueryIds) : null,
  };
}

export const GET = withHandler(async ({ req, params, user, db }) => {
  const { id } = params;
  await requirePermission(user.id, 'connections.manage_access');
  await requireConnection(db, id);
  const access = await db.query.connectionAccess.findMany({
    where: eq(connectionAccess.connectionId, id),
    with: { role: { columns: { id: true, name: true, description: true } } },
  });
  return apiResponse({ data: access }, 200, req);
});

const setAccessSchema = z.object({
  roleId: z.number().int(),
  accessType: z.enum(['FULL_ACCESS', 'READ_ONLY', 'READ_AND_REQUEST', 'CUSTOM']),
  queryPattern: z.string().optional(),
  allowedQueryIds: z.array(z.number().int()).optional(),
});

export const PUT = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'connections.manage_access');
  const body = setAccessSchema.parse(await req.json());
  await requireConnection(db, id);

  const existing = await db.query.connectionAccess.findFirst({
    where: and(eq(connectionAccess.connectionId, id), eq(connectionAccess.roleId, body.roleId)),
  });

  const values: Record<string, unknown> = {
    connectionId: id,
    roleId: body.roleId,
    ...av(body),
  };

  await upsertEntity(db, connectionAccess, existing, values);
  return apiResponse({ data: values }, 200, req);
});
