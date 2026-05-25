import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { generateStudioToken, generateTempToken } from '@/lib/auth';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { bcrypt } from '@/lib/bcrypt';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());

    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });

    if (!user) throw new AppError('Invalid email or password', 401);
    if (!user.isActive) throw new AppError('Account is deactivated', 403);

    if (!user.passwordHash) throw new AppError('No password set for this account', 400);

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) throw new AppError('Invalid email or password', 401);

    if (user.totpEnabled && user.totpSecret) {
      const tempToken = generateTempToken(user.id);
      return apiResponse({ data: { step: 'totp', tempToken } }, 200, req);
    }

    const studioToken = generateStudioToken(user.id);
    return apiResponse({ data: { studioToken } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
