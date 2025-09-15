import { migrationJobs, restorationLogs, verificationResults, type MigrationJob, type InsertMigrationJob, type RestorationLog, type InsertRestorationLog, type VerificationResult, type InsertVerificationResult } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Migration Jobs
  createMigrationJob(job: InsertMigrationJob): Promise<MigrationJob>;
  getMigrationJob(id: string): Promise<MigrationJob | undefined>;
  updateMigrationJob(id: string, updates: Partial<MigrationJob>): Promise<MigrationJob>;
  getAllMigrationJobs(): Promise<MigrationJob[]>;

  // Restoration Logs
  createRestorationLog(log: InsertRestorationLog): Promise<RestorationLog>;
  getRestorationLogs(jobId: string): Promise<RestorationLog[]>;

  // Verification Results
  createVerificationResult(result: InsertVerificationResult): Promise<VerificationResult>;
  getVerificationResults(jobId: string): Promise<VerificationResult[]>;
}

export class DatabaseStorage implements IStorage {
  async createMigrationJob(insertJob: InsertMigrationJob): Promise<MigrationJob> {
    const [job] = await db
      .insert(migrationJobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async getMigrationJob(id: string): Promise<MigrationJob | undefined> {
    const [job] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, id));
    return job || undefined;
  }

  async updateMigrationJob(id: string, updates: Partial<MigrationJob>): Promise<MigrationJob> {
    const [job] = await db
      .update(migrationJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(migrationJobs.id, id))
      .returning();
    return job;
  }

  async getAllMigrationJobs(): Promise<MigrationJob[]> {
    return await db.select().from(migrationJobs).orderBy(desc(migrationJobs.createdAt));
  }

  async createRestorationLog(insertLog: InsertRestorationLog): Promise<RestorationLog> {
    const [log] = await db
      .insert(restorationLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async getRestorationLogs(jobId: string): Promise<RestorationLog[]> {
    return await db.select().from(restorationLogs)
      .where(eq(restorationLogs.jobId, jobId))
      .orderBy(desc(restorationLogs.timestamp));
  }

  async createVerificationResult(insertResult: InsertVerificationResult): Promise<VerificationResult> {
    const [result] = await db
      .insert(verificationResults)
      .values(insertResult)
      .returning();
    return result;
  }

  async getVerificationResults(jobId: string): Promise<VerificationResult[]> {
    return await db.select().from(verificationResults)
      .where(eq(verificationResults.jobId, jobId));
  }
}

export const storage = new DatabaseStorage();
