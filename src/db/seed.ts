import { getDb } from './index';
import { permissions, roles, rolePermissions, users } from './schema';
import { PERMISSIONS } from '@/permissions';
import { DEFAULT_ROLES } from '@/config/roles';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export async function seed(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  const existingPerms = await db.select({ code: permissions.code }).from(permissions);
  const existingCodes = new Set(existingPerms.map((p) => p.code));

  for (const perm of PERMISSIONS) {
    if (!existingCodes.has(perm.code)) {
      await db.insert(permissions).values({
        code: perm.code,
        name: perm.name,
        description: perm.description,
        createdAt: now,
      });
    }
  }

  const allPerms = await db.select().from(permissions);
  const codeToId = new Map(allPerms.map((p) => [p.code, p.id]));

  for (const roleDef of DEFAULT_ROLES) {
    const existing = await db.query.roles.findFirst({
      where: eq(roles.name, roleDef.name),
    });

    const permIds = roleDef.permissions
      .map((code) => codeToId.get(code))
      .filter((id): id is number => id !== undefined);

    if (existing) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, existing.id));
      if (permIds.length > 0) {
        await db.insert(rolePermissions).values(
          permIds.map((permissionId) => ({ roleId: existing.id, permissionId }))
        );
      }
      continue;
    }

    const [role] = await db
      .insert(roles)
      .values({
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
        createdAt: now,
      })
      .returning();

    if (permIds.length > 0) {
      await db.insert(rolePermissions).values(
        permIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        }))
      );
    }
  }

  const adminRole = await db.query.roles.findFirst({
    where: eq(roles.name, 'admin'),
  });

  if (adminRole) {
    const adminId = process.env.ADMIN_ID ?? crypto.randomUUID();
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@rexadb.local';
    const adminExists = await db.query.users.findFirst({
      where: eq(users.email, adminEmail),
    });

    if (!adminExists) {
      await db.insert(users).values({
        id: adminId,
        email: adminEmail,
        name: 'Admin',
        roleId: adminRole.id,
        isActive: true,
        createdAt: now,
      });
    }
  }
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seed()
    .then(() => {
      console.log('Seed completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
