import { teams, teamMembers } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().default(''),
});

export const GET = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'teams.read');

  const all = await db.query.teams.findMany({
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  const result = await Promise.all(
    all.map(async (team) => {
      const members = await db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, team.id),
        columns: { userId: true },
      });
      return { ...team, memberCount: members.length };
    })
  );

  return apiResponse({ data: result }, 200, req);
});

export const POST = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'teams.create');

  const body = createSchema.parse(await req.json());

  const existing = await db.query.teams.findFirst({
    where: eq(teams.name, body.name),
  });
  if (existing) throw new AppError('Team already exists', 409);

  const now = new Date().toISOString();
  const [team] = await db
    .insert(teams)
    .values({
      name: body.name,
      description: body.description,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: 'admin',
    joinedAt: now,
  });

  return apiResponse({ data: team }, 201, req);
});
