import { invites } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { eq } from 'drizzle-orm';

export const POST = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'invites.revoke');

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
});
