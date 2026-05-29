import { getDb } from '@/db';
import { users, rolePermissions, permissions, connectionAccess, savedQueries, roles, teamMembers, teamPermissions, pendingQueries } from '@/db/schema';
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

export async function hasPermission(userId: string, code: string): Promise<boolean> {
  try {
    await requirePermission(userId, code);
    return true;
  } catch {
    return false;
  }
}

async function isTeamAdmin(userId: string, teamId: number): Promise<boolean> {
  const db = getDb();
  const membership = await db.query.teamMembers.findFirst({
    where: (tm, { eq, and }) => and(eq(tm.teamId, teamId), eq(tm.userId, userId), eq(tm.role, 'admin')),
  });
  return !!membership;
}

export async function requirePendingQuery(db: ReturnType<typeof getDb>, pqId: string) {
  const pq = await db.query.pendingQueries.findFirst({
    where: eq(pendingQueries.id, Number(pqId)),
  });
  if (!pq) throw new AppError('Pending query not found', 404);
  if (pq.status !== 'PENDING') throw new AppError('Query is not in PENDING status', 400);
  return pq;
}

export async function updatePendingQueryStatus(
  db: ReturnType<typeof getDb>,
  pqId: number,
  status: 'APPROVED' | 'REJECTED',
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.update(pendingQueries).set({ status, approvedBy: userId, approvedAt: now }).where(eq(pendingQueries.id, pqId));
}

export async function requirePendingQueryApproval(userId: string, teamId: number | null): Promise<void> {
  if (await hasPermission(userId, 'queries.approve')) return;

  if (teamId) {
    const db = getDb();
    const tp = await db.query.teamPermissions.findFirst({
      where: (tpt, { eq, and }) => and(eq(tpt.teamId, teamId), eq(tpt.permissionCode, 'queries.approve')),
    });
    if (!tp) throw new AppError('Missing required permission: queries.approve', 403);

    const member = await db.query.teamMembers.findFirst({
      where: (tm, { eq, and }) => and(eq(tm.teamId, teamId), eq(tm.userId, userId)),
    });
    if (!member) throw new AppError('You are not a member of the query team', 403);
  } else {
    throw new AppError('Missing required permission: queries.approve', 403);
  }
}

type AccessLevel = 'FULL_ACCESS' | 'READ_ONLY' | 'READ_AND_REQUEST' | 'CUSTOM';

interface ConnectionAccessResult {
  allowed: boolean;
  accessType: AccessLevel | null;
  queryPattern: string | null;
  allowedQueryIds: number[];
}

function denied(): ConnectionAccessResult {
  return { allowed: false, accessType: null, queryPattern: null, allowedQueryIds: [] };
}

function fullAccess(): ConnectionAccessResult {
  return { allowed: true, accessType: 'FULL_ACCESS', queryPattern: null, allowedQueryIds: [] };
}

function isReadQuery(sql: string): boolean {
  return /^(SELECT|WITH|EXPLAIN|DESCRIBE|SHOW)\b/.test(sql.trim().toUpperCase());
}

function checkReadOnlyAccess(sql: string): ConnectionAccessResult {
  if (!isReadQuery(sql)) return { ...denied(), accessType: 'READ_ONLY' };
  return { allowed: true, accessType: 'READ_ONLY', queryPattern: null, allowedQueryIds: [] };
}

function checkReadAndRequestAccess(sql: string): ConnectionAccessResult {
  if (isReadQuery(sql)) return { allowed: true, accessType: 'READ_AND_REQUEST', queryPattern: null, allowedQueryIds: [] };
  return { ...denied(), accessType: 'READ_AND_REQUEST' };
}

async function checkCustomAccess(db: ReturnType<typeof getDb>, connectionId: string, sql: string, access: typeof connectionAccess.$inferSelect): Promise<ConnectionAccessResult> {
  const allowedIds: number[] = access.allowedQueryIds ? JSON.parse(access.allowedQueryIds) : [];

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
      where: and(eq(savedQueries.connectionId, connectionId), inArray(savedQueries.id, allowedIds)),
    });
    if (savedQuery) return { allowed: true, accessType: 'CUSTOM', queryPattern: null, allowedQueryIds: allowedIds };
  }

  return { allowed: false, accessType: 'CUSTOM', queryPattern: access.queryPattern, allowedQueryIds: allowedIds };
}

async function checkTeamAccess(db: ReturnType<typeof getDb>, userId: string, connectionId: string): Promise<ConnectionAccessResult | null> {
  const userTeams = await db.query.teamMembers.findMany({
    where: (tm, { eq }) => eq(tm.userId, userId),
    columns: { teamId: true },
  });
  if (userTeams.length === 0) return null;

  const teamIds = userTeams.map(t => t.teamId);
  const teamAccess = await db.select().from(connectionAccess)
    .where(and(eq(connectionAccess.connectionId, connectionId), isNotNull(connectionAccess.teamId), inArray(connectionAccess.teamId, teamIds)))
    .limit(1)
    .then(rows => rows[0] ?? null);
  if (!teamAccess) return null;

  return { allowed: true, accessType: teamAccess.accessType as AccessLevel, queryPattern: teamAccess.queryPattern, allowedQueryIds: teamAccess.allowedQueryIds ? JSON.parse(teamAccess.allowedQueryIds) : [] };
}

export async function checkConnectionAccess(userId: string, connectionId: string, sql: string): Promise<ConnectionAccessResult> {
  const db = getDb();

  if (await hasPermission(userId, 'connections.manage_access')) return fullAccess();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { roleId: true },
  });
  if (!user) throw new AppError('User not found', 404);

  const access = await db.query.connectionAccess.findFirst({
    where: and(eq(connectionAccess.connectionId, connectionId), eq(connectionAccess.roleId, user.roleId)),
  });
  if (!access) return denied();

  if (access.accessType === 'FULL_ACCESS') return fullAccess();
  if (access.accessType === 'READ_ONLY') return checkReadOnlyAccess(sql);
  if (access.accessType === 'CUSTOM') return checkCustomAccess(db, connectionId, sql, access);
  if (access.accessType === 'READ_AND_REQUEST') return checkReadAndRequestAccess(sql);

  const teamResult = await checkTeamAccess(db, userId, connectionId);
  if (teamResult) return teamResult;

  return denied();
}

export async function requireTeamMemberAccess(userId: string, teamId: number, permission: string): Promise<void> {
  const db = getDb();
  const member = await db.query.teamMembers.findFirst({
    where: (tm, { eq, and }) => and(eq(tm.teamId, teamId), eq(tm.userId, userId), eq(tm.role, 'admin')),
  });
  if (member) return;
  if (!(await hasPermission(userId, permission))) {
    throw new AppError(`Missing required permission: ${permission}`, 403);
  }
}


