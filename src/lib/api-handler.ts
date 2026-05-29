import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { authenticate, UserPayload } from '@/lib/auth';
import { apiError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limiter';

type HandlerContext<P extends Record<string, string> = Record<string, string>> = {
  req: NextRequest;
  params: P;
  user: UserPayload;
  db: ReturnType<typeof getDb>;
};

type HandlerOptions = {
  auth?: boolean;
  rateLimit?: { max: number; windowMs: number };
};

export function withHandler<P extends Record<string, string> = Record<string, string>>(
  handler: (ctx: HandlerContext<P>) => Promise<Response>,
  options?: HandlerOptions
): (req: NextRequest, context: { params: Promise<P> }) => Promise<Response> {
  return async (req, context) => {
    try {
      if (options?.rateLimit) {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? req.headers.get('x-real-ip')
          ?? 'unknown';
        const key = `${req.method}:${req.nextUrl.pathname}:${ip}`;
        checkRateLimit(key, options.rateLimit.max, options.rateLimit.windowMs);
      }

      const db = getDb();
      const resolvedParams = await context.params;
      const user = options?.auth !== false ? await authenticate(req) : undefined;
      return await handler({ req, params: resolvedParams, user: user as UserPayload, db });
    } catch (err) {
      return apiError(err, req);
    }
  };
}
