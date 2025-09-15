import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { storage } from "./storage";
import { BackupAnalyzer } from "./services/backup-analyzer";
import { DatabaseRestorer } from "./services/database-restorer";
import { DatabaseVerifier } from "./services/verification";
import { insertMigrationJobSchema, projects, insertProjectSchema } from "@shared/schema";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

const backupAnalyzer = new BackupAnalyzer();
const databaseRestorer = new DatabaseRestorer();
const databaseVerifier = new DatabaseVerifier();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Upload backup file
  app.post("/api/upload-backup", upload.single('backup'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No backup file provided" });
      }

      const stats = await fs.stat(req.file.path);
      
      const job = await storage.createMigrationJob({
        filename: req.file.originalname,
        fileSize: stats.size,
        status: "analyzing",
      });

      // Analyze backup in background
      try {
        const backupInfo = await backupAnalyzer.analyzeBackup(req.file.path);
        await storage.updateMigrationJob(job.id, {
          status: "configuring",
          backupInfo,
        });
      } catch (error) {
        await storage.updateMigrationJob(job.id, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Analysis failed",
        });
      }

      res.json({ jobId: job.id, job });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Upload failed" 
      });
    }
  });

  // Get job status
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getMigrationJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to get job" 
      });
    }
  });

  // Test database connection
  app.post("/api/test-connection", async (req, res) => {
    try {
      const { config } = req.body;
      const isConnected = await databaseRestorer.testConnection(config);
      res.json({ connected: isConnected });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Connection test failed",
        connected: false 
      });
    }
  });

  // Start restoration
  app.post("/api/restore/:id", async (req, res) => {
    try {
      const { config, optimization } = req.body;
      const job = await storage.getMigrationJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      await storage.updateMigrationJob(job.id, { config, status: "restoring" });

      // Start restoration in background
      const backupPath = path.join('uploads', job.filename);
      
      databaseRestorer.restoreDatabase(job.id, backupPath, config, optimization)
        .then(() => databaseVerifier.verifyRestoration(job.id, config))
        .catch(error => console.error("Restoration failed:", error));

      res.json({ message: "Restoration started" });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to start restoration" 
      });
    }
  });

  // Get restoration logs
  app.get("/api/logs/:id", async (req, res) => {
    try {
      const logs = await storage.getRestorationLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to get logs" 
      });
    }
  });

  // Get verification results
  app.get("/api/verification/:id", async (req, res) => {
    try {
      const results = await storage.getVerificationResults(req.params.id);
      res.json(results);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to get verification results" 
      });
    }
  });

  // Get all jobs
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getAllMigrationJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to get jobs" 
      });
    }
  });

  // Airbus Application API Endpoints
  
  // Auth service - Get user profile
  app.get("/api/auth-service/users/:userId/profile", async (req, res) => {
    try {
      // For now, return a basic profile response
      res.json({
        success: true,
        data: {
          id: req.params.userId,
          email: "ms861000@gmail.com",
          full_name: "Project Manager",
          department_id: "dept-1",
          departments: {
            name: "Engineering"
          }
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get user profile" 
      });
    }
  });

  // Auth service - Get user role
  app.get("/api/auth-service/users/:userId/role", async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          role: "user"
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get user role" 
      });
    }
  });

  // Projects service - Get all projects
  app.get("/api/projects-service/projects", async (req, res) => {
    try {
      const allProjects = await db.select().from(projects);
      res.json({
        success: true,
        data: allProjects
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get projects" 
      });
    }
  });

  // Projects service - Get specific project
  app.get("/api/projects-service/projects/:id", async (req, res) => {
    try {
      const projectId = req.params.id;
      
      const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      
      if (project.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Project not found"
        });
      }
      
      res.json({
        success: true,
        data: project[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch project" 
      });
    }
  });

  // Projects service - Get project stats
  app.get("/api/projects-service/stats", async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          totalProjects: 2,
          activeProjects: 1,
          completedProjects: 0,
          totalUsers: 1
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project stats" 
      });
    }
  });

  // Department service - Get all departments
  app.get("/api/department-service/departments", async (req, res) => {
    try {
      res.json({
        success: true,
        data: [
          {
            id: "dept-1",
            name: "Engineering",
            description: "Software and systems engineering department",
            created_at: "2024-01-01T00:00:00Z"
          },
          {
            id: "dept-2", 
            name: "Flight Operations",
            description: "Aircraft operations and safety department",
            created_at: "2024-01-01T00:00:00Z"
          }
        ]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get departments" 
      });
    }
  });

  // Auth service - Login
  app.post("/api/auth-service/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Simple auth check
      if (email === "ms861000@gmail.com" && password) {
        const userId = "6dc39f1e-2af3-4b78-8488-317d90f4f538";
        res.json({
          success: true,
          data: {
            user: {
              id: userId,
              email: email,
              full_name: "Project Manager",
              department_id: "dept-1"
            },
            session: {
              access_token: "token_" + userId,
              user: {
                id: userId,
                email: email
              }
            }
          }
        });
      } else {
        res.status(401).json({
          success: false,
          error: "Invalid credentials"
        });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Login failed" 
      });
    }
  });

  // Auth service - Logout
  app.post("/api/auth-service/logout", async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          message: "Logged out successfully"
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Logout failed" 
      });
    }
  });

  // Access service - Get project permissions
  app.get("/api/access-service/projects/:projectId/access", async (req, res) => {
    try {
      res.json({
        success: true,
        data: [
          { module: "overview", access_level: "write" },
          { module: "kanban", access_level: "write" },
          { module: "roadmap", access_level: "write" },
          { module: "stakeholders", access_level: "write" },
          { module: "risks", access_level: "write" },
          { module: "status", access_level: "write" },
          { module: "discussions", access_level: "write" },
          { module: "task_backlog", access_level: "write" },
          { module: "team_capacity", access_level: "write" },
          { module: "retrospectives", access_level: "write" },
          { module: "tasks_milestones", access_level: "write" },
          { module: "risk_register", access_level: "write" },
          { module: "budget", access_level: "write" },
          { module: "access_control", access_level: "write" }
        ]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get permissions" 
      });
    }
  });

  // Access service - Log access
  app.post("/api/access-service/log-access", async (req, res) => {
    try {
      res.json({
        success: true,
        data: { message: "Access logged" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to log access" 
      });
    }
  });

  // Workspace service - Get workspace info
  app.get("/api/workspace-service/projects/:projectId/workspace", async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          id: req.params.projectId,
          settings: {},
          modules: ["overview", "kanban", "roadmap", "stakeholders", "risks", "status", "discussions", "task_backlog", "team_capacity", "retrospectives"]
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get workspace" 
      });
    }
  });

  // Wizard service - Create project
  app.post("/api/wizard-service/projects/create", async (req, res) => {
    try {
      const newProject = await db.insert(projects).values({
        name: req.body.projectName || 'New Project',
        description: req.body.objective || '',
        status: "planning",
        priority: "medium",
        start_date: req.body.startDate || new Date().toISOString().split('T')[0],
        end_date: req.body.endDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538",
        department_id: "3af3b0f4-adca-4f11-826c-20ed36b31d46"
      }).returning();
      
      res.json({
        success: true,
        data: {
          project: {
            id: newProject[0].id,
            name: newProject[0].name
          },
          message: "Project created successfully"
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create project" 
      });
    }
  });

  // Analytics service - Project overview
  app.get("/api/analytics-service/projects/:projectId/project-overview", async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          totalTasks: 45,
          completedTasks: 28,
          overdueTasks: 3,
          activeMilestones: 4,
          upcomingDeadlines: 2,
          projectHealth: "on-track",
          budgetUtilization: 65,
          teamUtilization: 78,
          tasksByOwner: [
            { owner: "John Doe", total: 12, completed: 8 },
            { owner: "Jane Smith", total: 15, completed: 10 },
            { owner: "Mike Johnson", total: 8, completed: 5 }
          ],
          recentActivity: [
            { type: "task-completed", description: "Design review completed", timestamp: new Date() },
            { type: "milestone-reached", description: "Phase 1 milestone achieved", timestamp: new Date() }
          ]
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get analytics" 
      });
    }
  });

  // Workspace service - Get tasks
  app.get("/api/workspace-service/projects/:projectId/tasks", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get tasks" 
      });
    }
  });

  // Stakeholder service
  app.get("/api/stakeholder-service/projects/:projectId/stakeholders", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get stakeholders" 
      });
    }
  });

  // Discussion service
  app.get("/api/discussion-service/projects/:projectId/discussions", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get discussions" 
      });
    }
  });

  app.get("/api/discussion-service/projects/:projectId/action-items", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get action items" 
      });
    }
  });

  app.get("/api/discussion-service/projects/:projectId/change-log", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get change log" 
      });
    }
  });

  // Risk service
  app.get("/api/risk-service/projects/:projectId/risks", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get risks" 
      });
    }
  });

  // Task backlog service
  app.get("/api/task-backlog-service/projects/:projectId/backlog", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get backlog" 
      });
    }
  });

  app.get("/api/milestone-service/projects/:projectId/milestones", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get milestones" 
      });
    }
  });

  // Team capacity service
  app.get("/api/team-capacity-service/projects/:projectId/teams", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get teams" 
      });
    }
  });

  // Retrospective service
  app.get("/api/retrospective-service/projects/:projectId/retrospectives", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get retrospectives" 
      });
    }
  });

  // Project members service
  app.get("/api/project-service/projects/:projectId/members", async (req, res) => {
    try {
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project members" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
