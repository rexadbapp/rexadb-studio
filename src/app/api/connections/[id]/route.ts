import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { connections } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'connections.read');

    const { id } = await params;
    const conn = await db.query.connections.findFirst({ where: eq(connections.id, id) });
    if (!conn) throw new AppError('Connection not found', 404);

    const { encryptedPassword, host, port, database, username, ...safe } = conn;
    return apiResponse({ data: safe }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'connections.update');

    const { id } = await params;
    const body = updateSchema.parse(await req.json());

    const existing = await db.query.connections.findFirst({ where: eq(connections.id, id) });
    if (!existing) throw new AppError('Connection not found', 404);

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
  } catch (err) {
    return apiError(err, req);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'connections.delete');

    const { id } = await params;
    const existing = await db.query.connections.findFirst({ where: eq(connections.id, id) });
    if (!existing) throw new AppError('Connection not found', 404);

    await db.delete(connections).where(eq(connections.id, id));
    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
