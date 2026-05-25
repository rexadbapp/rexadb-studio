import type { PermissionDef } from './index';

export const definitions: PermissionDef[] = [
  { code: 'queries.execute', name: 'Execute Queries', description: 'Run arbitrary SQL on a connection' },
  { code: 'queries.readonly', name: 'Read-Only Queries', description: 'Run SELECT-only queries' },
  { code: 'queries.saved', name: 'Saved Queries', description: 'Run predefined saved queries' },
];
