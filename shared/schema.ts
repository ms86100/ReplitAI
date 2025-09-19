import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, uuid, date, numeric, unique } from "drizzle-orm/pg-core";
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

// Users table for authentication
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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

// Tasks table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid("project_id").notNull(),
  milestone_id: uuid("milestone_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").default("medium"),
  owner_id: uuid("owner_id"),
  created_by: uuid("created_by").notNull(),
  due_date: date("due_date"),
  department_id: uuid("department_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

// Milestones table
export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid("project_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  due_date: date("due_date").notNull(),
  status: text("status").notNull().default("planning"),
  created_by: uuid("created_by").notNull(),
  department_id: uuid("department_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

// Stakeholders table
export const stakeholders = pgTable("stakeholders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid("project_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  department: text("department"),
  raci: text("raci"),
  influence_level: text("influence_level"),
  notes: text("notes"),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

// Risk register table
export const riskRegister = pgTable("risk_register", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid("project_id").notNull(),
  created_by: uuid("created_by").notNull(),
  department_id: uuid("department_id"),
  risk_code: text("risk_code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  cause: text("cause"),
  consequence: text("consequence"),
  likelihood: integer("likelihood"),
  impact: integer("impact"),
  risk_score: integer("risk_score"),
  owner: text("owner"),
  response_strategy: text("response_strategy"),
  mitigation_plan: text("mitigation_plan").array(),
  contingency_plan: text("contingency_plan"),
  status: text("status").default("open"),
  identified_date: date("identified_date"),
  last_updated: date("last_updated"),
  next_review_date: date("next_review_date"),
  residual_likelihood: integer("residual_likelihood"),
  residual_impact: integer("residual_impact"),
  residual_risk_score: integer("residual_risk_score"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

// Insert schemas for new tables
export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertMilestoneSchema = createInsertSchema(milestones).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertStakeholderSchema = createInsertSchema(stakeholders).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertRiskSchema = createInsertSchema(riskRegister).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Types for new tables
export type Task = typeof tasks.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type Stakeholder = typeof stakeholders.$inferSelect;
export type Risk = typeof riskRegister.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type InsertStakeholder = z.infer<typeof insertStakeholderSchema>;
export type InsertRisk = z.infer<typeof insertRiskSchema>;

// Project discussions table
export const projectDiscussions = pgTable("project_discussions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid("project_id").notNull(),
  meeting_title: text("meeting_title").notNull(),
  meeting_date: date("meeting_date").notNull(),
  summary_notes: text("summary_notes"),
  attendees: jsonb("attendees").default(sql`'[]'::jsonb`),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

// Discussion action items table
export const discussionActionItems = pgTable("discussion_action_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  discussion_id: uuid("discussion_id").notNull(),
  task_description: text("task_description").notNull(),
  owner_id: uuid("owner_id"),
  target_date: date("target_date"),
  status: text("status").notNull().default("open"),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

// Discussion change log table
export const discussionChangeLog = pgTable("discussion_change_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  discussion_id: uuid("discussion_id"),
  action_item_id: uuid("action_item_id"),
  change_type: text("change_type").notNull(),
  field_name: text("field_name"),
  old_value: text("old_value"),
  new_value: text("new_value"),
  changed_by: uuid("changed_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
});

// Project members table
export const projectMembers = pgTable("project_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid("project_id").notNull(),
  user_id: uuid("user_id").notNull(),
  role: text("role").default("member"),
  joined_at: timestamp("joined_at", { withTimezone: true }).default(sql`now()`),
  department_id: uuid("department_id")
});

// Task backlog table
export const taskBacklog = pgTable("task_backlog", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  project_id: uuid("project_id").notNull(),
  created_by: uuid("created_by").notNull(),
  priority: text("priority").default("medium"),
  status: text("status").notNull().default("backlog"),
  owner_id: uuid("owner_id"),
  target_date: date("target_date"),
  source_type: text("source_type").default("manual"),
  source_id: uuid("source_id"),
  department_id: uuid("department_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

// Teams and Team Capacity Tables
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid("project_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  team_id: uuid("team_id").notNull(),
  display_name: text("display_name").notNull(),
  role: text("role"),
  email: text("email"),
  work_mode: text("work_mode").notNull().default("office"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const teamCapacityIterations = pgTable("team_capacity_iterations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid("project_id").notNull(),
  iteration_name: text("iteration_name").notNull(),
  start_date: date("start_date").notNull(),
  end_date: date("end_date").notNull(),
  working_days: integer("working_days").notNull(),
  committed_story_points: integer("committed_story_points"),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  department_id: uuid("department_id"),
  team_id: uuid("team_id")
});

export const iterationWeeks = pgTable("iteration_weeks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  iteration_id: uuid("iteration_id").notNull(),
  week_index: integer("week_index").notNull(),
  week_start: date("week_start").notNull(),
  week_end: date("week_end").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
}, (table) => ({
  uniqueIterationWeek: unique().on(table.iteration_id, table.week_index)
}));

export const weeklyAvailability = pgTable("weekly_availability", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  iteration_id: uuid("iteration_id").notNull().references(() => teamCapacityIterations.id, { onDelete: 'cascade' }),
  iteration_week_id: uuid("iteration_week_id").notNull().references(() => iterationWeeks.id, { onDelete: 'cascade' }),
  team_member_id: text("team_member_id").notNull(),
  availability_percent: integer("availability_percent").notNull().default(100),
  leaves: integer("leaves").notNull().default(0),
  calculated_days_present: integer("calculated_days_present").notNull().default(5),
  calculated_days_total: integer("calculated_days_total").notNull().default(5),
  effective_capacity: numeric("effective_capacity", { precision: 5, scale: 2 }).notNull().default("5.00"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
}, (table) => ({
  uniqueAvailability: unique().on(table.iteration_week_id, table.team_member_id)
}));

export const teamCapacityMembers = pgTable("team_capacity_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  iteration_id: uuid("iteration_id").notNull(),
  member_name: text("member_name").notNull(),
  role: text("role"),
  work_mode: text("work_mode").notNull(),
  availability_percent: integer("availability_percent").notNull().default(100),
  leaves: integer("leaves").notNull().default(0),
  effective_capacity_days: numeric("effective_capacity_days", { precision: 5, scale: 2 }),
  stakeholder_id: uuid("stakeholder_id"),
  team_id: uuid("team_id"),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

// Insert schemas for new tables
export const insertProjectDiscussionSchema = createInsertSchema(projectDiscussions).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertDiscussionActionItemSchema = createInsertSchema(discussionActionItems).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({
  id: true,
  joined_at: true,
});

export const insertTaskBacklogSchema = createInsertSchema(taskBacklog).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertTeamCapacityIterationSchema = createInsertSchema(teamCapacityIterations).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertIterationWeekSchema = createInsertSchema(iterationWeeks).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertWeeklyAvailabilitySchema = createInsertSchema(weeklyAvailability).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertTeamCapacityMemberSchema = createInsertSchema(teamCapacityMembers).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Types for new tables
export type ProjectDiscussion = typeof projectDiscussions.$inferSelect;
export type DiscussionActionItem = typeof discussionActionItems.$inferSelect;
export type DiscussionChangeLog = typeof discussionChangeLog.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type TaskBacklog = typeof taskBacklog.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type TeamCapacityIteration = typeof teamCapacityIterations.$inferSelect;
export type TeamCapacityMember = typeof teamCapacityMembers.$inferSelect;
export type InsertProjectDiscussion = z.infer<typeof insertProjectDiscussionSchema>;
export type InsertDiscussionActionItem = z.infer<typeof insertDiscussionActionItemSchema>;
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type InsertTaskBacklog = z.infer<typeof insertTaskBacklogSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type InsertTeamCapacityIteration = z.infer<typeof insertTeamCapacityIterationSchema>;
export type InsertIterationWeek = z.infer<typeof insertIterationWeekSchema>;
export type SelectIterationWeek = typeof iterationWeeks.$inferSelect;
export type InsertWeeklyAvailability = z.infer<typeof insertWeeklyAvailabilitySchema>;
export type SelectWeeklyAvailability = typeof weeklyAvailability.$inferSelect;
export type InsertTeamCapacityMember = z.infer<typeof insertTeamCapacityMemberSchema>;

// Retrospective tables
export const retrospectives = pgTable("retrospectives", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid("project_id").notNull(),
  iteration_id: uuid("iteration_id"),
  framework: text("framework").notNull().default("classic"),
  status: text("status").notNull().default("active"),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const retrospectiveColumns = pgTable("retrospective_columns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  retrospective_id: uuid("retrospective_id").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  column_order: integer("column_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const retrospectiveCards = pgTable("retrospective_cards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  column_id: uuid("column_id").notNull(),
  text: text("text").notNull(),
  votes: integer("votes").notNull().default(0),
  card_order: integer("card_order").notNull().default(0),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const retrospectiveActionItems = pgTable("retrospective_action_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  retrospective_id: uuid("retrospective_id").notNull(),
  what_task: text("what_task").notNull(),
  when_sprint: text("when_sprint"),
  who_responsible: text("who_responsible"),
  how_approach: text("how_approach"),
  from_card_id: uuid("from_card_id"),
  backlog_ref_id: uuid("backlog_ref_id"),
  converted_to_task: boolean("converted_to_task").default(false),
  created_by: uuid("created_by").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
});

export const retrospectiveCardVotes = pgTable("retrospective_card_votes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  card_id: uuid("card_id").notNull(),
  user_id: uuid("user_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
}, (table) => ({
  uniqueVote: unique().on(table.card_id, table.user_id)
}));

// Insert schemas for retrospective tables
export const insertRetrospectiveSchema = createInsertSchema(retrospectives).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertRetrospectiveColumnSchema = createInsertSchema(retrospectiveColumns).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertRetrospectiveCardSchema = createInsertSchema(retrospectiveCards).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertRetrospectiveActionItemSchema = createInsertSchema(retrospectiveActionItems).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertRetrospectiveCardVoteSchema = createInsertSchema(retrospectiveCardVotes).omit({
  id: true,
  created_at: true,
});

// Types for retrospective tables
export type Retrospective = typeof retrospectives.$inferSelect;
export type RetrospectiveColumn = typeof retrospectiveColumns.$inferSelect;
export type RetrospectiveCard = typeof retrospectiveCards.$inferSelect;
export type RetrospectiveActionItem = typeof retrospectiveActionItems.$inferSelect;
export type RetrospectiveCardVote = typeof retrospectiveCardVotes.$inferSelect;
export type InsertRetrospective = z.infer<typeof insertRetrospectiveSchema>;
export type InsertRetrospectiveColumn = z.infer<typeof insertRetrospectiveColumnSchema>;
export type InsertRetrospectiveCard = z.infer<typeof insertRetrospectiveCardSchema>;
export type InsertRetrospectiveActionItem = z.infer<typeof insertRetrospectiveActionItemSchema>;
export type InsertRetrospectiveCardVote = z.infer<typeof insertRetrospectiveCardVoteSchema>;
