import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const mailboxes = sqliteTable("mailboxes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().unique(),
  shareKey: text("share_key").notNull().unique(),
});
export const letters = sqliteTable("letters", {
  id: text("id").primaryKey(),
  mailboxId: text("mailbox_id").notNull().references(() => mailboxes.id),
  title: text("title").notNull(),
  recipient: text("recipient").notNull(),
  sender: text("sender").notNull(),
  note: text("note").notNull(),
  date: text("date").notNull(),
  color: text("color").notNull(),
  media: text("media").notNull(),
  createdAt: text("created_at").notNull(),
});

export const adminSessions = sqliteTable('admin_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  credentialVersion: text('credential_version').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(),
  hits: integer('hits').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
