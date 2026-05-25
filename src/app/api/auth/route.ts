import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    return apiResponse({ user }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}