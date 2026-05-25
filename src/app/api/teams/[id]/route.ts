import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { teams, teamMembers } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'teams.read');

    const { id } = await params;
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, Number(id)),
    });
    if (!team) throw new AppError('Team not found', 404);

    const members = await db.query.teamMembers.findMany({
      where: eq(teamMembers.teamId, team.id),
      with: {
        user: {
          columns: { id: true, email: true, name: true, avatarUrl: true },
          with: {
            role: { columns: { id: true, name: true } },
          },
        },
      },
    });

    return apiResponse({ data: { ...team, members } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'teams.update');

    const { id } = await params;
    const body = updateSchema.parse(await req.json());

    const existing = await db.query.teams.findFirst({
      where: eq(teams.id, Number(id)),
    });
    if (!existing) throw new AppError('Team not found', 404);

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;

    await db.update(teams).set(updates).where(eq(teams.id, Number(id)));

    const updated = await db.query.teams.findFirst({
      where: eq(teams.id, Number(id)),
    });
    return apiResponse({ data: updated }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'teams.delete');

    const { id } = await params;
    const existing = await db.query.teams.findFirst({
      where: eq(teams.id, Number(id)),
    });
    if (!existing) throw new AppError('Team not found', 404);

    await db.delete(teams).where(eq(teams.id, Number(id)));
    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
