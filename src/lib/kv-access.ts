import { getDb } from '@/db';
import { kvStore, kvStorePermissions, teamMembers, users, rolePermissions, permissions } from '@/db/schema';
import { eq, and, inArray, or } from 'drizzle-orm';
import { AppError } from './errors';

type KvAction = 'read' | 'write_value' | 'manage_permissions' | 'delete';

async function hasKvManagePerm(userId: string): Promise<boolean> {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { roleId: true },
  });
  if (!user) return false;
  const row = await db
    .select({ id: permissions.id })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(rolePermissions.roleId, user.roleId),
        eq(permissions.code, 'kv_store.manage')
      )
    )
    .limit(1);
  return row.length > 0;
}

export async function checkKvAccess(
  kvId: string,
  userId: string | undefined,
  action: KvAction
): Promise<boolean> {
  const db = getDb();

  const entry = await db.query.kvStore.findFirst({
    where: eq(kvStore.id, kvId),
    columns: { id: true, ownerId: true },
  });
  if (!entry) throw new AppError('Key-value entry not found', 404);

  if (entry.ownerId === userId) return true;

  if (!userId) {
    if (action !== 'read') return false;
    const pub = await db.query.kvStorePermissions.findFirst({
      where: and(
        eq(kvStorePermissions.kvId, kvId),
        eq(kvStorePermissions.action, 'read'),
        eq(kvStorePermissions.granteeType, 'public')
      ),
    });
    return !!pub;
  }

  if (await hasKvManagePerm(userId)) return true;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { roleId: true },
  });
  if (!user) return false;

  const userTeamIds = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .then(rows => rows.map(r => String(r.teamId)));

  const conditions = [
    eq(kvStorePermissions.granteeType, 'studio'),
    eq(kvStorePermissions.granteeType, 'public'),
    and(
      eq(kvStorePermissions.granteeType, 'user'),
      eq(kvStorePermissions.granteeId, userId)
    ),
    and(
      eq(kvStorePermissions.granteeType, 'role'),
      inArray(kvStorePermissions.granteeId, [String(user.roleId)])
    ),
  ];

  if (userTeamIds.length > 0) {
    conditions.push(
      and(
        eq(kvStorePermissions.granteeType, 'team'),
        inArray(kvStorePermissions.granteeId, userTeamIds)
      )
    );
  }

  const grants = await db
    .select()
    .from(kvStorePermissions)
    .where(
      and(
        eq(kvStorePermissions.kvId, kvId),
        eq(kvStorePermissions.action, action),
        or(...conditions)
      )
    );

  return grants.length > 0;
}

export async function requireKvAccess(
  kvId: string,
  userId: string | undefined,
  action: KvAction
): Promise<void> {
  const ok = await checkKvAccess(kvId, userId, action);
  if (!ok) {
    throw new AppError(`You don't have permission to ${action.replace('_', ' ')} this entry`, 403);
  }
}

export async function getAccessibleKvIds(
  userId: string
): Promise<string[]> {
  const db = getDb();

  if (await hasKvManagePerm(userId)) {
    const all = await db
      .select({ id: kvStore.id })
      .from(kvStore)
      .then(rows => rows.map(r => r.id));
    return all;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { roleId: true },
  });
  if (!user) return [];

  const userTeamIds = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .then(rows => rows.map(r => String(r.teamId)));

  const owned = await db
    .select({ id: kvStore.id })
    .from(kvStore)
    .where(eq(kvStore.ownerId, userId))
    .then(rows => rows.map(r => r.id));

  const conditions = [
    eq(kvStorePermissions.granteeType, 'studio'),
    and(
      eq(kvStorePermissions.granteeType, 'user'),
      eq(kvStorePermissions.granteeId, userId)
    ),
    and(
      eq(kvStorePermissions.granteeType, 'role'),
      inArray(kvStorePermissions.granteeId, [String(user.roleId)])
    ),
  ];

  if (userTeamIds.length > 0) {
    conditions.push(
      and(
        eq(kvStorePermissions.granteeType, 'team'),
        inArray(kvStorePermissions.granteeId, userTeamIds)
      )
    );
  }

  const granted = await db
    .select({ kvId: kvStorePermissions.kvId })
    .from(kvStorePermissions)
    .where(
      and(
        eq(kvStorePermissions.action, 'read'),
        or(...conditions)
      )
    )
    .then(rows => rows.map(r => r.kvId));

  return [...new Set([...owned, ...granted])];
}

export function buildAccessPayload(permissions: typeof kvStorePermissions.$inferSelect[]) {
  const result: { read: { type: string; id?: string }[]; write_value: { type: string; id?: string }[]; manage_permissions: { type: string; id?: string }[]; delete: { type: string; id?: string }[] } = {
    read: [],
    write_value: [],
    manage_permissions: [],
    delete: [],
  };
  for (const p of permissions) {
    const grant = p.granteeId
      ? { type: p.granteeType, id: p.granteeId }
      : { type: p.granteeType };
    result[p.action].push(grant);
  }
  return result;
}
