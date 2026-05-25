import { ZodError } from 'zod';
import { auditLog } from './audit';
import type { NextRequest } from 'next/server';
import { verifyStudioToken } from './auth';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

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
      resBody: data,
      userId: extractUserId(req),
    });
  }
  return Response.json(data, { status });
}

export function apiError(error: unknown, req?: NextRequest): Response {
  const meta = reqMeta(req);

  if (error instanceof ZodError) {
    const body = { error: 'Validation failed', issues: error.issues };
    auditLog({
      ts: Date.now(),
      method: meta.method ?? 'UNKNOWN',
      url: meta.url ?? '',
      status: 400,
      reqHeaders: meta.headers,
      resBody: body,
      userId: extractUserId(req),
    });
    return Response.json(body, { status: 400 });
  }

  if (error instanceof AppError) {
    auditLog({
      ts: Date.now(),
      method: meta.method ?? 'UNKNOWN',
      url: meta.url ?? '',
      status: error.statusCode,
      reqHeaders: meta.headers,
      resBody: { error: error.message, code: error.code },
      userId: extractUserId(req),
    });
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error('Unhandled error:', error);

  auditLog({
    ts: Date.now(),
    method: meta.method ?? 'UNKNOWN',
    url: meta.url ?? '',
    status: 500,
    reqHeaders: meta.headers,
    resBody: { error: message },
    userId: extractUserId(req),
  });
  return Response.json({ error: message }, { status: 500 });
}
