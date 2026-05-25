import { NextRequest } from 'next/server';
import { AppError } from './errors';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sign, verify, JwtPayload } from 'jsonwebtoken';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  roleId: number;
  isActive: boolean;
}

interface VerifiedToken {
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Verify a studio session token and return the payload if valid.
 * @param token - The JWT token to verify
 * @returns The decoded payload if valid, otherwise null
 */
export function verifyStudioToken(token: string): VerifiedToken | null {
  const studioSecret = process.env.STUDIO_JWT_SECRET ?? '';
  if (!studioSecret) return null;
  try {
    const decoded = verify(token, studioSecret);
    if (typeof decoded === 'object' && decoded !== null && 'sub' in decoded && typeof decoded.sub === 'string') {
      return {
        sub: decoded.sub,
        iat: decoded.iat as number,
        exp: decoded.exp as number,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a studio session token for a given user ID.
 * @param userId - The studio user ID to encode in the token
 * @returns A signed JWT token
 */
export function generateStudioToken(userId: string): string {
  const studioSecret = process.env.STUDIO_JWT_SECRET ?? '';
  if (!studioSecret) {
    throw new AppError('STUDIO_JWT_SECRET must be set in environment variables', 500);
  }
  const payload = { sub: userId };
  const options = { expiresIn: 30 * 24 * 60 * 60 }; // 30 days in seconds
  return sign(payload, studioSecret, options);
}

export function generateTempToken(userId: string): string {
  const studioSecret = process.env.STUDIO_JWT_SECRET ?? '';
  if (!studioSecret) {
    throw new AppError('STUDIO_JWT_SECRET must be set in environment variables', 500);
  }
  const payload = { sub: userId, purpose: 'totp' };
  const options = { expiresIn: 5 * 60 }; // 5 minutes
  return sign(payload, studioSecret, options);
}

export function verifyTempToken(token: string): { userId: string } | null {
  const studioSecret = process.env.STUDIO_JWT_SECRET ?? '';
  if (!studioSecret) return null;
  try {
    const decoded = verify(token, studioSecret);
    if (typeof decoded === 'object' && decoded !== null && decoded.purpose === 'totp' && typeof decoded.sub === 'string') {
      return { userId: decoded.sub };
    }
    return null;
  } catch {
    return null;
  }
}

export async function authenticate(req: NextRequest): Promise<UserPayload> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('Missing or invalid Authorization header', 401);
  }

  const token = header.slice(7);
  const payload = verifyStudioToken(token);
  if (!payload) {
    throw new AppError('Invalid or expired token', 401);
  }

  const userId: string = payload.sub;

  if (!userId || typeof userId !== 'string') {
    throw new AppError('Invalid token payload', 401);
  }

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403);
  }

  return user;
}