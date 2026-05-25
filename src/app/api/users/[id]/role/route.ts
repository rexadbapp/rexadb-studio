import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { users, roles } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  roleId: z.number().int().positive(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await authenticate(req);
    await requirePermission(caller.id, 'roles.assign');

    const db = getDb();
    const { id } = await params;
    const body = schema.parse(await req.json());

    const target = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) throw new AppError('User not found', 404);

    const role = await db.query.roles.findFirst({ where: eq(roles.id, body.roleId) });
    if (!role) throw new AppError('Role not found', 404);

    await db.update(users).set({ roleId: body.roleId }).where(eq(users.id, id));

    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
