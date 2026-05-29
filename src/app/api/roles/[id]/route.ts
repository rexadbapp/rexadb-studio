import { roles, rolePermissions } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const GET = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'permissions.view');

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
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.number()).min(1).optional(),
});

async function validateRoleUpdate(db: any, body: { name?: string }, role: { name: string }) {
  if (!body.name || body.name === role.name) return;
  const dup = await db.query.roles.findFirst({ where: eq(roles.name, body.name) });
  if (dup) throw new AppError('Role name already taken', 409);
}

async function applyRoleUpdate(db: any, roleId: number, body: z.infer<typeof updateSchema>) {
  if (body.name || body.description !== undefined) {
    const fields: Record<string, unknown> = {};
    if (body.name) fields.name = body.name;
    if (body.description !== undefined) fields.description = body.description;
    await db.update(roles).set(fields).where(eq(roles.id, roleId));
  }

  if (body.permissionIds) {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    await db.insert(rolePermissions).values(body.permissionIds.map(permissionId => ({ roleId, permissionId })));
  }
}

export const PUT = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'roles.manage');
  const roleId = Number(id);
  const body = updateSchema.parse(await req.json());

  const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
  if (!role) throw new AppError('Role not found', 404);

  await validateRoleUpdate(db, body, role);
  await applyRoleUpdate(db, roleId, body);

  const updated = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
    with: { rolePermissions: { with: { permission: true } } },
  });
  return apiResponse({
    data: { ...updated, permissions: updated?.rolePermissions.map((rp) => rp.permission) ?? [] },
  }, 200, req);
});

export const DELETE = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'roles.manage');

  const roleId = Number(id);

  const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
  if (!role) throw new AppError('Role not found', 404);
  if (role.isSystem) throw new AppError('Cannot delete a system role', 403);

  await db.delete(roles).where(eq(roles.id, roleId));
  return apiResponse({ data: { success: true } }, 200, req);
});
