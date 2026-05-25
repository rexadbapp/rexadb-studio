import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { teams, teamMembers, users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq, and } from 'drizzle-orm';

async function isTeamAdmin(userId: string, teamId: number): Promise<boolean> {
  const db = getDb();
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId), eq(teamMembers.role, 'admin')),
  });
  return !!membership;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);

    const { id, userId } = await params;

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, Number(id)),
    });
    if (!team) throw new AppError('Team not found', 404);

    const hasGlobal = await (async () => {
      try {
        await requirePermission(user.id, 'teams.manage_members');
        return true;
      } catch {
        return false;
      }
    })();

    if (!hasGlobal && !(await isTeamAdmin(user.id, team.id))) {
      throw new AppError('Missing required permission: teams.manage_members', 403);
    }

    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)),
    });
    if (!membership) throw new AppError('Member not found in this team', 404);

    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)));

    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
