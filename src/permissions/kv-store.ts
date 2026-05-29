import type { PermissionDef } from './index';

export const kvStoreDefinitions: PermissionDef[] = [
  {
    code: 'kv_store.create',
    name: 'Create KV Store Entries',
    description: 'Create new key-value entries',
  },
  {
    code: 'kv_store.manage',
    name: 'Manage KV Store Entries',
    description: 'View, update, or delete any key-value entry regardless of per-entry permissions',
  },
];
