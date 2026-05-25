import type { PermissionDef } from './index';

export const definitions: PermissionDef[] = [
  { code: 'users.read', name: 'Read Users', description: 'View user list and details' },
  { code: 'users.manage', name: 'Manage Users', description: 'Invite, update, or remove users' },
];
