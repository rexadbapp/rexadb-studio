import { users } from '@/db/schema';
import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { eq } from 'drizzle-orm';
import { generateSecret, generateURI } from 'otplib';

export const POST = withHandler(async ({ user, db }) => {
  const secret = generateSecret();
  const otpauth = generateURI({ issuer: 'RexaDB Studio', label: user.email, secret });

  await db.update(users).set({ totpSecret: secret }).where(eq(users.id, user.id));

  return apiResponse({
    data: {
      secret,
      otpauth,
    },
  }, 200);
}, { rateLimit: { max: 5, windowMs: 60000 } });
