import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { connectionAccess, connections } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'connections.manage_access');

    const { id } = await params;
    const conn = await db.query.connections.findFirst({ where: eq(connections.id, id) });
    if (!conn) throw new AppError('Connection not found', 404);

    const access = await db.query.connectionAccess.findMany({
      where: eq(connectionAccess.connectionId, id),
      with: {
        role: { columns: { id: true, name: true, description: true } },
      },
    });

    return apiResponse({ data: access }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

const setAccessSchema = z.object({
  roleId: z.number().int(),
  accessType: z.enum(['FULL_ACCESS', 'READ_ONLY', 'READ_AND_REQUEST', 'CUSTOM']),
  queryPattern: z.string().optional(),
  allowedQueryIds: z.array(z.number().int()).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'connections.manage_access');

    const { id } = await params;
    const body = setAccessSchema.parse(await req.json());

    const conn = await db.query.connections.findFirst({ where: eq(connections.id, id) });
    if (!conn) throw new AppError('Connection not found', 404);

    const existing = await db.query.connectionAccess.findFirst({
      where: and(
        eq(connectionAccess.connectionId, id),
        eq(connectionAccess.roleId, body.roleId)
      ),
    });

    const values = {
      connectionId: id,
      roleId: body.roleId,
      accessType: body.accessType,
      queryPattern: body.queryPattern ?? null,
      allowedQueryIds: body.allowedQueryIds
        ? JSON.stringify(body.allowedQueryIds)
        : null,
    };

    if (existing) {
      await db
        .update(connectionAccess)
        .set(values)
        .where(eq(connectionAccess.id, existing.id));
    } else {
      await db.insert(connectionAccess).values(values);
    }

    return apiResponse({ data: values }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
