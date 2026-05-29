import { users } from '@/db/schema';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireUser } from '@/lib/db-helpers';
import { bcrypt } from '@/lib/bcrypt';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const setPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128),
});

export const POST = withHandler(async ({ user, db, req }) => {
  const body = setPasswordSchema.parse(await req.json());
  const existing = await requireUser(db, user.id);

  if (existing.passwordHash) {
    if (!body.currentPassword) {
      throw new AppError('Current password is required to change password', 400);
    }
    const valid = await bcrypt.compare(body.currentPassword, existing.passwordHash);
    if (!valid) throw new AppError('Current password is incorrect', 401);
  }

  const hash = await bcrypt.hash(body.newPassword, 10);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.id));

  return apiResponse({ data: { success: true } }, 200, req);
}, { rateLimit: { max: 5, windowMs: 60000 } });
