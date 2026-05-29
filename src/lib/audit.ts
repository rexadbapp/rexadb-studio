import { getDb } from '@/db';
import { auditLogs } from '@/db/schema';

interface AuditEntry {
  ts: number;
  method: string;
  url: string;
  status: number;
  reqHeaders?: Record<string, string | undefined>;
  resBody?: unknown;
  duration?: number;
  userId?: string;
}

const buffer: AuditEntry[] = [];
const MAX = 500;
const MAX_ARRAY_LEN = 50;
const MAX_STRING_LEN = 10_000;
const MAX_TRUNCATE_DEPTH = 5;
const MAX_BODY_SIZE = 10_000;

function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  return value;
}

function truncateBody(body: unknown, depth = MAX_TRUNCATE_DEPTH): unknown {
  if (depth <= 0) return '[truncated]';
  if (typeof body === 'string' && body.length > MAX_STRING_LEN) {
    return body.slice(0, MAX_STRING_LEN) + '...[truncated]';
  }
  if (Array.isArray(body)) {
    const sliced = body.length > MAX_ARRAY_LEN ? body.slice(0, MAX_ARRAY_LEN) : body;
    return sliced.map(item => truncateBody(item, depth - 1));
  }
  if (body && typeof body === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      result[key] = truncateBody(value, depth - 1);
    }
    return result;
  }
  return body;
}

function safeJsonStringify(value: unknown, replacer?: (key: string, value: unknown) => unknown): string | null {
  try {
    return JSON.stringify(value, replacer);
  } catch {
    return JSON.stringify({ error: 'failed to serialize' });
  }
}

function isBelowSizeLimit(value: unknown): boolean {
  try {
    return JSON.stringify(value).length <= MAX_BODY_SIZE;
  } catch {
    return false;
  }
}

function truncateEntry(entry: AuditEntry): AuditEntry {
  const truncatedResBody = entry.resBody !== undefined ? truncateBody(entry.resBody) : undefined;
  return {
    ...entry,
    resBody: truncatedResBody !== undefined && !isBelowSizeLimit(truncatedResBody)
      ? { __truncated__: true }
      : truncatedResBody,
    reqHeaders: entry.reqHeaders
      ? (truncateBody(entry.reqHeaders) as Record<string, string | undefined>)
      : undefined,
  };
}

async function insertAuditEntry(safeEntry: AuditEntry): Promise<void> {
  try {
    const bodyForLog = safeEntry.resBody !== undefined ? safeJsonStringify(safeEntry.resBody, bigintReplacer) : null;
    const reqHeadersStr = safeEntry.reqHeaders !== undefined ? safeJsonStringify(safeEntry.reqHeaders) : null;
    await getDb().insert(auditLogs).values({
      ts: safeEntry.ts, method: safeEntry.method, url: safeEntry.url, status: safeEntry.status,
      reqHeaders: reqHeadersStr, resBody: bodyForLog, duration: safeEntry.duration ?? null, userId: safeEntry.userId ?? null,
    });
  } catch (e) {
    console.error('[audit] insert failed:', e);
  }
}

export function auditLog(entry: AuditEntry): void {
  const safeEntry = truncateEntry(entry);
  buffer.push(safeEntry);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
  void insertAuditEntry(safeEntry);
}

export function getBufferAuditLog(): AuditEntry[] {
  return buffer.slice();
}
