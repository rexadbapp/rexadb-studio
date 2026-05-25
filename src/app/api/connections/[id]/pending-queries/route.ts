import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { connections, pendingQueries, connectionAccess, teamMembers, teamPermissions, users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  sql: z.string().min(1),
  params: z.array(z.unknown()).optional(),
  teamId: z.number().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);

    const { id } = await params;

    const conn = await db.query.connections.findFirst({
      where: eq(connections.id, id),
    });
    if (!conn) throw new AppError('Connection not found', 404);

    const hasGlobal = await (async () => {
      try {
        await requirePermission(user.id, 'queries.approve');
        return true;
      } catch {
        return false;
      }
    })();

    let teamIds: number[] = [];
    if (!hasGlobal) {
      const memberships = await db.query.teamMembers.findMany({
        where: eq(teamMembers.userId, user.id),
        columns: { teamId: true },
      });
      const userTeamIds = memberships.map((m) => m.teamId);

      const teamsWithAccess = await db.query.connectionAccess.findMany({
        where: and(
          eq(connectionAccess.connectionId, id),
          inArray(connectionAccess.teamId, userTeamIds)
        ),
        columns: { teamId: true },
      });
      const accessibleTeamIds = teamsWithAccess.map((a) => a.teamId!);

      const teamPerms = await db.query.teamPermissions.findMany({
        where: and(
          eq(teamPermissions.permissionCode, 'queries.approve'),
          inArray(teamPermissions.teamId, accessibleTeamIds)
        ),
        columns: { teamId: true },
      });
      teamIds = teamPerms.map((tp) => tp.teamId);
    }

    let queries;
    if (hasGlobal) {
      queries = await db.query.pendingQueries.findMany({
        where: eq(pendingQueries.connectionId, id),
        with: {
          requestedByUser: { columns: { id: true, email: true, name: true } },
        },
        orderBy: (q, { desc }) => [desc(q.createdAt)],
      });
    } else {
      queries = await db.query.pendingQueries.findMany({
        where: and(
          eq(pendingQueries.connectionId, id),
          inArray(pendingQueries.teamId, teamIds)
        ),
        with: {
          requestedByUser: { columns: { id: true, email: true, name: true } },
        },
        orderBy: (q, { desc }) => [desc(q.createdAt)],
      });
    }

    return apiResponse({ data: queries }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);

    const { id } = await params;
    const body = createSchema.parse(await req.json());

    const conn = await db.query.connections.findFirst({
      where: eq(connections.id, id),
    });
    if (!conn) throw new AppError('Connection not found', 404);

    const access = await db.query.connectionAccess.findFirst({
      where: and(
        eq(connectionAccess.connectionId, id),
        eq(connectionAccess.roleId, user.roleId),
        eq(connectionAccess.accessType, 'READ_AND_REQUEST')
      ),
    });

    const hasTeamRequestAccess = body.teamId
      ? await db.query.connectionAccess.findFirst({
          where: and(
            eq(connectionAccess.connectionId, id),
            eq(connectionAccess.teamId, body.teamId),
            eq(connectionAccess.accessType, 'READ_AND_REQUEST')
          ),
        })
      : null;

    if (!access && !hasTeamRequestAccess) {
      throw new AppError('Missing required access: READ_AND_REQUEST', 403);
    }

    if (body.teamId) {
      const membership = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, body.teamId),
          eq(teamMembers.userId, user.id)
        ),
      });
      if (!membership) throw new AppError('You are not a member of the specified team', 403);
    }

    const now = new Date().toISOString();
    const [pq] = await db
      .insert(pendingQueries)
      .values({
        connectionId: id,
        teamId: body.teamId ?? null,
        requestedBy: user.id,
        sql: body.sql,
        params: body.params ? JSON.stringify(body.params) : null,
        status: 'PENDING',
        createdAt: now,
      })
      .returning();

    return apiResponse({ data: pq }, 201, req);
  } catch (err) {
    return apiError(err, req);
  }
}
