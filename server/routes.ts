import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { storage } from "./storage";
import { BackupAnalyzer } from "./services/backup-analyzer";
import { DatabaseRestorer } from "./services/database-restorer";
import { DatabaseVerifier } from "./services/verification";
import { insertMigrationJobSchema } from "@shared/schema";

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

const backupAnalyzer = new BackupAnalyzer();
const databaseRestorer = new DatabaseRestorer();
const databaseVerifier = new DatabaseVerifier();

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
          role: "admin"
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
      // Return some sample projects for now
      res.json({
        success: true,
        data: [
          {
            id: "proj-1",
            name: "Airbus A350 Engine Optimization",
            description: "Optimize engine performance for next generation aircraft",
            status: "active",
            priority: "high",
            start_date: "2024-01-15",
            end_date: "2024-12-31",
            created_by: req.params.userId || "user-1",
            created_at: "2024-01-15T00:00:00Z"
          },
          {
            id: "proj-2", 
            name: "Flight Management System Upgrade",
            description: "Modernize flight management system software",
            status: "planning",
            priority: "medium",
            start_date: "2024-03-01",
            end_date: "2024-11-30",
            created_by: req.params.userId || "user-1",
            created_at: "2024-02-01T00:00:00Z"
          }
        ]
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
      
      // Return project details based on ID
      const projects = {
        "proj-1": {
          id: "proj-1",
          name: "Airbus A350 Engine Optimization",
          description: "Optimize engine performance for next generation aircraft",
          status: "active",
          priority: "high",
          start_date: "2024-01-15",
          end_date: "2024-12-31",
          created_by: "user-1",
          created_at: "2024-01-15T00:00:00Z",
          department_id: "dept-1"
        },
        "proj-2": {
          id: "proj-2", 
          name: "Flight Management System Upgrade",
          description: "Modernize flight management system software",
          status: "planning",
          priority: "medium",
          start_date: "2024-03-01",
          end_date: "2024-11-30",
          created_by: "user-1",
          created_at: "2024-02-01T00:00:00Z",
          department_id: "dept-2"
        }
      };

      const project = projects[projectId as keyof typeof projects];
      if (!project) {
        return res.status(404).json({
          success: false,
          error: "Project not found"
        });
      }

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project" 
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

  const httpServer = createServer(app);
  return httpServer;
}
