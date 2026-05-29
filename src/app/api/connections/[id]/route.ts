import { connections } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireConnection } from '@/lib/db-helpers';
import { encrypt } from '@/lib/encryption';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().optional(),
  ssl: z.boolean().optional(),
});

export const GET = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'connections.read');
  const conn = await requireConnection(db, id);
  const { encryptedPassword, host, port, database, username, ...safe } = conn;
  return apiResponse({ data: safe }, 200, req);
});

export const PUT = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'connections.update');
  const body = updateSchema.parse(await req.json());
  await requireConnection(db, id);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.host !== undefined) updates.host = body.host;
  if (body.port !== undefined) updates.port = body.port;
  if (body.database !== undefined) updates.database = body.database;
  if (body.username !== undefined) updates.username = body.username;
  if (body.password !== undefined) updates.encryptedPassword = encrypt(body.password);
  if (body.ssl !== undefined) updates.ssl = body.ssl;

  await db.update(connections).set(updates).where(eq(connections.id, id));

  const updated = await db.query.connections.findFirst({ where: eq(connections.id, id) });
  if (!updated) throw new AppError('Connection not found after update', 500);
  const { encryptedPassword, host, port, database, username, ...safe } = updated;
  return apiResponse({ data: safe }, 200, req);
});

export const DELETE = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'connections.delete');
  await requireConnection(db, id);
  await db.delete(connections).where(eq(connections.id, id));
  return apiResponse({ data: { success: true } }, 200, req);
});
