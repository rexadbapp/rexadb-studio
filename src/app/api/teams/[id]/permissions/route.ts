import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { teams, teamPermissions } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const permissionSchema = z.object({
  permissionCode: z.string().min(1),
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

    const permissions = await db.query.teamPermissions.findMany({
      where: eq(teamPermissions.teamId, team.id),
    });

    return apiResponse({ data: permissions }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'teams.manage_access');

    const { id } = await params;
    const body = permissionSchema.parse(await req.json());

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, Number(id)),
    });
    if (!team) throw new AppError('Team not found', 404);

    const existing = await db.query.teamPermissions.findFirst({
      where: and(
        eq(teamPermissions.teamId, team.id),
        eq(teamPermissions.permissionCode, body.permissionCode)
      ),
    });
    if (existing) throw new AppError('Team permission already exists', 409);

    const now = new Date().toISOString();
    const [tp] = await db
      .insert(teamPermissions)
      .values({
        teamId: team.id,
        permissionCode: body.permissionCode,
        grantedBy: user.id,
        grantedAt: now,
      })
      .returning();

    return apiResponse({ data: tp }, 201, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'teams.manage_access');

    const { id } = await params;
    const body = permissionSchema.parse(await req.json());

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, Number(id)),
    });
    if (!team) throw new AppError('Team not found', 404);

    const existing = await db.query.teamPermissions.findFirst({
      where: and(
        eq(teamPermissions.teamId, team.id),
        eq(teamPermissions.permissionCode, body.permissionCode)
      ),
    });
    if (!existing) throw new AppError('Team permission not found', 404);

    await db
      .delete(teamPermissions)
      .where(
        and(
          eq(teamPermissions.teamId, team.id),
          eq(teamPermissions.permissionCode, body.permissionCode)
        )
      );

    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
