import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { teams, teamMembers, users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['admin', 'member']).optional().default('member'),
});

async function isTeamAdmin(userId: string, teamId: number): Promise<boolean> {
  const db = getDb();
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId), eq(teamMembers.role, 'admin')),
  });
  return !!membership;
}

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

    return apiResponse({ data: members }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);

    const { id } = await params;
    const body = addMemberSchema.parse(await req.json());

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

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, body.userId),
    });
    if (!targetUser) throw new AppError('User not found', 404);

    const existingMember = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, body.userId)),
    });
    if (existingMember) throw new AppError('User is already a member of this team', 409);

    const now = new Date().toISOString();
    const [member] = await db
      .insert(teamMembers)
      .values({
        teamId: team.id,
        userId: body.userId,
        role: body.role,
        joinedAt: now,
      })
      .returning();

    return apiResponse({ data: member }, 201, req);
  } catch (err) {
    return apiError(err, req);
  }
}
