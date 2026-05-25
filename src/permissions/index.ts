import { definitions as connections } from './connections';
import { definitions as queries } from './queries';
import { definitions as users } from './users';
import { definitions as roles } from './roles';
import { definitions as invites } from './invites';
import { definitions as audit } from './audit';
import { definitions as permissionsView } from './permissions-view';
import { definitions as teams } from './teams';

export interface PermissionDef {
  code: string;
  name: string;
  description: string;
}

export const PERMISSIONS: PermissionDef[] = [
  ...connections,
  ...queries,
  ...users,
  ...roles,
  ...invites,
  ...audit,
  ...permissionsView,
  ...teams,
];

const ROUTE_MAP: Record<string, string[]> = {
  'connections.create': ['POST /api/connections'],
  'connections.read': ['GET /api/connections', 'GET /api/connections/[id]'],
  'connections.update': ['PUT /api/connections/[id]'],
  'connections.delete': ['DELETE /api/connections/[id]'],
  'connections.manage_access': ['GET /api/connections/[id]/access', 'PUT /api/connections/[id]/access', 'GET /api/connections/[id]/credentials'],
  'queries.execute': ['POST /api/connections/[id]/query'],
  'queries.readonly': ['POST /api/connections/[id]/query'],
  'queries.saved': ['GET /api/connections/[id]/saved-queries', 'POST /api/connections/[id]/saved-queries', 'PUT /api/connections/[id]/saved-queries/[sqId]', 'DELETE /api/connections/[id]/saved-queries/[sqId]'],
  'users.read': ['GET /api/users'],
  'users.manage': ['PATCH /api/users/[id]', 'DELETE /api/users/[id]'],
  'roles.manage': ['GET /api/roles', 'POST /api/roles', 'GET /api/roles/[id]', 'PUT /api/roles/[id]', 'DELETE /api/roles/[id]'],
  'roles.assign': ['PATCH /api/users/[id]/role'],
  'permissions.view': ['GET /api/permissions'],
  'invites.create': ['POST /api/invites'],
  'invites.view': ['GET /api/invites'],
  'invites.revoke': ['POST /api/invites/[id]/revoke'],
  'query_logs.view': ['GET /api/query-logs'],
  'audit_logs.view': ['GET /api/audit-logs'],
  'teams.create': ['POST /api/teams'],
  'teams.read': ['GET /api/teams', 'GET /api/teams/[id]', 'GET /api/teams/[id]/members'],
  'teams.update': ['PUT /api/teams/[id]'],
  'teams.delete': ['DELETE /api/teams/[id]'],
  'teams.manage_members': ['POST /api/teams/[id]/members', 'DELETE /api/teams/[id]/members/[userId]'],
  'teams.manage_access': ['GET /api/teams/[id]/access', 'PUT /api/teams/[id]/access'],
  'queries.approve': ['POST /api/connections/[id]/pending-queries/[pqId]/approve', 'POST /api/connections/[id]/pending-queries/[pqId]/reject', 'GET /api/connections/[id]/pending-queries'],
};

export function validateRouteCoverage(): string[] {
  const uncovered: string[] = [];
  for (const perm of PERMISSIONS) {
    if (!ROUTE_MAP[perm.code]) {
      uncovered.push(`No routes mapped for permission: ${perm.code}`);
    }
  }
  return uncovered;
}
