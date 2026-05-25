import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { invites } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(req);
    await requirePermission(user.id, 'invites.revoke');

    const db = getDb();
    const { id } = await params;
    const inviteId = Number(id);

    const invite = await db.query.invites.findFirst({ where: eq(invites.id, inviteId) });
    if (!invite) throw new AppError('Invite not found', 404);
    if (invite.status !== 'PENDING') throw new AppError('Invite is no longer pending', 400);

    const now = new Date().toISOString();
    await db
      .update(invites)
      .set({ status: 'REVOKED' })
      .where(eq(invites.id, inviteId));

    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
