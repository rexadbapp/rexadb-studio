import { roles, rolePermissions } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const GET = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'permissions.view');

  const all = await db.query.roles.findMany({
    with: {
      rolePermissions: {
        with: { permission: true },
      },
      users: { columns: { id: true, email: true, name: true } },
    },
    orderBy: (r, { asc }) => [asc(r.name)],
  });

  const result = all.map((role) => ({
    ...role,
    permissions: role.rolePermissions.map((rp) => rp.permission),
    userCount: role.users.length,
  }));

  return apiResponse({ data: result }, 200, req);
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  permissionIds: z.array(z.number()).min(1),
});

export const POST = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'roles.manage');

  const body = createSchema.parse(await req.json());

  const existing = await db.query.roles.findFirst({
    where: eq(roles.name, body.name),
  });
  if (existing) throw new AppError('Role already exists', 409);

  const now = new Date().toISOString();
  const [role] = await db
    .insert(roles)
    .values({
      name: body.name,
      description: body.description,
      isSystem: false,
      createdAt: now,
    })
    .returning();

  if (body.permissionIds.length > 0) {
    await db.insert(rolePermissions).values(
      body.permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      }))
    );
  }

  return apiResponse({ data: role }, 201, req);
});
