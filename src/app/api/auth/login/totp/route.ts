import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { generateStudioToken, verifyTempToken } from '@/lib/auth';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import { verify } from 'otplib';
import { z } from 'zod';

const totpSchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = totpSchema.parse(await req.json());

    const payload = verifyTempToken(body.tempToken);
    if (!payload) throw new AppError('Invalid or expired temporary token', 401);

    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user) throw new AppError('User not found', 404);
    if (!user.totpSecret) throw new AppError('TOTP not configured', 400);

    const result = await verify({ token: body.code, secret: user.totpSecret });
    if (!result.valid) throw new AppError('Invalid TOTP code', 401);

    const studioToken = generateStudioToken(user.id);
    return apiResponse({ data: { studioToken } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
