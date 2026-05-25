import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { connections, connectionAccess, rolePermissions, permissions } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { encrypt } from '@/lib/encryption';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'node:crypto';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['postgres', 'mysql']),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string(),
  ssl: z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'connections.read');

    const managePerm = await db
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

    const canSeeAll = managePerm.length > 0;

    let list;
    if (canSeeAll) {
      list = await db.query.connections.findMany({
        orderBy: (c, { desc }) => [desc(c.createdAt)],
      });
    } else {
      const accessRows = await db.query.connectionAccess.findMany({
        where: eq(connectionAccess.roleId, user.roleId),
        columns: { connectionId: true },
      });
      const ids = accessRows.map((a) => a.connectionId);
      if (ids.length === 0) return apiResponse({ data: [] }, 200, req);

      list = await db.query.connections.findMany({
        where: inArray(connections.id, ids),
        orderBy: (c, { desc }) => [desc(c.createdAt)],
      });
    }

    const clean = (c: typeof list[number]) => {
      const { encryptedPassword, host, port, database, username, ...rest } = c;
      return rest;
    };
    const result = list.map(clean);
    return apiResponse({ data: result }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'connections.create');

    const body = createSchema.parse(await req.json());
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const encryptedPassword = encrypt(body.password);

    const [conn] = await db
      .insert(connections)
      .values({
        id,
        name: body.name,
        type: body.type,
        host: body.host,
        port: body.port,
        database: body.database,
        username: body.username,
        encryptedPassword,
        ssl: body.ssl,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const { encryptedPassword: _ep, host: _h, port: _p, database: _db, username: _u, ...safe } = conn;
    return apiResponse({ data: safe }, 201, req);
  } catch (err) {
    return apiError(err, req);
  }
}
