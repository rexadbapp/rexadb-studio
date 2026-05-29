import type { PermissionDef } from './index';

export const auditDefinitions: PermissionDef[] = [
  { code: 'query_logs.view', name: 'View Query Logs', description: 'View query audit trail' },
  { code: 'audit_logs.view', name: 'View Audit Logs', description: 'View API request audit logs' },
];
