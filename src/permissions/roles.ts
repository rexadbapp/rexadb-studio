import type { PermissionDef } from './index';

export const definitions: PermissionDef[] = [
  { code: 'roles.manage', name: 'Manage Roles', description: 'Create, edit, or delete custom roles' },
  { code: 'roles.assign', name: 'Assign Roles', description: 'Change role assignments for users' },
];
