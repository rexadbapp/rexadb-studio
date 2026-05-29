import { users } from '@/db/schema';
import { generateStudioToken, generateTempToken } from '@/lib/auth';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { bcrypt } from '@/lib/bcrypt';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = withHandler(async ({ req, db }) => {
  const body = loginSchema.parse(await req.json());

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
}, { auth: false, rateLimit: { max: 10, windowMs: 60000 } });
