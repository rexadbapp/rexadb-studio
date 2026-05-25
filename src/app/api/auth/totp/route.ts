import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { bcrypt } from '@/lib/bcrypt';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const disableSchema = z.object({
  password: z.string().min(1),
});

export async function DELETE(req: NextRequest) {
  try {
    const user = await authenticate(req);

    const body = disableSchema.parse(await req.json());

    const db = getDb();
    const existing = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    if (!existing) throw new AppError('User not found', 404);

    if (existing.passwordHash) {
      const valid = await bcrypt.compare(body.password, existing.passwordHash);
      if (!valid) throw new AppError('Invalid password', 401);
    }

    await db.update(users).set({ totpSecret: null, totpEnabled: false }).where(eq(users.id, user.id));

    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
