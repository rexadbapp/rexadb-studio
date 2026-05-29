import { kvStore, kvStorePermissions } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'node:crypto';
import { getAccessibleKvIds, buildAccessPayload, kvPermissionSchema } from '@/lib/kv-access';

const createSchema = z.object({
  key: z.string().min(1).max(500),
  value: z.string(),
  permissions: z.array(kvPermissionSchema).optional().default([]),
});

const actionOrder: Record<string, number> = {
  read: 0,
  write_value: 1,
  manage_permissions: 2,
  delete: 3,
};

function parseQueryScope(scope: string | null): string {
  if (!scope || scope === 'all') return 'all';
  if (scope === 'owned') return 'owned';
  if (scope === 'shared') return 'shared';
  return 'all';
}

export const GET = withHandler(async ({ req, user, db }) => {
  const scope = parseQueryScope(req.nextUrl.searchParams.get('scope'));

  const allIds = await getAccessibleKvIds(user.id);
  if (allIds.length === 0) return apiResponse({ data: [] }, 200, req);

  const ownedRows = scope !== 'all'
    ? await db.select({ id: kvStore.id }).from(kvStore).where(and(eq(kvStore.ownerId, user.id), inArray(kvStore.id, allIds)))
    : [];
  const ownedIds = ownedRows.map(r => r.id);
  const ownedSet = new Set(ownedIds);

  let ids: string[];
  if (scope === 'owned') {
    ids = ownedIds;
  } else if (scope === 'shared') {
    ids = allIds.filter(id => !ownedSet.has(id));
  } else {
    ids = allIds;
  }

  if (ids.length === 0) return apiResponse({ data: [] }, 200, req);

  const entries = await db.query.kvStore.findMany({
    where: inArray(kvStore.id, ids),
    with: { permissions: true },
    orderBy: (kv, { desc }) => [desc(kv.updatedAt)],
  });

  const result = entries.map(e => ({
    id: e.id,
    key: e.key,
    value: e.value,
    ownerId: e.ownerId,
    permissions: buildAccessPayload(e.permissions),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));

  return apiResponse({ data: result }, 200, req);
});

export const POST = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'kv_store.create');
  const body = createSchema.parse(await req.json());
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const existing = await db.query.kvStore.findFirst({
    where: and(eq(kvStore.ownerId, user.id), eq(kvStore.key, body.key)),
  });
  if (existing) {
    throw new AppError(`You already have an entry with key "${body.key}"`, 409);
  }

  const [entry] = await db
    .insert(kvStore)
    .values({
      id,
      key: body.key,
      value: body.value,
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const permValues = body.permissions.map((p) => ({
    kvId: id,
    action: p.action,
    granteeType: p.type,
    granteeId: p.id ?? null,
    grantedBy: user.id,
    grantedAt: now,
  }));

  let perms: typeof kvStorePermissions.$inferSelect[] = [];
  if (permValues.length > 0) {
    perms = await db.insert(kvStorePermissions).values(permValues).returning();
  }

  return apiResponse(
    {
      data: {
        id: entry.id,
        key: entry.key,
        value: entry.value,
        ownerId: entry.ownerId,
        permissions: buildAccessPayload(perms),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    },
    201,
    req
  );
});
