import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import { generateSecret, generateURI } from 'otplib';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);

    const secret = generateSecret();
    const otpauth = generateURI({ issuer: 'RexaDB Studio', label: user.email, secret });

    const db = getDb();
    await db.update(users).set({ totpSecret: secret }).where(eq(users.id, user.id));

    return apiResponse({
      data: {
        secret,
        otpauth,
      },
    }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
