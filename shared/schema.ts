import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const migrationJobs = pgTable("migration_jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("pending"), // pending, analyzing, configuring, restoring, verifying, completed, failed
  backupInfo: jsonb("backup_info"),
  config: jsonb("config"),
  progress: integer("progress").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const restorationLogs = pgTable("restoration_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").notNull().references(() => migrationJobs.id, { onDelete: "cascade" }),
  level: text("level").notNull(), // info, warn, error
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").default(sql`now()`),
});

export const verificationResults = pgTable("verification_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").notNull().references(() => migrationJobs.id, { onDelete: "cascade" }),
  schemaName: text("schema_name").notNull(),
  tableName: text("table_name").notNull(),
  expectedCount: integer("expected_count"),
  actualCount: integer("actual_count"),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertMigrationJobSchema = createInsertSchema(migrationJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRestorationLogSchema = createInsertSchema(restorationLogs).omit({
  id: true,
  timestamp: true,
});

export const insertVerificationResultSchema = createInsertSchema(verificationResults).omit({
  id: true,
  createdAt: true,
});

export type InsertMigrationJob = z.infer<typeof insertMigrationJobSchema>;
export type MigrationJob = typeof migrationJobs.$inferSelect;
export type InsertRestorationLog = z.infer<typeof insertRestorationLogSchema>;
export type RestorationLog = typeof restorationLogs.$inferSelect;
export type InsertVerificationResult = z.infer<typeof insertVerificationResultSchema>;
export type VerificationResult = typeof verificationResults.$inferSelect;
