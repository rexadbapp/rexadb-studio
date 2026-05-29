import { users } from '@/db/schema';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireUser } from '@/lib/db-helpers';
import { bcrypt } from '@/lib/bcrypt';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const disableSchema = z.object({
  password: z.string().min(1),
});

export const DELETE = withHandler(async ({ user, db, req }) => {
  const body = disableSchema.parse(await req.json());
  const existing = await requireUser(db, user.id);

  if (existing.passwordHash) {
    const valid = await bcrypt.compare(body.password, existing.passwordHash);
    if (!valid) throw new AppError('Invalid password', 401);
  }

  await db.update(users).set({ totpSecret: null, totpEnabled: false }).where(eq(users.id, user.id));

  return apiResponse({ data: { success: true } }, 200, req);
}, { rateLimit: { max: 5, windowMs: 60000 } });
