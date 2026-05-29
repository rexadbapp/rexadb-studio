import type { PermissionDef } from './index';

export const inviteDefinitions: PermissionDef[] = [
  { code: 'invites.create', name: 'Create Invites', description: 'Generate new invitation tokens' },
  { code: 'invites.view', name: 'View Invites', description: 'List invitation records' },
  { code: 'invites.revoke', name: 'Revoke Invites', description: 'Cancel pending invitations' },
];
