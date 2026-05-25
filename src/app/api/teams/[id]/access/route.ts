import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { teams, connections, connectionAccess } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const accessTypeEnum = z.enum(['FULL_ACCESS', 'READ_ONLY', 'READ_AND_REQUEST', 'CUSTOM']);

const setAccessSchema = z.object({
  connectionId: z.string().min(1),
  accessType: accessTypeEnum,
  queryPattern: z.string().optional(),
  allowedQueryIds: z.array(z.number()).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'teams.manage_access');

    const { id } = await params;
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, Number(id)),
    });
    if (!team) throw new AppError('Team not found', 404);

    const entries = await db.query.connectionAccess.findMany({
      where: eq(connectionAccess.teamId, team.id),
      with: {
        connection: { columns: { id: true, name: true } },
      },
    });

    return apiResponse({ data: entries }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'teams.manage_access');

    const { id } = await params;
    const body = setAccessSchema.parse(await req.json());

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, Number(id)),
    });
    if (!team) throw new AppError('Team not found', 404);

    const conn = await db.query.connections.findFirst({
      where: eq(connections.id, body.connectionId),
    });
    if (!conn) throw new AppError('Connection not found', 404);

    const existing = await db.query.connectionAccess.findFirst({
      where: and(
        eq(connectionAccess.connectionId, body.connectionId),
        eq(connectionAccess.teamId, team.id)
      ),
    });

    const values = {
      connectionId: body.connectionId,
      teamId: team.id,
      accessType: body.accessType,
      queryPattern: body.queryPattern ?? null,
      allowedQueryIds: body.allowedQueryIds ? JSON.stringify(body.allowedQueryIds) : null,
    };

    if (existing) {
      await db
        .update(connectionAccess)
        .set(values)
        .where(eq(connectionAccess.id, existing.id));
    } else {
      await db.insert(connectionAccess).values(values);
    }

    const entry = await db.query.connectionAccess.findFirst({
      where: and(
        eq(connectionAccess.connectionId, body.connectionId),
        eq(connectionAccess.teamId, team.id)
      ),
    });

    return apiResponse({ data: entry }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
