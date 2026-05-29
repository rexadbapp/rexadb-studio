import type { PermissionDef } from './index';

export const connectionDefinitions: PermissionDef[] = [
  { code: 'connections.create', name: 'Create Connections', description: 'Create new database connections' },
  { code: 'connections.read', name: 'Read Connections', description: 'View connection metadata' },
  { code: 'connections.update', name: 'Update Connections', description: 'Edit connection configuration' },
  { code: 'connections.delete', name: 'Delete Connections', description: 'Remove connections' },
  { code: 'connections.manage_access', name: 'Manage Access', description: 'Grant or revoke access to connections' },
];
