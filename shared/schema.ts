import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, uuid, date, numeric } from "drizzle-orm/pg-core";
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

// Projects table
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("planning"),
  priority: text("priority").default("medium"),
  start_date: date("start_date"),
  end_date: date("end_date"),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at").default(sql`now()`),
  updated_at: timestamp("updated_at").default(sql`now()`),
  department_id: uuid("department_id"),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Budget tables
export const budgetTypeConfig = pgTable("budget_type_config", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  default_allocation_percent: numeric("default_allocation_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  dropdown_display_order: integer("dropdown_display_order").notNull().default(0),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const projectBudgets = pgTable("project_budgets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid("project_id").notNull(),
  currency: text("currency").notNull().default("INR"),
  total_budget_allocated: numeric("total_budget_allocated", { precision: 15, scale: 2 }).notNull().default("0"),
  total_budget_received: numeric("total_budget_received", { precision: 15, scale: 2 }).notNull().default("0"),
  start_date: date("start_date"),
  end_date: date("end_date"),
  created_by: uuid("created_by").notNull(),
  department_id: uuid("department_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const budgetCategories = pgTable("budget_categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_budget_id: uuid("project_budget_id").notNull(),
  budget_type_code: text("budget_type_code").notNull(),
  name: text("name").notNull(),
  budget_allocated: numeric("budget_allocated", { precision: 15, scale: 2 }).notNull().default("0"),
  budget_received: numeric("budget_received", { precision: 15, scale: 2 }).notNull().default("0"),
  amount_spent: numeric("amount_spent", { precision: 15, scale: 2 }).notNull().default("0"),
  comments: text("comments"),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const budgetSpending = pgTable("budget_spending", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  budget_category_id: uuid("budget_category_id").notNull(),
  date: date("date").notNull(),
  vendor: text("vendor"),
  description: text("description").notNull(),
  invoice_id: text("invoice_id"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  payment_method: text("payment_method"),
  approved_by: uuid("approved_by"),
  status: text("status").notNull().default("pending"),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const budgetReceipts = pgTable("budget_receipts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_budget_id: uuid("project_budget_id").notNull(),
  date: date("date").notNull(),
  source: text("source").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  received_by: uuid("received_by"),
  notes: text("notes"),
  is_restricted: boolean("is_restricted").default(false),
  restricted_to_category: uuid("restricted_to_category"),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

// Insert schemas
export const insertBudgetCategorySchema = createInsertSchema(budgetCategories).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertBudgetSpendingSchema = createInsertSchema(budgetSpending).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Types
export type BudgetTypeConfig = typeof budgetTypeConfig.$inferSelect;
export type ProjectBudget = typeof projectBudgets.$inferSelect;
export type BudgetCategory = typeof budgetCategories.$inferSelect;
export type BudgetSpending = typeof budgetSpending.$inferSelect;
export type BudgetReceipts = typeof budgetReceipts.$inferSelect;
export type InsertBudgetCategory = z.infer<typeof insertBudgetCategorySchema>;
export type InsertBudgetSpending = z.infer<typeof insertBudgetSpendingSchema>;
