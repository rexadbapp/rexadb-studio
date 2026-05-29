import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { kvStore, kvStorePermissions } from '@/db/schema';
import { authenticate, UserPayload } from '@/lib/auth';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { checkKvAccess, requireKvAccess, buildAccessPayload } from '@/lib/kv-access';

const updateValueSchema = z.object({
  key: z.string().min(1).max(500).optional(),
  value: z.string().optional(),
});

const permissionSchema = z.object({
  action: z.enum(['read', 'write_value', 'manage_permissions', 'delete']),
  type: z.enum(['user', 'role', 'team', 'studio', 'public']),
  id: z.string().optional(),
});

const updatePermissionsSchema = z.object({
  permissions: z.array(permissionSchema),
});

async function fetchEntry(id: string) {
  const db = getDb();
  const entry = await db.query.kvStore.findFirst({
    where: eq(kvStore.id, id),
    with: { permissions: true },
  });
  if (!entry) throw new AppError('Key-value entry not found', 404);
  return entry;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    let userId: string | undefined;
    try {
      const u = await authenticate(req);
      userId = u.id;
    } catch {
      userId = undefined;
    }

    await requireKvAccess(id, userId, 'read');
    const entry = await fetchEntry(id);

    return apiResponse(
      {
        data: {
          id: entry.id,
          key: entry.key,
          value: entry.value,
          ownerId: entry.ownerId,
          permissions: buildAccessPayload(entry.permissions),
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
      },
      200,
      req
    );
  } catch (err) {
    return apiError(err, req);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    const { id } = await params;

    const body = await req.json();
    const isOwner = await db.query.kvStore.findFirst({
      where: and(eq(kvStore.id, id), eq(kvStore.ownerId, user.id)),
      columns: { id: true },
    });

    const valueUpdate = updateValueSchema.safeParse(body);
    const permUpdate = updatePermissionsSchema.safeParse(body);

    let hasValueChange = false;
    let hasPermChange = false;

    if (valueUpdate.success) {
      const { key, value } = valueUpdate.data;
      hasValueChange = key !== undefined || value !== undefined;
    }
    if (permUpdate.success) {
      hasPermChange = true;
    }

    if (!hasValueChange && !hasPermChange) {
      throw new AppError('No fields to update', 400);
    }

    if (hasValueChange) {
      await requireKvAccess(id, user.id, 'write_value');
    }
    if (hasPermChange && !isOwner) {
      await requireKvAccess(id, user.id, 'manage_permissions');
    }

    const now = new Date().toISOString();

    if (hasValueChange && valueUpdate.success) {
      const updates: Record<string, unknown> = { updatedAt: now };
      if (valueUpdate.data.key !== undefined) {
        updates.key = valueUpdate.data.key;
      }
      if (valueUpdate.data.value !== undefined) {
        updates.value = valueUpdate.data.value;
      }
      await db.update(kvStore).set(updates).where(eq(kvStore.id, id));
    }

    if (hasPermChange && permUpdate.success) {
      await db.delete(kvStorePermissions).where(eq(kvStorePermissions.kvId, id));

      const permValues = permUpdate.data.permissions.map((p) => ({
        kvId: id,
        action: p.action,
        granteeType: p.type,
        granteeId: p.id ?? null,
        grantedBy: user.id,
        grantedAt: now,
      }));

      if (permValues.length > 0) {
        await db.insert(kvStorePermissions).values(permValues).returning();
      }
    }

    const entry = await fetchEntry(id);
    return apiResponse(
      {
        data: {
          id: entry.id,
          key: entry.key,
          value: entry.value,
          ownerId: entry.ownerId,
          permissions: buildAccessPayload(entry.permissions),
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
      },
      200,
      req
    );
  } catch (err) {
    return apiError(err, req);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    const { id } = await params;

    await requireKvAccess(id, user.id, 'delete');
    await db.delete(kvStore).where(eq(kvStore.id, id));
    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
