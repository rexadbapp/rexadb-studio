import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import * as schema from '@/db/schema';

export type Role = InferSelectModel<typeof schema.roles>;
export type NewRole = InferInsertModel<typeof schema.roles>;

export type Permission = InferSelectModel<typeof schema.permissions>;
export type NewPermission = InferInsertModel<typeof schema.permissions>;

export type User = InferSelectModel<typeof schema.users>;
export type NewUser = InferInsertModel<typeof schema.users>;

export type Connection = InferSelectModel<typeof schema.connections>;
export type NewConnection = InferInsertModel<typeof schema.connections>;

export type ConnectionAccess = InferSelectModel<typeof schema.connectionAccess>;
export type NewConnectionAccess = InferInsertModel<typeof schema.connectionAccess>;

export type SavedQuery = InferSelectModel<typeof schema.savedQueries>;
export type NewSavedQuery = InferInsertModel<typeof schema.savedQueries>;

export type QueryLog = InferSelectModel<typeof schema.queryLogs>;

export type AccessLevel = 'FULL_ACCESS' | 'READ_ONLY' | 'READ_AND_REQUEST' | 'CUSTOM';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  code?: string;
}

export interface QueryRequest {
  sql: string;
  params?: unknown[];
}

export interface QueryResponse {
  rows: Record<string, unknown>[];
  fields: string[];
  rowCount: number;
  duration: number;
}

export interface ConnectionResponse {
  id: string;
  name: string;
  type: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  ssl: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface CreateRoleBody {
  name: string;
  description?: string;
  permissionIds: number[];
}

export interface UpdateRoleBody {
  name?: string;
  description?: string;
  permissionIds?: number[];
}

export interface SetAccessBody {
  roleId: number;
  accessType: AccessLevel;
  queryPattern?: string;
  allowedQueryIds?: number[];
}

export interface CreateConnectionBody {
  name: string;
  type: 'postgres' | 'mysql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface UpdateConnectionBody {
  name?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface CreateSavedQueryBody {
  name: string;
  queryText: string;
}
