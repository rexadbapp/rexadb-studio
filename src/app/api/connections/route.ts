import { connections, connectionAccess, teamMembers } from '@/db/schema';
import { requirePermission, hasPermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { encrypt } from '@/lib/encryption';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'node:crypto';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['postgres', 'mysql', 'mariadb', 'mssql', 'cockroachdb', 'yugabyte', 'redshift']),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string(),
  ssl: z.boolean().optional().default(false),
});

export const GET = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'connections.read');
  const canSeeAll = await hasPermission(user.id, 'connections.manage_access');

  let list;
  if (canSeeAll) {
    list = await db.query.connections.findMany({
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });
  } else {
    const roleAccess = await db.query.connectionAccess.findMany({
      where: eq(connectionAccess.roleId, user.roleId),
      columns: { connectionId: true },
    });
    let ids = roleAccess.map((a) => a.connectionId);

    const userTeams = await db.query.teamMembers.findMany({
      where: eq(teamMembers.userId, user.id),
      columns: { teamId: true },
    });
    if (userTeams.length > 0) {
      const teamIds = userTeams.map(t => t.teamId);
      const teamAccess = await db.query.connectionAccess.findMany({
        where: and(isNotNull(connectionAccess.teamId), inArray(connectionAccess.teamId, teamIds)),
        columns: { connectionId: true },
      });
      ids = [...ids, ...teamAccess.map((a) => a.connectionId)];
    }

    ids = [...new Set(ids)];
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
});

export const POST = withHandler(async ({ req, user, db }) => {
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
});
