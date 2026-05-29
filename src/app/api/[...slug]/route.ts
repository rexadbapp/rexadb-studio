import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';

const LOG_FILE = process.env.AUDIT_LOG_FILE ?? join(process.cwd(), 'data', 'audit-logs.jsonl');

export const runtime = 'nodejs';

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
export async function PUT(req: NextRequest) { return handle(req); }
export async function PATCH(req: NextRequest) { return handle(req); }
export async function DELETE(req: NextRequest) { return handle(req); }
export async function OPTIONS(req: NextRequest) { return handle(req); }
export async function HEAD(req: NextRequest) { return handle(req); }

async function handle(req: NextRequest) {
  const start = Date.now();

  try {
    const line = JSON.stringify({
      ts: start,
      method: req.method,
      url: req.nextUrl.pathname,
      status: 404,
      duration: Date.now() - start,
    }) + '\n';
    await appendFile(LOG_FILE, line, 'utf-8');
  } catch (e) {
    console.error('[audit] 404 log failed:', e);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
