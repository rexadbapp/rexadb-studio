import { getDb } from '@/db';
import { kvStore, kvStorePermissions } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requireKvAccess, buildAccessPayload, kvPermissionSchema } from '@/lib/kv-access';

const updateValueSchema = z.object({
  key: z.string().min(1).max(500).optional(),
  value: z.string().optional(),
});

const updatePermissionsSchema = z.object({
  permissions: z.array(kvPermissionSchema),
});

function formatKvEntry(entry: typeof kvStore.$inferSelect & { permissions: typeof kvStorePermissions.$inferSelect[] }) {
  return {
    id: entry.id,
    key: entry.key,
    value: entry.value,
    ownerId: entry.ownerId,
    permissions: buildAccessPayload(entry.permissions),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

async function fetchEntry(db: ReturnType<typeof getDb>, id: string) {
  const entry = await db.query.kvStore.findFirst({
    where: eq(kvStore.id, id),
    with: { permissions: true },
  });
  if (!entry) throw new AppError('Key-value entry not found', 404);
  return entry;
}

export const GET = withHandler(async ({ req, params: { id } }) => {
  let userId: string | undefined;
  try {
    const u = await authenticate(req);
    userId = u.id;
  } catch {
    userId = undefined;
  }

  await requireKvAccess(id, userId, 'read');
  const entry = await fetchEntry(getDb(), id);

  return apiResponse({ data: formatKvEntry(entry) }, 200, req);
}, { auth: false });

async function applyValueUpdate(db: ReturnType<typeof getDb>, id: string, data: z.infer<typeof updateValueSchema>, now: string) {
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.key !== undefined) updates.key = data.key;
  if (data.value !== undefined) updates.value = data.value;
  await db.update(kvStore).set(updates).where(eq(kvStore.id, id));
}

async function applyPermissionUpdate(db: ReturnType<typeof getDb>, id: string, userId: string, permissions: z.infer<typeof kvPermissionSchema>[], now: string) {
  await db.delete(kvStorePermissions).where(eq(kvStorePermissions.kvId, id));
  const permValues = permissions.map((p) => ({
    kvId: id, action: p.action, granteeType: p.type, granteeId: p.id ?? null, grantedBy: userId, grantedAt: now,
  }));
  if (permValues.length > 0) {
    await db.insert(kvStorePermissions).values(permValues).returning();
  }
}

export const PUT = withHandler(async ({ req, params: { id }, user, db }) => {
  const body = await req.json();
  const isOwner = await db.query.kvStore.findFirst({
    where: and(eq(kvStore.id, id), eq(kvStore.ownerId, user.id)),
    columns: { id: true },
  });

  const valueUpdate = updateValueSchema.safeParse(body);
  const permUpdate = updatePermissionsSchema.safeParse(body);
  const hasValueChange = valueUpdate.success && (valueUpdate.data.key !== undefined || valueUpdate.data.value !== undefined);
  const hasPermChange = permUpdate.success;

  if (!hasValueChange && !hasPermChange) throw new AppError('No fields to update', 400);

  if (hasValueChange) await requireKvAccess(id, user.id, 'write_value');
  if (hasPermChange && !isOwner) await requireKvAccess(id, user.id, 'manage_permissions');

  const now = new Date().toISOString();

  if (hasValueChange) await applyValueUpdate(db, id, valueUpdate.data!, now);
  if (hasPermChange) await applyPermissionUpdate(db, id, user.id, permUpdate.data!.permissions, now);

  const entry = await fetchEntry(db, id);
  return apiResponse({ data: formatKvEntry(entry) }, 200, req);
});

export const DELETE = withHandler(async ({ req, params: { id }, user, db }) => {
  await requireKvAccess(id, user.id, 'delete');
  await db.delete(kvStore).where(eq(kvStore.id, id));
  return apiResponse({ data: { success: true } }, 200, req);
});
