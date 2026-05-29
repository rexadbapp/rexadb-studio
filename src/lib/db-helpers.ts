import { getDb } from '@/db';
import { connectionAccess, connections, teams, teamMembers, users, savedQueries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { AppError } from './errors';
import { hasPermission } from './rbac';

export async function requireConnection(db: ReturnType<typeof getDb>, id: string) {
  const conn = await db.query.connections.findFirst({ where: eq(connections.id, id) });
  if (!conn) throw new AppError('Connection not found', 404);
  return conn;
}

export async function requireTeam(db: ReturnType<typeof getDb>, id: string) {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, Number(id)) });
  if (!team) throw new AppError('Team not found', 404);
  return team;
}

export async function requireUser(db: ReturnType<typeof getDb>, id: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function requireSavedQuery(db: ReturnType<typeof getDb>, id: string, connectionId: string) {
  const sq = await db.query.savedQueries.findFirst({
    where: and(eq(savedQueries.id, Number(id)), eq(savedQueries.connectionId, connectionId)),
  });
  if (!sq) throw new AppError('Saved query not found', 404);
  return sq;
}

export async function getTeamWithMembers(db: ReturnType<typeof getDb>, id: string) {
  const team = await requireTeam(db, id);
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
  return { team, members };
}

export async function upsertEntity<T extends { id: number }>(
  db: ReturnType<typeof getDb>,
  table: any,
  existing: T | undefined,
  values: Record<string, unknown>
) {
  if (existing) {
    await db.update(table).set(values).where(eq((table as any).id, existing.id));
  } else {
    await db.insert(table).values(values as any);
  }
}

export async function requireTargetUser(
  db: ReturnType<typeof getDb>,
  callerId: string,
  targetId: string,
  permissionCode: string
) {
  const canManage = await hasPermission(callerId, permissionCode);
  if (callerId !== targetId && !canManage) throw new AppError('Forbidden', 403);
  const target = await requireUser(db, targetId);
  return target;
}
