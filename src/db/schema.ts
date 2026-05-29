import { sqliteTable, text, integer, primaryKey, unique } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').unique().notNull(),
  description: text('description').notNull().default(''),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(''),
});

export const permissions = sqliteTable('permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: text('created_at').notNull().default(''),
});

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: integer('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  })
);

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  roleId: integer('role_id')
    .notNull()
    .references(() => roles.id),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  totpSecret: text('totp_secret'),
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(''),
});

export const connections = sqliteTable('connections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['postgres', 'mysql'] }).notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull(),
  database: text('database').notNull(),
  username: text('username').notNull(),
  encryptedPassword: text('encrypted_password').notNull(),
  ssl: integer('ssl', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

export const connectionAccess = sqliteTable('connection_access', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  roleId: integer('role_id')
    .references(() => roles.id, { onDelete: 'cascade' }),
  teamId: integer('team_id')
    .references(() => teams.id, { onDelete: 'cascade' }),
  accessType: text('access_type', {
    enum: ['FULL_ACCESS', 'READ_ONLY', 'READ_AND_REQUEST', 'CUSTOM'],
  }).notNull(),
  queryPattern: text('query_pattern'),
  allowedQueryIds: text('allowed_query_ids'),
});

export const savedQueries = sqliteTable('saved_queries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  queryText: text('query_text').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull().default(''),
});

export const queryLogs = sqliteTable('query_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  query: text('query').notNull(),
  duration: integer('duration').notNull().default(0),
  executedAt: text('executed_at').notNull().default(''),
});

export const invites = sqliteTable('invites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull().unique(),
  email: text('email').notNull(),
  roleId: integer('role_id')
    .notNull()
    .references(() => roles.id),
  status: text('status', { enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'] })
    .notNull()
    .default('PENDING'),
  expiresAt: text('expires_at').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull().default(''),
  acceptedAt: text('accepted_at'),
});

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

export const teamMembers = sqliteTable(
  'team_members',
  {
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
    joinedAt: text('joined_at').notNull().default(''),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.userId] }),
  })
);

export const teamPermissions = sqliteTable(
  'team_permissions',
  {
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    permissionCode: text('permission_code').notNull(),
    grantedBy: text('granted_by')
      .notNull()
      .references(() => users.id),
    grantedAt: text('granted_at').notNull().default(''),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.permissionCode] }),
  })
);

export const pendingQueries = sqliteTable('pending_queries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  teamId: integer('team_id')
    .references(() => teams.id, { onDelete: 'set null' }),
  requestedBy: text('requested_by')
    .notNull()
    .references(() => users.id),
  sql: text('sql').notNull(),
  params: text('params'),
  status: text('status', { enum: ['PENDING', 'APPROVED', 'REJECTED'] })
    .notNull()
    .default('PENDING'),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: text('approved_at'),
  createdAt: text('created_at').notNull().default(''),
});

export const kvStore = sqliteTable('kv_store', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

export const kvStorePermissions = sqliteTable(
  'kv_store_permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kvId: text('kv_id')
      .notNull()
      .references(() => kvStore.id, { onDelete: 'cascade' }),
    action: text('action', {
      enum: ['read', 'write_value', 'manage_permissions', 'delete'],
    }).notNull(),
    granteeType: text('grantee_type', {
      enum: ['user', 'role', 'team', 'studio', 'public'],
    }).notNull(),
    granteeId: text('grantee_id'),
    grantedBy: text('granted_by')
      .notNull()
      .references(() => users.id),
    grantedAt: text('granted_at').notNull().default(''),
  },
  (t) => ({
    uniq: unique().on(t.kvId, t.action, t.granteeType, t.granteeId),
  })
);

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ts: integer('ts').notNull(),
  method: text('method').notNull(),
  url: text('url').notNull(),
  status: integer('status').notNull(),
  reqHeaders: text('req_headers'),
  resBody: text('res_body'),
  duration: integer('duration'),
  userId: text('user_id'),
});

// ---------- RELATIONS ----------

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  users: many(users),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  connections: many(connections),
  queryLogs: many(queryLogs),
  invites: many(invites),
  teamMemberships: many(teamMembers),
  teamsCreated: many(teams, { relationName: 'createdByUser' }),
  pendingQueries: many(pendingQueries, { relationName: 'requestedByUser' }),
  approvedQueries: many(pendingQueries, { relationName: 'approvedByUser' }),
  kvStore: many(kvStore),
  grantedKvPermissions: many(kvStorePermissions, { relationName: 'granter' }),
}));

export const connectionsRelations = relations(connections, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [connections.createdBy],
    references: [users.id],
  }),
  access: many(connectionAccess),
  savedQueries: many(savedQueries),
  queryLogs: many(queryLogs),
  pendingQueries: many(pendingQueries),
}));

export const connectionAccessRelations = relations(connectionAccess, ({ one }) => ({
  connection: one(connections, {
    fields: [connectionAccess.connectionId],
    references: [connections.id],
  }),
  role: one(roles, {
    fields: [connectionAccess.roleId],
    references: [roles.id],
  }),
  team: one(teams, {
    fields: [connectionAccess.teamId],
    references: [teams.id],
  }),
}));

export const savedQueriesRelations = relations(savedQueries, ({ one }) => ({
  connection: one(connections, {
    fields: [savedQueries.connectionId],
    references: [connections.id],
  }),
  createdByUser: one(users, {
    fields: [savedQueries.createdBy],
    references: [users.id],
  }),
}));

export const queryLogsRelations = relations(queryLogs, ({ one }) => ({
  connection: one(connections, {
    fields: [queryLogs.connectionId],
    references: [connections.id],
  }),
  user: one(users, {
    fields: [queryLogs.userId],
    references: [users.id],
  }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  createdByUser: one(users, {
    fields: [invites.createdBy],
    references: [users.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [teams.createdBy],
    references: [users.id],
    relationName: 'createdByUser',
  }),
  members: many(teamMembers),
  permissions: many(teamPermissions),
  connectionAccess: many(connectionAccess),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const teamPermissionsRelations = relations(teamPermissions, ({ one }) => ({
  team: one(teams, {
    fields: [teamPermissions.teamId],
    references: [teams.id],
  }),
}));

export const kvStoreRelations = relations(kvStore, ({ one, many }) => ({
  owner: one(users, {
    fields: [kvStore.ownerId],
    references: [users.id],
  }),
  permissions: many(kvStorePermissions),
}));

export const kvStorePermissionsRelations = relations(kvStorePermissions, ({ one }) => ({
  kvStore: one(kvStore, {
    fields: [kvStorePermissions.kvId],
    references: [kvStore.id],
  }),
  granter: one(users, {
    fields: [kvStorePermissions.grantedBy],
    references: [users.id],
  }),
}));

export const pendingQueriesRelations = relations(pendingQueries, ({ one }) => ({
  connection: one(connections, {
    fields: [pendingQueries.connectionId],
    references: [connections.id],
  }),
  team: one(teams, {
    fields: [pendingQueries.teamId],
    references: [teams.id],
  }),
  requestedByUser: one(users, {
    fields: [pendingQueries.requestedBy],
    references: [users.id],
    relationName: 'requestedByUser',
  }),
  approvedByUser: one(users, {
    fields: [pendingQueries.approvedBy],
    references: [users.id],
    relationName: 'approvedByUser',
  }),
}));
