import { users } from '@/db/schema';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireUser } from '@/lib/db-helpers';
import { eq } from 'drizzle-orm';
import { verify } from 'otplib';
import { z } from 'zod';

const verifySchema = z.object({
  code: z.string().min(1),
});

export const POST = withHandler(async ({ user, db, req }) => {
  const body = verifySchema.parse(await req.json());
  const existing = await requireUser(db, user.id);
  if (!existing.totpSecret) throw new AppError('TOTP not initialized. Call setup first.', 400);

  const result = await verify({ token: body.code, secret: existing.totpSecret });
  if (!result.valid) throw new AppError('Invalid TOTP code', 400);

  await db.update(users).set({ totpEnabled: true }).where(eq(users.id, user.id));

  return apiResponse({ data: { success: true } }, 200, req);
}, { rateLimit: { max: 10, windowMs: 60000 } });
