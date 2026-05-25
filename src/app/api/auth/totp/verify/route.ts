import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import { verify } from 'otplib';
import { z } from 'zod';

const verifySchema = z.object({
  code: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);

    const body = verifySchema.parse(await req.json());

    const db = getDb();
    const existing = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    if (!existing) throw new AppError('User not found', 404);
    if (!existing.totpSecret) throw new AppError('TOTP not initialized. Call setup first.', 400);

    const result = await verify({ token: body.code, secret: existing.totpSecret });
    if (!result.valid) throw new AppError('Invalid TOTP code', 400);

    await db.update(users).set({ totpEnabled: true }).where(eq(users.id, user.id));

    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
