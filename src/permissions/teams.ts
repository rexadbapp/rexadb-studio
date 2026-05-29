import type { PermissionDef } from './index';

export const teamDefinitions: PermissionDef[] = [
  { code: 'teams.create', name: 'Create Teams', description: 'Create new teams' },
  { code: 'teams.read', name: 'Read Teams', description: 'View team details and members' },
  { code: 'teams.update', name: 'Update Teams', description: 'Edit team name and description' },
  { code: 'teams.delete', name: 'Delete Teams', description: 'Remove teams' },
  { code: 'teams.manage_members', name: 'Manage Members', description: 'Add or remove team members' },
  { code: 'teams.manage_access', name: 'Manage Team Access', description: 'Grant or revoke connection access for teams' },
  { code: 'queries.approve', name: 'Approve Queries', description: 'Approve or reject pending queries' },
];
