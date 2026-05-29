import { teamMembers } from '@/db/schema';
import { requireTeamMemberAccess } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireTeam } from '@/lib/db-helpers';
import { eq, and } from 'drizzle-orm';

export const DELETE = withHandler(async ({ req, params: { id, userId }, user, db }) => {
  const team = await requireTeam(db, id);
  await requireTeamMemberAccess(user.id, team.id, 'teams.manage_members');

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)),
  });
  if (!membership) throw new AppError('Member not found in this team', 404);

  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)));

  return apiResponse({ data: { success: true } }, 200, req);
});
