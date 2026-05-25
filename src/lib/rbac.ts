import { getDb } from '@/db';
import { users, rolePermissions, permissions, connectionAccess, savedQueries, roles, teamMembers, teamPermissions } from '@/db/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { AppError } from './errors';

export async function requirePermission(userId: string, code: string): Promise<void> {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { roleId: true },
  });
  if (!user) throw new AppError('User not found', 404);

  const has = await db
    .select({ id: permissions.id })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(rolePermissions.roleId, user.roleId),
        eq(permissions.code, code)
      )
    )
    .limit(1);

  if (has.length === 0) {
    throw new AppError(`Missing required permission: ${code}`, 403);
  }
}

export type AccessLevel = 'FULL_ACCESS' | 'READ_ONLY' | 'READ_AND_REQUEST' | 'CUSTOM';

interface ConnectionAccessResult {
  allowed: boolean;
  accessType: AccessLevel | null;
  queryPattern: string | null;
  allowedQueryIds: number[];
}

export async function checkConnectionAccess(
  userId: string,
  connectionId: string,
  sql: string
): Promise<ConnectionAccessResult> {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { roleId: true },
  });
  if (!user) throw new AppError('User not found', 404);

  const hasFullAccessPerm = await db
    .select({ id: permissions.id })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(rolePermissions.roleId, user.roleId),
        eq(permissions.code, 'connections.manage_access')
      )
    )
    .limit(1);

  if (hasFullAccessPerm.length > 0) {
    return { allowed: true, accessType: 'FULL_ACCESS', queryPattern: null, allowedQueryIds: [] };
  }

  const access = await db.query.connectionAccess.findFirst({
    where: and(
      eq(connectionAccess.connectionId, connectionId),
      eq(connectionAccess.roleId, user.roleId)
    ),
  });

  if (!access) {
    return { allowed: false, accessType: null, queryPattern: null, allowedQueryIds: [] };
  }

  if (access.accessType === 'FULL_ACCESS') {
    return { allowed: true, accessType: 'FULL_ACCESS', queryPattern: null, allowedQueryIds: [] };
  }

  if (access.accessType === 'READ_ONLY') {
    const trimmed = sql.trim().toUpperCase();
    const isRead = /^(SELECT|WITH|EXPLAIN|DESCRIBE|SHOW)\b/.test(trimmed);
    if (!isRead) {
      return { allowed: false, accessType: 'READ_ONLY', queryPattern: null, allowedQueryIds: [] };
    }
    return { allowed: true, accessType: 'READ_ONLY', queryPattern: null, allowedQueryIds: [] };
  }

  if (access.accessType === 'CUSTOM') {
    const allowedIds: number[] = access.allowedQueryIds
      ? JSON.parse(access.allowedQueryIds)
      : [];

    if (access.queryPattern) {
      try {
        const regex = new RegExp(access.queryPattern, 'i');
        if (regex.test(sql.trim())) {
          return { allowed: true, accessType: 'CUSTOM', queryPattern: access.queryPattern, allowedQueryIds: allowedIds };
        }
      } catch {}
    }

    if (allowedIds.length > 0) {
      const savedQuery = await db.query.savedQueries.findFirst({
        where: and(
          eq(savedQueries.connectionId, connectionId),
          inArray(savedQueries.id, allowedIds)
        ),
      });
      if (savedQuery) {
        return { allowed: true, accessType: 'CUSTOM', queryPattern: null, allowedQueryIds: allowedIds };
      }
    }

    return { allowed: false, accessType: 'CUSTOM', queryPattern: access.queryPattern, allowedQueryIds: allowedIds };
  }

  if (access.accessType === 'READ_AND_REQUEST') {
    const trimmed = sql.trim().toUpperCase();
    const isRead = /^(SELECT|WITH|EXPLAIN|DESCRIBE|SHOW)\b/.test(trimmed);
    if (isRead) {
      return { allowed: true, accessType: 'READ_AND_REQUEST', queryPattern: null, allowedQueryIds: [] };
    }
    return { allowed: false, accessType: 'READ_AND_REQUEST', queryPattern: null, allowedQueryIds: [] };
  }

  // Also check team-based access
  const userTeams = await db.query.teamMembers.findMany({
    where: (tm, { eq }) => eq(tm.userId, userId),
    columns: { teamId: true },
  });

  if (userTeams.length > 0) {
    const teamIds = userTeams.map(t => t.teamId);
    const teamAccess = await db.select().from(connectionAccess)
      .where(and(
        eq(connectionAccess.connectionId, connectionId),
        isNotNull(connectionAccess.teamId),
        inArray(connectionAccess.teamId, teamIds)
      ))
      .limit(1)
      .then(rows => rows[0] ?? null);
    if (teamAccess) {
      return { allowed: true, accessType: teamAccess.accessType as AccessLevel, queryPattern: teamAccess.queryPattern, allowedQueryIds: teamAccess.allowedQueryIds ? JSON.parse(teamAccess.allowedQueryIds) : [] };
    }
  }

  return { allowed: false, accessType: null, queryPattern: null, allowedQueryIds: [] };
}

export async function hasTeamPermission(userId: string, teamId: number, permissionCode: string): Promise<boolean> {
  const db = getDb();
  const member = await db.query.teamMembers.findFirst({
    where: (tm, { eq, and }) => and(eq(tm.teamId, teamId), eq(tm.userId, userId)),
  });
  if (!member) return false;
  if (member.role === 'admin') return true;
  const perm = await db.query.teamPermissions.findFirst({
    where: (tp, { eq, and }) => and(eq(tp.teamId, teamId), eq(tp.permissionCode, permissionCode)),
  });
  return !!perm;
}

export async function requireTeamPermission(userId: string, teamId: number, permissionCode: string): Promise<void> {
  const has = await hasTeamPermission(userId, teamId, permissionCode);
  if (!has) {
    throw new AppError(`Missing required team permission: ${permissionCode}`, 403);
  }
}

export async function canManageTeam(userId: string, teamId: number): Promise<boolean> {
  const db = getDb();
  const member = await db.query.teamMembers.findFirst({
    where: (tm, { eq, and }) => and(eq(tm.teamId, teamId), eq(tm.userId, userId)),
  });
  return member?.role === 'admin';
}

export async function requireTeamAdmin(userId: string, teamId: number): Promise<void> {
  const isAdmin = await canManageTeam(userId, teamId);
  if (!isAdmin) {
    throw new AppError('You must be a team admin to perform this action', 403);
  }
}
