import { PERMISSIONS } from '@/permissions';

export interface RoleDef {
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}

const ALL = PERMISSIONS.map((p) => p.code);

export const DEFAULT_ROLES: RoleDef[] = [
  {
    name: 'super_admin',
    description: 'Unrestricted access to all resources and settings',
    isSystem: true,
    permissions: ALL,
  },
  {
    name: 'admin',
    description: 'Full administrative access except destructive actions',
    isSystem: true,
    permissions: ALL.filter(
      (c) => c !== 'connections.delete' && c !== 'roles.manage' && c !== 'teams.manage_members' && c !== 'teams.manage_access'
    ),
  },
  {
    name: 'developer',
    description: 'Can manage connections and run queries',
    isSystem: true,
    permissions: [
      'connections.create',
      'connections.read',
      'connections.update',
      'connections.delete',
      'queries.execute',
      'queries.readonly',
      'queries.saved',
      'permissions.view',
      'kv_store.create',
    ],
  },
  {
    name: 'viewer',
    description: 'Read-only access to connections and queries',
    isSystem: true,
    permissions: ['connections.read', 'queries.readonly', 'permissions.view', 'kv_store.create'],
  },
];
