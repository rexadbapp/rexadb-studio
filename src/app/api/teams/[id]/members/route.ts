import { teamMembers } from '@/db/schema';
import { requirePermission, requireTeamMemberAccess } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireTeam, requireUser } from '@/lib/db-helpers';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['admin', 'member']).optional().default('member'),
});

export const GET = withHandler(async ({ req, params, user, db }) => {
  const { id } = params;
  await requirePermission(user.id, 'teams.read');
  await requireTeam(db, id);
  const members = await db.query.teamMembers.findMany({
    where: eq(teamMembers.teamId, Number(id)),
    with: {
      user: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
        with: { role: { columns: { id: true, name: true } } },
      },
    },
  });
  return apiResponse({ data: members }, 200, req);
});

export const POST = withHandler(async ({ req, params: { id }, user, db }) => {
  const body = addMemberSchema.parse(await req.json());
  const team = await requireTeam(db, id);
  await requireTeamMemberAccess(user.id, team.id, 'teams.manage_members');

  const targetUser = await requireUser(db, body.userId);

  const existingMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, body.userId)),
  });
  if (existingMember) throw new AppError('User is already a member of this team', 409);

  const now = new Date().toISOString();
  const [member] = await db
    .insert(teamMembers)
    .values({ teamId: team.id, userId: body.userId, role: body.role, joinedAt: now })
    .returning();

  return apiResponse({ data: member }, 201, req);
});
