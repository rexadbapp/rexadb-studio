import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { roles, rolePermissions } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'permissions.view');

    const { id } = await params;
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, Number(id)),
      with: {
        rolePermissions: { with: { permission: true } },
        users: { columns: { id: true, email: true, name: true } },
      },
    });
    if (!role) throw new AppError('Role not found', 404);

    return apiResponse({
      data: {
        ...role,
        permissions: role.rolePermissions.map((rp) => rp.permission),
        users: role.users,
      },
    }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.number()).min(1).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'roles.manage');

    const { id } = await params;
    const roleId = Number(id);
    const body = updateSchema.parse(await req.json());

    const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
    if (!role) throw new AppError('Role not found', 404);

    if (body.name && body.name !== role.name) {
      const dup = await db.query.roles.findFirst({ where: eq(roles.name, body.name) });
      if (dup) throw new AppError('Role name already taken', 409);
    }

    if (body.name || body.description !== undefined) {
      await db
        .update(roles)
        .set({
          ...(body.name && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
        })
        .where(eq(roles.id, roleId));
    }

    if (body.permissionIds) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      await db.insert(rolePermissions).values(
        body.permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        }))
      );
    }

    const updated = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
      with: { rolePermissions: { with: { permission: true } } },
    });

    return apiResponse({
      data: {
        ...updated,
        permissions: updated?.rolePermissions.map((rp) => rp.permission) ?? [],
      },
    }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'roles.manage');

    const { id } = await params;
    const roleId = Number(id);

    const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
    if (!role) throw new AppError('Role not found', 404);
    if (role.isSystem) throw new AppError('Cannot delete a system role', 403);

    await db.delete(roles).where(eq(roles.id, roleId));
    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
