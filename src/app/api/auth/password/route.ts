import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { bcrypt } from '@/lib/bcrypt';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const setPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    const body = setPasswordSchema.parse(await req.json());

    const db = getDb();
    const existing = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    if (!existing) throw new AppError('User not found', 404);

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
  } catch (err) {
    return apiError(err, req);
  }
}
