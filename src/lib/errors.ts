import { ZodError } from 'zod';
import { auditLog } from './audit';
import type { NextRequest } from 'next/server';
import { verifyStudioToken } from './auth';
import { AppError } from './app-error';

export { AppError };

function extractUserId(req?: NextRequest): string | undefined {
  if (!req) return undefined;
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return undefined;
  const payload = verifyStudioToken(header.slice(7));
  if (!payload) return undefined;
  return typeof payload.sub === 'string'
    ? payload.sub
    : (payload.sub as Record<string, unknown>)?.id as string | undefined;
}

function reqMeta(req?: NextRequest) {
  if (!req) return {};
  return {
    url: req.nextUrl?.pathname ?? req.url,
    method: req.method,
    headers: {
      authorization: req.headers.get('authorization')?.slice(0, 40),
      'content-type': req.headers.get('content-type') ?? undefined,
    },
  };
}

const SENSITIVE_PATTERNS = [
  '/api/auth/login',
  '/api/auth/login/totp',
  '/api/auth/totp/verify',
  '/api/invites/accept',
  '/api/connections/',
];

function shouldOmitBody(url: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => url.startsWith(p) || url === p);
}

export function apiResponse(data: unknown, status = 200, req?: NextRequest): Response {
  const meta = reqMeta(req);
  const url = meta.url ?? '';
  if (url !== '/api/audit-logs') {
    auditLog({
      ts: Date.now(),
      method: meta.method ?? 'UNKNOWN',
      url,
      status,
      reqHeaders: meta.headers,
      resBody: shouldOmitBody(url) ? undefined : data,
      userId: extractUserId(req),
    });
  }
  return Response.json(data, { status });
}

function respondWithAudit(status: number, body: Record<string, unknown>, meta: ReturnType<typeof reqMeta>, req?: NextRequest): Response {
  auditLog({
    ts: Date.now(), method: meta.method ?? 'UNKNOWN', url: meta.url ?? '',
    status, reqHeaders: meta.headers, resBody: body, userId: extractUserId(req),
  });
  return Response.json(body, { status });
}

export function apiError(error: unknown, req?: NextRequest): Response {
  const meta = reqMeta(req);

  if (error instanceof ZodError) {
    return respondWithAudit(400, { error: 'Validation failed', issues: error.issues }, meta, req);
  }

  if (error instanceof AppError) {
    return respondWithAudit(error.statusCode, { error: error.message, code: error.code }, meta, req);
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error('Unhandled error:', error);
  return respondWithAudit(500, { error: message }, meta, req);
}
