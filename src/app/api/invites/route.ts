import { invites } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import crypto from 'node:crypto';
import { bcrypt } from '@/lib/bcrypt';
import { z } from 'zod';

const inviteCreateSchema = z.object({
  email: z.string().email(),
  roleId: z.number().int().positive().optional(),
});

export const GET = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'invites.view');

  const allInvites = await db.query.invites.findMany({
    with: {
      createdByUser: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
        with: {
          role: { columns: { id: true, name: true } },
        },
      },
    },
    orderBy: (i, { desc }) => [desc(i.createdAt)],
  });

  const safeInvites = allInvites.map(invite => ({
    id: invite.id,
    email: invite.email,
    status: invite.status,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    acceptedAt: invite.acceptedAt,
    createdBy: invite.createdByUser,
  }));

  return apiResponse({ data: safeInvites }, 200, req);
});

export const POST = withHandler(async ({ req, user, db }) => {
  await requirePermission(user.id, 'invites.create');

  const body = await req.json();
  const result = inviteCreateSchema.safeParse(body);
  if (!result.success) {
    throw new AppError('Invalid request body', 400);
  }
  const { email, roleId } = result.data;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(token, 10);

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [invite] = await db
    .insert(invites)
    .values({
      tokenHash,
      email,
      roleId: roleId ?? 1,
      status: 'PENDING',
      expiresAt,
      createdBy: user.id,
      createdAt: now,
    })
    .returning();

  return apiResponse({
    data: {
      id: invite.id,
      email: invite.email,
      token,
      expiresAt,
    },
  }, 201, req);
}, { rateLimit: { max: 20, windowMs: 60000 } });
