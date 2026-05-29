import { invites, users } from '@/db/schema';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { eq } from 'drizzle-orm';
import { generateStudioToken } from '@/lib/auth';
import crypto from 'node:crypto';
import { bcrypt } from '@/lib/bcrypt';
import { z } from 'zod';

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
});

export const POST = withHandler(async ({ req, db }) => {
  const { token, name, email } = acceptSchema.parse(await req.json());

  const pendingInvites = await db.query.invites.findMany({
    where: eq(invites.status, 'PENDING'),
  });

  let matchedInvite = null;
  for (const pending of pendingInvites) {
    const isValid = await bcrypt.compare(token, pending.tokenHash);
    if (isValid) {
      matchedInvite = pending;
      break;
    }
  }

  if (!matchedInvite) {
    throw new AppError('Invalid or expired token', 400);
  }

  if (matchedInvite.email.toLowerCase() !== email.toLowerCase()) {
    throw new AppError('Email does not match invitation', 400);
  }

  const now = new Date().toISOString();
  await db
    .update(invites)
    .set({
      status: 'ACCEPTED',
      acceptedAt: now,
    })
    .where(eq(invites.id, matchedInvite.id));

  let existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  let userId: string;
  if (existingUser) {
    await db
      .update(users)
      .set({ name })
      .where(eq(users.id, existingUser.id));
    userId = existingUser.id;
  } else {
    const roleId = matchedInvite.roleId;
    userId = crypto.randomUUID();

    await db
      .insert(users)
      .values({
        id: userId,
        email,
        name,
        roleId,
        isActive: true,
        createdAt: now,
      });
  }

  const studioToken = generateStudioToken(userId);

  return apiResponse({
    data: {
      userId,
      studioToken,
    },
  }, 200, req);
}, { auth: false, rateLimit: { max: 10, windowMs: 60000 } });
