import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { users, invites } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await authenticate(req);
    await requirePermission(caller.id, 'users.manage');

    const db = getDb();
    const { id } = await params;
    const body = updateSchema.parse(await req.json());

    const target = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) throw new AppError('User not found', 404);

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, id));
    }

    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await authenticate(req);
    await requirePermission(caller.id, 'users.manage');

    const db = getDb();
    const { id } = await params;

    const target = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) throw new AppError('User not found', 404);

    await db.delete(invites).where(eq(invites.createdBy, id));
    await db.delete(users).where(eq(users.id, id));

    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
