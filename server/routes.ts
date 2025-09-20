import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import nodemailer from 'nodemailer';
import { storage } from "./storage";
import { BackupAnalyzer } from "./services/backup-analyzer";
import { DatabaseRestorer } from "./services/database-restorer";
import { DatabaseVerifier } from "./services/verification";
import { JiraService, defaultJiraFieldMapping } from "./services/jiraService";
import { insertMigrationJobSchema, projects, insertProjectSchema, budgetTypeConfig, projectBudgets, budgetCategories, budgetSpending, budgetReceipts, insertBudgetCategorySchema, insertBudgetSpendingSchema, tasks, milestones, stakeholders, riskRegister, projectDiscussions, discussionActionItems, discussionChangeLog, projectMembers, taskBacklog, teams, teamMembers, teamCapacityIterations, teamCapacityMembers, iterationWeeks, weeklyAvailability, insertTaskSchema, insertMilestoneSchema, insertStakeholderSchema, insertRiskSchema, insertProjectDiscussionSchema, insertDiscussionActionItemSchema, insertProjectMemberSchema, insertTaskBacklogSchema, insertTeamSchema, insertTeamMemberSchema, insertTeamCapacityIterationSchema, insertTeamCapacityMemberSchema, insertIterationWeekSchema, insertWeeklyAvailabilitySchema, users, retrospectives, retrospectiveColumns, retrospectiveCards, retrospectiveActionItems, retrospectiveCardVotes, insertRetrospectiveSchema, insertRetrospectiveColumnSchema, insertRetrospectiveCardSchema, insertRetrospectiveActionItemSchema, jiraIntegrations, jiraSyncHistory, insertJiraIntegrationSchema, insertJiraSyncHistorySchema } from "@shared/schema";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, exists, or, isNull, desc, gte, lte, sum, count, isNotNull, inArray, like, sql } from 'drizzle-orm';
import { db } from './db';

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

const backupAnalyzer = new BackupAnalyzer();
const databaseRestorer = new DatabaseRestorer();
const databaseVerifier = new DatabaseVerifier();

// Portfolio analytics helper functions
const getProjectStatusDistribution = async (userId: string) => {
  const projectStatusQuery = await db
    .select({
      status: projects.status,
      count: count()
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.project_id, projects.id))
    .where(eq(projectMembers.user_id, userId))
    .groupBy(projects.status);
    
  return projectStatusQuery;
};

const getResourceUtilization = async (userId: string) => {
  const resourceQuery = await db
    .select({
      user_id: teamMembers.user_id,
      total_tasks: sql<number>`COUNT(DISTINCT ${tasks.id})`,
      completed_tasks: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${tasks.status} = 'completed' THEN ${tasks.id} END), 0)`,
      in_progress_tasks: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${tasks.status} = 'in_progress' THEN ${tasks.id} END), 0)`
    })
    .from(teamMembers)
    .leftJoin(teams, eq(teams.id, teamMembers.team_id))
    .leftJoin(tasks, and(
      eq(tasks.owner_id, teamMembers.user_id),
      eq(tasks.project_id, teams.project_id)
    ))
    .innerJoin(projectMembers, eq(projectMembers.project_id, teams.project_id))
    .where(eq(projectMembers.user_id, userId))
    .groupBy(teamMembers.user_id);
    
  return resourceQuery;
};

// Email service setup
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Authentication middleware
async function verifyToken(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? 
        (() => { throw new Error('JWT_SECRET is required in production'); })() : 
        'dev_jwt_secret');
      const decoded = jwt.verify(token, secret) as any;
      
      // Fetch user from database to ensure they still exist
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

      if (user.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
      
      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // CORS configuration for local development
  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      try {
        const allowedEnv = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
        const isLocalhost = !!origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        const isAllowedEnv = !!origin && allowedEnv.includes(origin);
        let isReplitEnv = false;
        try {
          if (origin) {
            const hostname = new URL(origin).hostname;
            isReplitEnv = /replit\.dev$/.test(hostname);
          }
        } catch {}

        // Allow same-origin requests (no origin header), localhost, and configured origins
        if (!origin || isLocalhost || isAllowedEnv || isReplitEnv) {
          return callback(null, true);
        }
      } catch {}
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey'],
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  
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

  // Projects service - Delete project
  app.delete("/api/projects-service/projects/:id", async (req, res) => {
    try {
      const projectId = req.params.id;
      
      const deletedProject = await db.delete(projects)
        .where(eq(projects.id, projectId))
        .returning();
        
      if (deletedProject.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Project not found"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Project deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete project" 
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
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: "Email and password are required"
        });
      }

      // Find user in database
      const userResult = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      
      if (userResult.length === 0) {
        return res.status(401).json({
          success: false,
          error: "Invalid credentials"
        });
      }

      const user = userResult[0];
      
      // Verify password using bcrypt
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: "Invalid credentials"
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET || 'dev_jwt_secret',
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            full_name: "Project Manager", // TODO: Add full_name to users table
            role: user.role,
            department_id: "dept-1" // TODO: Add department relationship
          },
          session: {
            access_token: token,
            user: {
              id: user.id,
              email: user.email
            }
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Login failed" 
      });
    }
  });

  // Auth service - Register/Signup
  app.post("/api/auth-service/register", async (req, res) => {
    try {
      const { email, password, fullName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: "Email and password are required"
        });
      }

      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      
      if (existingUser.length > 0) {
        return res.status(409).json({
          success: false,
          error: "User already exists"
        });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create new user
      const newUser = await db.insert(users).values({
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date()
      }).returning();

      const createdUser = newUser[0];

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: createdUser.id, 
          email: createdUser.email,
          role: createdUser.role
        },
        process.env.JWT_SECRET || 'dev_jwt_secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: createdUser.id,
            email: createdUser.email,
            full_name: fullName || createdUser.email,
            role: createdUser.role,
            department_id: null
          },
          session: {
            access_token: token,
            user: {
              id: createdUser.id,
              email: createdUser.email
            }
          }
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Registration failed" 
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
          { module: "access_control", access_level: "write" },
          { module: "jira_sync", access_level: "write" }
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
  app.get("/api/analytics-service/projects/:projectId/project-overview", verifyToken, async (req, res) => {
    try {
      const { projectId } = req.params;
      
      // Task analytics
      const projectTasks = await db.select().from(tasks).where(eq(tasks.project_id, projectId));
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
      const overdueTasksData = projectTasks.filter(t => 
        t.due_date && new Date(t.due_date) < new Date() && 
        t.status !== 'completed' && t.status !== 'done'
      );
      const overdueTasks = overdueTasksData.length;
      const avgCompletionTime = totalTasks > 0 ? 5.2 : 0; // Can be calculated from actual data later

      // Milestone analytics  
      const projectMilestones = await db.select().from(milestones).where(eq(milestones.project_id, projectId));
      const totalMilestones = projectMilestones.length;
      const completedMilestones = projectMilestones.filter(m => m.status === 'completed').length;
      
      // Budget analytics
      const budgetData = await db.select().from(projectBudgets).where(eq(projectBudgets.project_id, projectId));
      const totalAllocated = budgetData.reduce((sum, b) => sum + (parseFloat(b.total_budget_allocated?.toString() || '0')), 0);
      const totalReceived = budgetData.reduce((sum, b) => sum + (parseFloat(b.total_budget_received?.toString() || '0')), 0);
      
      const spendingData = await db.select().from(budgetSpending)
        .innerJoin(budgetCategories, eq(budgetSpending.budget_category_id, budgetCategories.id))
        .innerJoin(projectBudgets, eq(budgetCategories.project_budget_id, projectBudgets.id))
        .where(eq(projectBudgets.project_id, projectId));
      const totalSpent = spendingData.reduce((sum, s) => sum + (parseFloat(s.budget_spending?.amount?.toString() || '0')), 0);
      
      // Team analytics
      const teamData = await db.select().from(teamCapacityMembers)
        .leftJoin(teamCapacityIterations, eq(teamCapacityMembers.iteration_id, teamCapacityIterations.id))
        .where(eq(teamCapacityIterations.project_id, projectId));
      const totalMembers = new Set(teamData.map(t => t.team_capacity_members?.stakeholder_id)).size;
      const avgCapacity = teamData.length > 0 ? 
        teamData.reduce((sum, t) => sum + (t.team_capacity_members?.availability_percent || 0), 0) / teamData.length : 0;

      // Risk analytics
      const riskData = await db.select().from(riskRegister).where(eq(riskRegister.project_id, projectId));
      const totalRisks = riskData.length;
      const highRisks = riskData.filter(r => (r.likelihood || 0) * (r.impact || 0) >= 9).length;
      const mitigatedRisks = riskData.filter(r => r.status === 'closed' || r.status === 'mitigated').length;

      // Stakeholder analytics  
      const stakeholderData = await db.select().from(stakeholders).where(eq(stakeholders.project_id, projectId));
      const totalStakeholders = stakeholderData.length;
      
      // Create overdue tasks list with detailed information (after stakeholder data is fetched)
      const overdueTasksList = overdueTasksData.map(task => {
        const dueDate = new Date(task.due_date!);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Find task owner name
        const owner = stakeholderData.find(s => s.id === task.owner_id);
        
        return {
          id: task.id,
          title: task.title,
          owner: owner?.name || 'Unassigned',
          dueDate: dueDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
          daysOverdue
        };
      });

      // Project health calculation
      const budgetHealth = totalAllocated > 0 ? Math.max(0, 100 - (totalSpent / totalAllocated * 100)) : 100;
      const timelineHealth = totalMilestones > 0 ? (completedMilestones / totalMilestones * 100) : 50;
      const riskHealth = totalRisks > 0 ? Math.max(0, 100 - (highRisks / totalRisks * 100)) : 100;
      const teamHealth = avgCapacity;
      const overallHealth = (budgetHealth + timelineHealth + riskHealth + teamHealth) / 4;

      // Task distribution by status with colors
      const tasksByStatus = [
        { status: 'todo', count: projectTasks.filter(t => t.status === 'todo').length, color: '#6b7280' },
        { status: 'in_progress', count: projectTasks.filter(t => t.status === 'in_progress').length, color: '#3b82f6' },
        { status: 'completed', count: completedTasks, color: '#10b981' },
        { status: 'on_hold', count: projectTasks.filter(t => t.status === 'on_hold').length, color: '#f59e0b' }
      ];

      // Get stakeholders for task owner mapping
      const tasksByOwner = stakeholderData.map(stakeholder => {
        const userTasks = projectTasks.filter(task => task.owner_id === stakeholder.id);
        return {
          owner: stakeholder.name,
          total: userTasks.length,
          completed: userTasks.filter(task => task.status === 'completed').length,
          inProgress: userTasks.filter(task => task.status === 'in_progress').length,
          blocked: userTasks.filter(task => task.status === 'on_hold').length
        };
      }).filter(owner => owner.total > 0);

      // Add unassigned tasks
      const unassignedTasks = projectTasks.filter(task => !task.owner_id);
      if (unassignedTasks.length > 0) {
        tasksByOwner.push({
          owner: 'Unassigned',
          total: unassignedTasks.length,
          completed: unassignedTasks.filter(task => task.status === 'completed').length,
          inProgress: unassignedTasks.filter(task => task.status === 'in_progress').length,
          blocked: unassignedTasks.filter(task => task.status === 'on_hold').length
        });
      }

      const analyticsData = {
        projectHealth: {
          overall: Math.round(overallHealth),
          budget: Math.round(budgetHealth),
          timeline: Math.round(timelineHealth),
          risks: Math.round(riskHealth),
          team: Math.round(teamHealth)
        },
        budgetAnalytics: {
          totalAllocated,
          totalSpent,
          remainingBudget: totalAllocated - totalSpent,
          spendByCategory: [],
          burnRate: []
        },
        teamPerformance: {
          totalMembers,
          activeMembers: totalMembers,
          avgCapacity: Math.round(avgCapacity),
          avgEfficiency: 85,
          topPerformers: [],
          capacityTrend: []
        },
        taskAnalytics: {
          totalTasks,
          completedTasks,
          overdueTasks,
          avgCompletionTime,
          tasksByStatus,
          tasksByOwner,
          overdueTasksList,
          productivityTrend: []
        },
        riskAnalysis: {
          totalRisks,
          highRisks,
          mitigatedRisks,
          risks: riskData.map(risk => ({
            id: risk.id,
            title: risk.title,
            category: risk.category,
            probability: risk.likelihood,
            impact: risk.impact,
            status: risk.status,
            mitigation_plan: risk.mitigation_strategy
          })),
          riskHeatmap: riskData.length > 0 ? riskData.map(risk => ({
            name: risk.title,
            value: (risk.likelihood || 0) * (risk.impact || 0),
            probability: risk.likelihood,
            impact: risk.impact
          })) : [],
          risksByCategory: []
        },
        milestoneAnalytics: {
          totalMilestones,
          completedMilestones,
          milestones: projectMilestones.map(milestone => {
            const milestoneTasks = projectTasks.filter(task => task.milestone_id === milestone.id);
            return {
              id: milestone.id,
              title: milestone.title,
              due_date: milestone.due_date,
              status: milestone.status,
              tasks: milestoneTasks.map(task => ({
                id: task.id,
                title: task.title,
                status: task.status
              }))
            };
          })
        },
        stakeholderEngagement: {
          totalStakeholders,
          activeStakeholders: totalStakeholders,
          recentMeetings: 0,
          communicationFrequency: []
        },
        retrospectiveInsights: {
          totalRetrospectives: 0,
          actionItemsCreated: 0,
          actionItemsCompleted: 0,
          satisfactionTrend: []
        }
      };

      res.json({
        success: true,
        data: analyticsData
      });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get analytics" 
      });
    }
  });

  // Workspace service - Get tasks
  app.get("/api/workspace-service/projects/:projectId/tasks", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const projectTasks = await db.select().from(tasks).where(eq(tasks.project_id, projectId));
      
      res.json({
        success: true,
        data: projectTasks
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get tasks" 
      });
    }
  });

  // Workspace service - Create task
  app.post("/api/workspace-service/projects/:projectId/tasks", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      
      // Map camelCase to snake_case for database compatibility
      const mappedData = {
        title: req.body.title,
        description: req.body.description,
        status: req.body.status || 'todo',
        priority: req.body.priority || 'medium',
        due_date: req.body.dueDate || req.body.due_date || null,
        owner_id: req.body.ownerId || req.body.owner_id || null,
        milestone_id: req.body.milestoneId || req.body.milestone_id || null,
        project_id: projectId,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      };
      
      const taskData = insertTaskSchema.parse(mappedData);
      const newTask = await db.insert(tasks).values(taskData).returning();
      
      res.json({
        success: true,
        data: newTask[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create task" 
      });
    }
  });

  // Update task
  app.put("/api/workspace-service/tasks/:taskId", async (req, res) => {
    try {
      const taskId = req.params.taskId;
      const updateData: any = {};
      
      // Map frontend camelCase to backend snake_case
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.priority !== undefined) updateData.priority = req.body.priority;
      if (req.body.dueDate !== undefined) updateData.due_date = req.body.dueDate;
      if (req.body.ownerId !== undefined) updateData.owner_id = req.body.ownerId;
      if (req.body.milestoneId !== undefined) updateData.milestone_id = req.body.milestoneId;
      if (req.body.due_date !== undefined) updateData.due_date = req.body.due_date;
      if (req.body.owner_id !== undefined) updateData.owner_id = req.body.owner_id;
      if (req.body.milestone_id !== undefined) updateData.milestone_id = req.body.milestone_id;
      
      updateData.updated_at = new Date();
      
      const updatedTask = await db.update(tasks)
        .set(updateData)
        .where(eq(tasks.id, taskId))
        .returning();
        
      if (updatedTask.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Task not found"
        });
      }
      
      res.json({
        success: true,
        data: updatedTask[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to update task" 
      });
    }
  });

  // Delete task
  app.delete("/api/workspace-service/tasks/:taskId", async (req, res) => {
    try {
      const taskId = req.params.taskId;
      
      const deletedTask = await db.delete(tasks)
        .where(eq(tasks.id, taskId))
        .returning();
        
      if (deletedTask.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Task not found"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Task deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete task" 
      });
    }
  });

  // Stakeholder service
  app.get("/api/stakeholder-service/projects/:projectId/stakeholders", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const projectStakeholders = await db.select().from(stakeholders).where(eq(stakeholders.project_id, projectId));
      
      res.json({
        success: true,
        data: projectStakeholders
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get stakeholders" 
      });
    }
  });

  // Stakeholder service - Create stakeholder
  app.post("/api/stakeholder-service/projects/:projectId/stakeholders", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const stakeholderData = insertStakeholderSchema.parse({
        ...req.body,
        project_id: projectId,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newStakeholder = await db.insert(stakeholders).values(stakeholderData).returning();
      
      res.json({
        success: true,
        data: newStakeholder[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create stakeholder" 
      });
    }
  });

  // Stakeholder service - Update stakeholder
  app.put("/api/stakeholder-service/projects/:projectId/stakeholders/:stakeholderId", async (req, res) => {
    try {
      const stakeholderId = req.params.stakeholderId;
      
      // Filter out undefined values and only include fields that are provided
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.email !== undefined) updateData.email = req.body.email;
      if (req.body.department !== undefined) updateData.department = req.body.department;
      if (req.body.raci !== undefined) updateData.raci = req.body.raci;
      if (req.body.influence_level !== undefined) updateData.influence_level = req.body.influence_level;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      
      const updatedStakeholder = await db.update(stakeholders)
        .set(updateData)
        .where(eq(stakeholders.id, stakeholderId))
        .returning();
      
      if (updatedStakeholder.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Stakeholder not found"
        });
      }
      
      res.json({
        success: true,
        data: updatedStakeholder[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to update stakeholder" 
      });
    }
  });

  // Stakeholder service - Delete stakeholder
  app.delete("/api/stakeholder-service/projects/:projectId/stakeholders/:stakeholderId", async (req, res) => {
    try {
      const stakeholderId = req.params.stakeholderId;
      
      const deletedStakeholder = await db.delete(stakeholders)
        .where(eq(stakeholders.id, stakeholderId))
        .returning();
      
      if (deletedStakeholder.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Stakeholder not found"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Stakeholder deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete stakeholder" 
      });
    }
  });

  // Discussion service
  app.get("/api/discussion-service/projects/:projectId/discussions", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const discussions = await db.select().from(projectDiscussions).where(eq(projectDiscussions.project_id, projectId));
      
      res.json({
        success: true,
        data: discussions
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get discussions" 
      });
    }
  });

  // Create discussion
  app.post("/api/discussion-service/projects/:projectId/discussions", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const discussionData = insertProjectDiscussionSchema.parse({
        ...req.body,
        project_id: projectId,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newDiscussion = await db.insert(projectDiscussions).values(discussionData).returning();
      
      res.json({
        success: true,
        data: newDiscussion[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create discussion" 
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
      const projectId = req.params.projectId;
      const projectRisks = await db.select().from(riskRegister).where(eq(riskRegister.project_id, projectId));
      
      res.json({
        success: true,
        data: projectRisks
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get risks" 
      });
    }
  });

  app.get("/api/workspace-service/projects/:projectId/risks", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const projectRisks = await db.select().from(riskRegister).where(eq(riskRegister.project_id, projectId));
      
      res.json({
        success: true,
        data: projectRisks
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get risks" 
      });
    }
  });

  // Risk service - Create risk
  app.post("/api/risk-service/projects/:projectId/risks", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const riskData = insertRiskSchema.parse({
        ...req.body,
        project_id: projectId,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newRisk = await db.insert(riskRegister).values(riskData).returning();
      
      res.json({
        success: true,
        data: newRisk[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create risk" 
      });
    }
  });

  app.post("/api/workspace-service/projects/:projectId/risks", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const riskData = insertRiskSchema.parse({
        ...req.body,
        project_id: projectId,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newRisk = await db.insert(riskRegister).values(riskData).returning();
      
      res.json({
        success: true,
        data: newRisk[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create risk" 
      });
    }
  });

  // Update risk
  app.put("/api/workspace-service/projects/:projectId/risks/:riskId", async (req, res) => {
    try {
      const riskId = req.params.riskId;
      const updateData = {
        ...req.body,
        updated_at: new Date()
      };
      
      const updatedRisk = await db.update(riskRegister)
        .set(updateData)
        .where(eq(riskRegister.id, riskId))
        .returning();
        
      if (updatedRisk.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Risk not found"
        });
      }
      
      res.json({
        success: true,
        data: updatedRisk[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to update risk" 
      });
    }
  });

  // Delete risk
  app.delete("/api/workspace-service/projects/:projectId/risks/:riskId", async (req, res) => {
    try {
      const riskId = req.params.riskId;
      
      const deletedRisk = await db.delete(riskRegister)
        .where(eq(riskRegister.id, riskId))
        .returning();
        
      if (deletedRisk.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Risk not found"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Risk deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete risk" 
      });
    }
  });

  // Workspace service - Get action items
  app.get("/api/workspace-service/projects/:projectId/action-items", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const actionItems = await db.select().from(discussionActionItems)
        .innerJoin(projectDiscussions, eq(discussionActionItems.discussion_id, projectDiscussions.id))
        .where(eq(projectDiscussions.project_id, projectId));
      
      res.json({
        success: true,
        data: actionItems.map(item => item.discussion_action_items)
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get action items" 
      });
    }
  });

  // Workspace service - Create action item
  app.post("/api/workspace-service/projects/:projectId/action-items", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      
      // First create a discussion if one doesn't exist or use existing
      let discussionId = req.body.discussion_id;
      if (!discussionId) {
        // Create a default discussion for action items
        const discussionData = insertProjectDiscussionSchema.parse({
          title: `Action Items Discussion - ${new Date().toISOString().split('T')[0]}`,
          description: "Auto-created discussion for action items",
          project_id: projectId,
          created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
        });
        
        const newDiscussion = await db.insert(projectDiscussions).values(discussionData).returning();
        discussionId = newDiscussion[0].id;
      }
      
      // Create the action item
      const actionItemData = insertDiscussionActionItemSchema.parse({
        ...req.body,
        discussion_id: discussionId,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newActionItem = await db.insert(discussionActionItems).values(actionItemData).returning();
      
      res.json({
        success: true,
        data: newActionItem[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create action item" 
      });
    }
  });

  // Workspace service - Delete action item
  app.delete("/api/workspace-service/projects/:projectId/action-items/:actionItemId", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const actionItemId = req.params.actionItemId;
      
      // Delete action item with project scoping by joining with discussion
      const deletedActionItem = await db.delete(discussionActionItems)
        .where(
          and(
            eq(discussionActionItems.id, actionItemId),
            exists(
              db.select().from(projectDiscussions)
                .where(
                  and(
                    eq(projectDiscussions.id, discussionActionItems.discussion_id),
                    eq(projectDiscussions.project_id, projectId)
                  )
                )
            )
          )
        )
        .returning();
        
      if (deletedActionItem.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Action item not found or not accessible"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Action item deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete action item" 
      });
    }
  });

  // Workspace service - Get discussions
  app.get("/api/workspace-service/projects/:projectId/discussions", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const discussions = await db.select().from(projectDiscussions).where(eq(projectDiscussions.project_id, projectId));
      
      res.json({
        success: true,
        data: discussions
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get discussions" 
      });
    }
  });

  // Workspace service - Create discussion
  app.post("/api/workspace-service/projects/:projectId/discussions", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const discussionData = insertProjectDiscussionSchema.parse({
        ...req.body,
        project_id: projectId,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newDiscussion = await db.insert(projectDiscussions).values(discussionData).returning();
      
      res.json({
        success: true,
        data: newDiscussion[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create discussion" 
      });
    }
  });

  // Workspace service - Delete discussion
  app.delete("/api/workspace-service/projects/:projectId/discussions/:discussionId", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const discussionId = req.params.discussionId;
      
      const deletedDiscussion = await db.delete(projectDiscussions)
        .where(and(eq(projectDiscussions.id, discussionId), eq(projectDiscussions.project_id, projectId)))
        .returning();
        
      if (deletedDiscussion.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Discussion not found or not accessible"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Discussion deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete discussion" 
      });
    }
  });

  // Workspace service - Get change log
  app.get("/api/workspace-service/projects/:projectId/change-log", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const changeLog = await db.select().from(discussionChangeLog)
        .innerJoin(projectDiscussions, eq(discussionChangeLog.discussion_id, projectDiscussions.id))
        .where(eq(projectDiscussions.project_id, projectId));
      
      res.json({
        success: true,
        data: changeLog.map(item => item.discussion_change_log)
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get change log" 
      });
    }
  });

  // Workspace service - Get project members
  app.get("/api/workspace-service/projects/:projectId/members", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const members = await db.select().from(projectMembers).where(eq(projectMembers.project_id, projectId));
      
      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project members" 
      });
    }
  });

  // Task backlog service
  app.get("/api/task-backlog-service/projects/:projectId/backlog", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const backlogItems = await db.select().from(taskBacklog).where(eq(taskBacklog.project_id, projectId));
      
      res.json({
        success: true,
        data: backlogItems
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get backlog" 
      });
    }
  });

  // Backlog service (alias)
  app.get("/api/backlog-service/projects/:projectId/backlog", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const backlogItems = await db.select().from(taskBacklog).where(eq(taskBacklog.project_id, projectId));
      
      res.json({
        success: true,
        data: backlogItems
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get backlog" 
      });
    }
  });

  // Backlog service - Create backlog item
  app.post("/api/backlog-service/projects/:projectId/backlog", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const backlogData = insertTaskBacklogSchema.parse({
        ...req.body,
        project_id: projectId,
        status: req.body.status || 'backlog',
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newBacklogItem = await db.insert(taskBacklog).values(backlogData).returning();
      
      res.json({
        success: true,
        data: newBacklogItem[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create backlog item" 
      });
    }
  });

  // Backlog service - Delete backlog item
  app.delete("/api/backlog-service/projects/:projectId/backlog/:itemId", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const itemId = req.params.itemId;
      
      const deletedItem = await db.delete(taskBacklog)
        .where(and(eq(taskBacklog.id, itemId), eq(taskBacklog.project_id, projectId)))
        .returning();
        
      if (deletedItem.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Backlog item not found or not accessible"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Backlog item deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete backlog item" 
      });
    }
  });

  // Backlog service - Move backlog item to milestone
  app.post("/api/backlog-service/projects/:projectId/backlog/:itemId/move", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const itemId = req.params.itemId;
      const { milestoneId } = req.body;
      
      if (!milestoneId) {
        return res.status(400).json({
          success: false,
          error: "Milestone ID is required"
        });
      }
      
      // Get the backlog item and validate ownership
      const backlogItem = await db.select().from(taskBacklog)
        .where(and(eq(taskBacklog.id, itemId), eq(taskBacklog.project_id, projectId)));
      
      if (backlogItem.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Backlog item not found or not accessible"
        });
      }
      
      // Validate milestone exists and belongs to the project
      const milestone = await db.select().from(milestones)
        .where(and(eq(milestones.id, milestoneId), eq(milestones.project_id, projectId)));
      
      if (milestone.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Milestone not found or not accessible"
        });
      }
      
      // Create a new task from the backlog item with proper validation
      const taskData = {
        project_id: projectId,
        milestone_id: milestoneId,
        title: backlogItem[0].title,
        description: backlogItem[0].description || null,
        priority: backlogItem[0].priority || 'medium',
        status: 'todo',
        owner_id: backlogItem[0].owner_id || null,
        due_date: backlogItem[0].target_date || null,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      };
      
      const newTask = await db.insert(tasks).values(taskData).returning();
      
      // Update backlog item status to 'done'
      await db.update(taskBacklog)
        .set({ status: 'done' })
        .where(eq(taskBacklog.id, itemId));
      
      res.json({
        success: true,
        data: {
          message: "Backlog item moved to milestone successfully",
          task: newTask[0]
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to move backlog item" 
      });
    }
  });

  // Roadmap service
  app.get("/api/roadmap-service/projects/:projectId/roadmap", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const [projectTasks, projectMilestones] = await Promise.all([
        db.select().from(tasks).where(eq(tasks.project_id, projectId)),
        db.select().from(milestones).where(eq(milestones.project_id, projectId))
      ]);
      
      res.json({
        success: true,
        data: {
          tasks: projectTasks,
          milestones: projectMilestones,
          timeline: {
            viewMode: 'monthly',
            currentDate: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get roadmap data" 
      });
    }
  });

  app.get("/api/milestone-service/projects/:projectId/milestones", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const projectMilestones = await db.select().from(milestones).where(eq(milestones.project_id, projectId));
      
      res.json({
        success: true,
        data: projectMilestones
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get milestones" 
      });
    }
  });

  app.get("/api/workspace-service/projects/:projectId/milestones", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const projectMilestones = await db.select().from(milestones).where(eq(milestones.project_id, projectId));
      
      res.json({
        success: true,
        data: projectMilestones
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get milestones" 
      });
    }
  });

  // Milestone service - Create milestone
  app.post("/api/milestone-service/projects/:projectId/milestones", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const milestoneData = insertMilestoneSchema.parse({
        ...req.body,
        project_id: projectId,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newMilestone = await db.insert(milestones).values(milestoneData).returning();
      
      res.json({
        success: true,
        data: newMilestone[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create milestone" 
      });
    }
  });

  // Milestone service - Update milestone
  app.put("/api/milestone-service/projects/:projectId/milestones/:milestoneId", async (req, res) => {
    try {
      const milestoneId = req.params.milestoneId;
      const updateData = {
        name: req.body.name,
        description: req.body.description,
        due_date: req.body.dueDate,
        status: req.body.status,
        updated_at: new Date().toISOString()
      };
      
      const updatedMilestone = await db.update(milestones)
        .set(updateData)
        .where(eq(milestones.id, milestoneId))
        .returning();
      
      if (updatedMilestone.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Milestone not found"
        });
      }
      
      res.json({
        success: true,
        data: updatedMilestone[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to update milestone" 
      });
    }
  });

  // Milestone service - Delete milestone
  app.delete("/api/milestone-service/projects/:projectId/milestones/:milestoneId", async (req, res) => {
    try {
      const milestoneId = req.params.milestoneId;
      
      const deletedMilestone = await db.delete(milestones)
        .where(eq(milestones.id, milestoneId))
        .returning();
      
      if (deletedMilestone.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Milestone not found"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Milestone deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete milestone" 
      });
    }
  });

  // Teams API endpoints
  app.get("/api/projects/:projectId/teams", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const projectTeams = await db.select().from(teams).where(eq(teams.project_id, projectId));
      
      // Get member count for each team
      const teamsWithCounts = await Promise.all(projectTeams.map(async (team) => {
        const memberCount = await db.select().from(teamMembers).where(eq(teamMembers.team_id, team.id));
        return {
          ...team,
          member_count: memberCount.length
        };
      }));
      
      res.json({
        success: true,
        data: teamsWithCounts
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get teams" 
      });
    }
  });

  app.post("/api/projects/:projectId/teams", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const teamData = insertTeamSchema.parse({
        name: req.body.name || req.body.team_name,
        description: req.body.description,
        project_id: projectId,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newTeam = await db.insert(teams).values(teamData).returning();
      
      res.json({
        success: true,
        data: newTeam[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create team" 
      });
    }
  });

  // Team service - Delete team (aligned with existing pattern)
  app.delete("/api/projects/:projectId/teams/:teamId", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const teamId = req.params.teamId;
      
      const deletedTeam = await db.delete(teams)
        .where(and(eq(teams.id, teamId), eq(teams.project_id, projectId)))
        .returning();
        
      if (deletedTeam.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Team not found or not accessible"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Team deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete team" 
      });
    }
  });

  // Team service - Delete team (legacy alias for backward compatibility)
  app.delete("/api/capacity-service/teams/:teamId", async (req, res) => {
    try {
      const teamId = req.params.teamId;
      
      const deletedTeam = await db.delete(teams)
        .where(eq(teams.id, teamId))
        .returning();
        
      if (deletedTeam.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Team not found"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Team deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete team" 
      });
    }
  });

  // Team service - Delete team (frontend expected endpoint)
  app.delete("/api/teams/:teamId", async (req, res) => {
    try {
      const teamId = req.params.teamId;
      
      const deletedTeam = await db.delete(teams)
        .where(eq(teams.id, teamId))
        .returning();
        
      if (deletedTeam.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Team not found"
        });
      }
      
      res.json({
        success: true,
        data: { message: "Team deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete team" 
      });
    }
  });

  app.get("/api/teams/:teamId/members", async (req, res) => {
    try {
      const teamId = req.params.teamId;
      const members = await db.select().from(teamMembers).where(eq(teamMembers.team_id, teamId));
      
      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get team members" 
      });
    }
  });

  app.post("/api/teams/:teamId/members", async (req, res) => {
    try {
      const teamId = req.params.teamId;
      const memberData = insertTeamMemberSchema.parse({
        display_name: req.body.member_name || req.body.display_name,
        role: req.body.role,
        email: req.body.email,
        work_mode: req.body.work_mode || "office",
        team_id: teamId
      });
      
      const newMember = await db.insert(teamMembers).values(memberData).returning();
      
      res.json({
        success: true,
        data: newMember[0]
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create team member" 
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

  // Capacity service endpoints
  app.get("/api/capacity-service/projects/:projectId/capacity", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      
      // Get iterations
      const iterationsResult = await db.select().from(teamCapacityIterations)
        .where(eq(teamCapacityIterations.project_id, projectId))
        .orderBy(teamCapacityIterations.start_date);
      
      const iterations = iterationsResult.map(iteration => ({
        ...iteration,
        // Calculate effective capacity (placeholder calculation)
        totalEffectiveCapacity: iteration.working_days * 7, // Rough estimate
      }));
      
      res.json({
        success: true,
        data: {
          projectId,
          iterations,
          summary: {
            totalIterations: iterations.length,
            totalCapacity: iterations.reduce((sum, iter) => sum + (iter.totalEffectiveCapacity || 0), 0)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching capacity data:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch capacity data" 
      });
    }
  });

  // Helper function to create iteration weeks
  const createIterationWeeks = async (iterationId: string, startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const weeks = [];
    
    let weekIndex = 1;
    let currentStart = new Date(start);
    
    while (currentStart <= end) {
      const weekEnd = new Date(currentStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to get week end
      
      // Don't go beyond iteration end date
      if (weekEnd > end) {
        weekEnd.setTime(end.getTime());
      }
      
      weeks.push({
        iteration_id: iterationId,
        week_index: weekIndex,
        week_start: currentStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0]
      });
      
      // Move to next week
      currentStart.setDate(currentStart.getDate() + 7);
      weekIndex++;
    }
    
    if (weeks.length > 0) {
      try {
        await db.insert(iterationWeeks).values(weeks);
        console.log(`Created ${weeks.length} weeks for iteration ${iterationId}`);
      } catch (error) {
        console.error('Failed to insert iteration weeks:', error);
        throw error;
      }
    }
  };

  app.post("/api/capacity-service/projects/:projectId/capacity", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const { type, iterationName, startDate, endDate, workingDays, committedStoryPoints, teamId } = req.body;
      
      if (type === 'iteration') {
        // Validate using Zod schema
        const iterationData = insertTeamCapacityIterationSchema.parse({
          project_id: projectId,
          iteration_name: iterationName,
          start_date: startDate,
          end_date: endDate,
          working_days: workingDays,
          team_id: teamId || null,
          committed_story_points: committedStoryPoints || 0,
          created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
        });
        
        const newIteration = await db.insert(teamCapacityIterations).values(iterationData).returning();
        
        // Create iteration weeks based on start/end dates
        if (newIteration[0] && startDate && endDate) {
          try {
            await createIterationWeeks(newIteration[0].id, startDate, endDate);
          } catch (error) {
            console.warn('Failed to create iteration weeks, continuing without weeks:', error);
          }
        }
        
        res.json({
          success: true,
          data: {
            message: 'Capacity iteration created successfully',
            iteration: newIteration[0]
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Invalid type. Only 'iteration' is supported."
        });
      }
    } catch (error) {
      console.error('Error creating capacity iteration:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create capacity iteration" 
      });
    }
  });

  app.put("/api/capacity-service/projects/:projectId/capacity/:iterationId", async (req, res) => {
    try {
      const { iterationId } = req.params;
      const { iterationName, startDate, endDate, workingDays, committedStoryPoints } = req.body;
      
      const updateData = {
        iteration_name: iterationName,
        start_date: startDate,
        end_date: endDate,
        working_days: workingDays,
        committed_story_points: committedStoryPoints || 0,
        updated_at: new Date()
      };
      
      const updatedIteration = await db.update(teamCapacityIterations)
        .set(updateData)
        .where(eq(teamCapacityIterations.id, iterationId))
        .returning();
      
      if (updatedIteration.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Iteration not found"
        });
      }
      
      res.json({
        success: true,
        data: {
          message: 'Iteration updated successfully',
          iteration: updatedIteration[0]
        }
      });
    } catch (error) {
      console.error('Error updating iteration:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to update iteration" 
      });
    }
  });

  // Get iteration weeks
  app.get("/api/capacity-service/iterations/:iterationId/weeks", async (req, res) => {
    try {
      const { iterationId } = req.params;
      
      const weeks = await db.select().from(iterationWeeks)
        .where(eq(iterationWeeks.iteration_id, iterationId))
        .orderBy(iterationWeeks.week_index);
      
      // If no weeks found, generate them from the iteration data
      if (weeks.length === 0) {
        const iteration = await db.select().from(teamCapacityIterations)
          .where(eq(teamCapacityIterations.id, iterationId))
          .limit(1);
          
        if (iteration.length > 0) {
          const { start_date, end_date } = iteration[0];
          try {
            await createIterationWeeks(iterationId, start_date, end_date);
            const newWeeks = await db.select().from(iterationWeeks)
              .where(eq(iterationWeeks.iteration_id, iterationId))
              .orderBy(iterationWeeks.week_index);
            return res.json({
              success: true,
              data: newWeeks
            });
          } catch (weekError) {
            console.warn('Failed to auto-create weeks:', weekError);
          }
        }
      }
      
      res.json({
        success: true,
        data: weeks
      });
    } catch (error) {
      console.error('Error fetching iteration weeks:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch iteration weeks" 
      });
    }
  });

  // Save weekly availability
  app.post("/api/capacity-service/iterations/:iterationId/availability", async (req, res) => {
    try {
      const { iterationId } = req.params;
      const { availability } = req.body;
      
      if (!Array.isArray(availability) || availability.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No availability data provided"
        });
      }
      
      let saved = 0;
      for (const item of availability) {
        try {
          const availabilityData = {
            iteration_id: iterationId,
            iteration_week_id: item.iteration_week_id,
            team_member_id: item.team_member_id,
            availability_percent: item.availability_percent || 100,
            leaves: item.leaves || 0,
            calculated_days_present: item.calculated_days_present || 5,
            calculated_days_total: item.calculated_days_total || 5,
            effective_capacity: item.effective_capacity?.toString() || "5.00",
            notes: item.notes || null
          };

          await db.insert(weeklyAvailability)
            .values(availabilityData)
            .onConflictDoUpdate({
              target: [weeklyAvailability.iteration_week_id, weeklyAvailability.team_member_id],
              set: {
                availability_percent: availabilityData.availability_percent,
                leaves: availabilityData.leaves,
                calculated_days_present: availabilityData.calculated_days_present,
                calculated_days_total: availabilityData.calculated_days_total,
                effective_capacity: availabilityData.effective_capacity,
                notes: availabilityData.notes,
                updated_at: new Date()
              }
            });
          saved++;
        } catch (error) {
          console.error('Error saving individual availability item:', error, item);
        }
      }
      
      res.json({
        success: true,
        data: {
          message: 'Availability saved successfully',
          updated: saved
        }
      });
    } catch (error) {
      console.error('Error saving weekly availability:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to save weekly availability" 
      });
    }
  });

  // Get weekly availability
  app.get("/api/capacity-service/iterations/:iterationId/availability", async (req, res) => {
    try {
      const { iterationId } = req.params;
      
      const availability = await db.select().from(weeklyAvailability)
        .where(eq(weeklyAvailability.iteration_id, iterationId));
      
      res.json({
        success: true,
        data: availability
      });
    } catch (error) {
      console.error('Error fetching weekly availability:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch weekly availability" 
      });
    }
  });

  app.delete("/api/capacity-service/projects/:projectId/capacity/:iterationId", async (req, res) => {
    try {
      const { iterationId } = req.params;
      const { type } = req.query;
      
      if (type === 'iteration') {
        const deletedIteration = await db.delete(teamCapacityIterations)
          .where(eq(teamCapacityIterations.id, iterationId))
          .returning();
        
        if (deletedIteration.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Iteration not found"
          });
        }
        
        res.json({
          success: true,
          data: { message: 'Iteration deleted successfully' }
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Invalid type parameter"
        });
      }
    } catch (error) {
      console.error('Error deleting iteration:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete iteration" 
      });
    }
  });

  // Retrospective service
  // ==================== RETROSPECTIVE SERVICE ENDPOINTS ====================
  
  // GET /api/retro-service/projects/:projectId/retrospectives - Get all retrospectives for a project
  app.get("/api/retro-service/projects/:projectId/retrospectives", async (req, res) => {
    try {
      const { projectId } = req.params;
      
      const retrospectiveList = await db
        .select({
          id: retrospectives.id,
          project_id: retrospectives.project_id,
          iteration_id: retrospectives.iteration_id,
          framework: retrospectives.framework,
          status: retrospectives.status,
          created_by: retrospectives.created_by,
          created_at: retrospectives.created_at,
          updated_at: retrospectives.updated_at,
        })
        .from(retrospectives)
        .where(eq(retrospectives.project_id, projectId))
        .orderBy(retrospectives.created_at);

      // Get columns and cards for each retrospective
      const retroData = await Promise.all(
        retrospectiveList.map(async (retro) => {
          const columns = await db
            .select()
            .from(retrospectiveColumns)
            .where(eq(retrospectiveColumns.retrospective_id, retro.id))
            .orderBy(retrospectiveColumns.column_order);

          const columnsWithCards = await Promise.all(
            columns.map(async (column) => {
              const cards = await db
                .select()
                .from(retrospectiveCards)
                .where(eq(retrospectiveCards.column_id, column.id))
                .orderBy(retrospectiveCards.card_order);

              return {
                ...column,
                cards
              };
            })
          );

          return {
            ...retro,
            columns: columnsWithCards
          };
        })
      );
      
      res.json({
        success: true,
        data: retroData
      });
    } catch (error) {
      console.error('Error fetching retrospectives:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get retrospectives" 
      });
    }
  });

  // POST /api/retro-service/projects/:projectId/retrospectives - Create a new retrospective
  app.post("/api/retro-service/projects/:projectId/retrospectives", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { framework = 'classic', iterationName } = req.body;
      
      // Create retrospective
      const [newRetrospective] = await db
        .insert(retrospectives)
        .values({
          project_id: projectId,
          iteration_id: iterationName,
          framework,
          status: 'active',
          created_by: req.body.userId || '00000000-0000-0000-0000-000000000000' // Default user ID
        })
        .returning();

      // Framework column templates
      const frameworkColumns = {
        classic: [
          { title: 'Start', subtitle: 'What should we start doing?' },
          { title: 'Stop', subtitle: 'What should we stop doing?' },
          { title: 'Continue', subtitle: 'What should we continue doing?' }
        ],
        '4ls': [
          { title: 'Liked', subtitle: 'What did we like?' },
          { title: 'Learned', subtitle: 'What did we learn?' },
          { title: 'Lacked', subtitle: 'What was missing or lacking?' },
          { title: 'Longed For', subtitle: 'What did we long for?' }
        ],
        kiss: [
          { title: 'Keep', subtitle: 'What should we continue doing?' },
          { title: 'Improve', subtitle: 'What could be improved?' },
          { title: 'Start', subtitle: 'What should we try next?' },
          { title: 'Stop', subtitle: 'What should we avoid?' }
        ],
        sailboat: [
          { title: 'Wind', subtitle: 'Things pushing the team forward' },
          { title: 'Anchor', subtitle: 'Things holding the team back' },
          { title: 'Rocks', subtitle: 'Risks or obstacles ahead' },
          { title: 'Island', subtitle: 'Goals or desired state' }
        ],
        mad_sad_glad: [
          { title: 'Mad', subtitle: 'What frustrated us?' },
          { title: 'Sad', subtitle: 'What disappointed us?' },
          { title: 'Glad', subtitle: 'What made us happy?' }
        ]
      };

      const columns = frameworkColumns[framework] || frameworkColumns.classic;
      
      // Create columns
      const columnInserts = columns.map((col, index) => ({
        retrospective_id: newRetrospective.id,
        title: col.title,
        subtitle: col.subtitle,
        column_order: index
      }));

      await db.insert(retrospectiveColumns).values(columnInserts);

      res.json({
        success: true,
        data: {
          message: 'Retrospective created successfully',
          retrospective: newRetrospective
        }
      });
    } catch (error) {
      console.error('Error creating retrospective:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create retrospective"
      });
    }
  });

  // GET /api/retro-service/retrospectives/:retrospectiveId/columns - Get columns for a retrospective
  app.get("/api/retro-service/retrospectives/:retrospectiveId/columns", async (req, res) => {
    try {
      const { retrospectiveId } = req.params;
      
      const columns = await db
        .select()
        .from(retrospectiveColumns)
        .where(eq(retrospectiveColumns.retrospective_id, retrospectiveId))
        .orderBy(retrospectiveColumns.column_order);

      res.json({
        success: true,
        data: columns
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get columns"
      });
    }
  });

  // GET /api/retro-service/retrospectives/:retrospectiveId/cards - Get cards for a retrospective
  app.get("/api/retro-service/retrospectives/:retrospectiveId/cards", async (req, res) => {
    try {
      const { retrospectiveId } = req.params;
      
      const cards = await db
        .select()
        .from(retrospectiveCards)
        .leftJoin(retrospectiveColumns, eq(retrospectiveCards.column_id, retrospectiveColumns.id))
        .where(eq(retrospectiveColumns.retrospective_id, retrospectiveId))
        .orderBy(retrospectiveCards.card_order);

      res.json({
        success: true,
        data: cards
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get cards"
      });
    }
  });

  // POST /api/retro-service/columns/:columnId/cards - Create a card in a column
  app.post("/api/retro-service/columns/:columnId/cards", async (req, res) => {
    try {
      const { columnId } = req.params;
      const { text, card_order = 0 } = req.body;
      
      const [newCard] = await db
        .insert(retrospectiveCards)
        .values({
          column_id: columnId,
          text,
          card_order,
          votes: 0,
          created_by: req.body.userId || '00000000-0000-0000-0000-000000000000'
        })
        .returning();

      res.json({
        success: true,
        data: {
          message: 'Card created successfully',
          card: newCard
        }
      });
    } catch (error) {
      console.error('Error creating card:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create card"
      });
    }
  });

  // PUT /api/retro-service/cards/:cardId - Update a card
  app.put("/api/retro-service/cards/:cardId", async (req, res) => {
    try {
      const { cardId } = req.params;
      const { text } = req.body;
      
      const [updatedCard] = await db
        .update(retrospectiveCards)
        .set({ text, updated_at: new Date() })
        .where(eq(retrospectiveCards.id, cardId))
        .returning();

      res.json({
        success: true,
        data: {
          message: 'Card updated successfully',
          card: updatedCard
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update card"
      });
    }
  });

  // DELETE /api/retro-service/cards/:cardId - Delete a card
  app.delete("/api/retro-service/cards/:cardId", async (req, res) => {
    try {
      const { cardId } = req.params;
      
      // First delete any votes for this card
      await db.delete(retrospectiveCardVotes).where(eq(retrospectiveCardVotes.card_id, cardId));
      
      // Then delete the card
      await db.delete(retrospectiveCards).where(eq(retrospectiveCards.id, cardId));

      res.json({
        success: true,
        data: {
          message: 'Card deleted successfully'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete card"
      });
    }
  });

  // POST /api/retro-service/cards/:cardId/vote - Vote on a card
  app.post("/api/retro-service/cards/:cardId/vote", async (req, res) => {
    try {
      const { cardId } = req.params;
      const userId = req.body.userId || '00000000-0000-0000-0000-000000000000';
      
      // Check if user already voted
      const existingVote = await db
        .select()
        .from(retrospectiveCardVotes)
        .where(and(
          eq(retrospectiveCardVotes.card_id, cardId),
          eq(retrospectiveCardVotes.user_id, userId)
        ))
        .limit(1);

      if (existingVote.length > 0) {
        // Remove vote
        await db
          .delete(retrospectiveCardVotes)
          .where(and(
            eq(retrospectiveCardVotes.card_id, cardId),
            eq(retrospectiveCardVotes.user_id, userId)
          ));
        
        // Decrease vote count
        const [card] = await db
          .select({ votes: retrospectiveCards.votes })
          .from(retrospectiveCards)
          .where(eq(retrospectiveCards.id, cardId));
        
        await db
          .update(retrospectiveCards)
          .set({ votes: Math.max(0, card.votes - 1) })
          .where(eq(retrospectiveCards.id, cardId));

        res.json({
          success: true,
          data: { message: 'Vote removed' }
        });
      } else {
        // Add vote
        await db
          .insert(retrospectiveCardVotes)
          .values({
            card_id: cardId,
            user_id: userId
          });
        
        // Increase vote count
        const [card] = await db
          .select({ votes: retrospectiveCards.votes })
          .from(retrospectiveCards)
          .where(eq(retrospectiveCards.id, cardId));
        
        await db
          .update(retrospectiveCards)
          .set({ votes: card.votes + 1 })
          .where(eq(retrospectiveCards.id, cardId));

        res.json({
          success: true,
          data: { message: 'Vote added' }
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to vote on card"
      });
    }
  });

  // DELETE /api/retro-service/cards/:cardId/unvote - Remove vote from a card
  app.delete("/api/retro-service/cards/:cardId/unvote", async (req, res) => {
    try {
      const { cardId } = req.params;
      const userId = req.body.userId || '00000000-0000-0000-0000-000000000000';
      
      // Remove vote
      await db
        .delete(retrospectiveCardVotes)
        .where(and(
          eq(retrospectiveCardVotes.card_id, cardId),
          eq(retrospectiveCardVotes.user_id, userId)
        ));
      
      // Decrease vote count
      const [card] = await db
        .select({ votes: retrospectiveCards.votes })
        .from(retrospectiveCards)
        .where(eq(retrospectiveCards.id, cardId));
      
      await db
        .update(retrospectiveCards)
        .set({ votes: Math.max(0, card.votes - 1) })
        .where(eq(retrospectiveCards.id, cardId));

      res.json({
        success: true,
        data: { message: 'Vote removed' }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove vote"
      });
    }
  });

  // PUT /api/retro-service/cards/:cardId/move - Move a card to a different column
  app.put("/api/retro-service/cards/:cardId/move", async (req, res) => {
    try {
      const { cardId } = req.params;
      const { column_id } = req.body;
      
      await db
        .update(retrospectiveCards)
        .set({ column_id })
        .where(eq(retrospectiveCards.id, cardId));

      res.json({
        success: true,
        data: { message: 'Card moved successfully' }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to move card"
      });
    }
  });

  // GET /api/retro-service/retrospectives/:retrospectiveId/action-items - Get action items for a retrospective
  app.get("/api/retro-service/retrospectives/:retrospectiveId/action-items", async (req, res) => {
    try {
      const { retrospectiveId } = req.params;
      
      const actionItems = await db
        .select()
        .from(retrospectiveActionItems)
        .where(eq(retrospectiveActionItems.retrospective_id, retrospectiveId));

      res.json({
        success: true,
        data: actionItems
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get action items"
      });
    }
  });

  // POST /api/retro-service/retrospectives/:retrospectiveId/action-items - Create an action item
  app.post("/api/retro-service/retrospectives/:retrospectiveId/action-items", async (req, res) => {
    try {
      const { retrospectiveId } = req.params;
      const { what_task, when_sprint, who_responsible, how_approach, from_card_id, backlog_ref_id } = req.body;
      
      const [newActionItem] = await db
        .insert(retrospectiveActionItems)
        .values({
          retrospective_id: retrospectiveId,
          what_task,
          when_sprint,
          who_responsible,
          how_approach,
          from_card_id,
          backlog_ref_id,
          created_by: req.body.userId || '00000000-0000-0000-0000-000000000000'
        })
        .returning();

      res.json({
        success: true,
        data: {
          message: 'Action item created successfully',
          actionItem: newActionItem
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create action item"
      });
    }
  });

  // DELETE /api/retro-service/:retrospectiveId - Delete a retrospective
  app.delete("/api/retro-service/:retrospectiveId", async (req, res) => {
    try {
      const { retrospectiveId } = req.params;
      
      // Delete action items first
      await db.delete(retrospectiveActionItems).where(eq(retrospectiveActionItems.retrospective_id, retrospectiveId));
      
      // Get all columns for this retrospective
      const columns = await db
        .select({ id: retrospectiveColumns.id })
        .from(retrospectiveColumns)
        .where(eq(retrospectiveColumns.retrospective_id, retrospectiveId));
      
      // Delete votes and cards for each column
      for (const column of columns) {
        const cards = await db
          .select({ id: retrospectiveCards.id })
          .from(retrospectiveCards)
          .where(eq(retrospectiveCards.column_id, column.id));
        
        for (const card of cards) {
          await db.delete(retrospectiveCardVotes).where(eq(retrospectiveCardVotes.card_id, card.id));
        }
        
        await db.delete(retrospectiveCards).where(eq(retrospectiveCards.column_id, column.id));
      }
      
      // Delete columns
      await db.delete(retrospectiveColumns).where(eq(retrospectiveColumns.retrospective_id, retrospectiveId));
      
      // Finally delete the retrospective
      await db.delete(retrospectives).where(eq(retrospectives.id, retrospectiveId));

      res.json({
        success: true,
        data: { message: 'Retrospective deleted successfully' }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete retrospective"
      });
    }
  });

  // PUT /api/retro-service/action-items/:actionItemId - Update an action item
  app.put("/api/retro-service/action-items/:actionItemId", async (req, res) => {
    try {
      const { actionItemId } = req.params;
      const updateData = req.body;
      
      const [updatedActionItem] = await db
        .update(retrospectiveActionItems)
        .set({ ...updateData, updated_at: new Date() })
        .where(eq(retrospectiveActionItems.id, actionItemId))
        .returning();

      res.json({
        success: true,
        data: {
          message: 'Action item updated successfully',
          actionItem: updatedActionItem
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update action item"
      });
    }
  });

  // DELETE /api/retro-service/action-items/:actionItemId - Delete an action item
  app.delete("/api/retro-service/action-items/:actionItemId", async (req, res) => {
    try {
      const { actionItemId } = req.params;
      
      await db.delete(retrospectiveActionItems).where(eq(retrospectiveActionItems.id, actionItemId));

      res.json({
        success: true,
        data: { message: 'Action item deleted successfully' }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete action item"
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

  // Budget service - Get project budget
  app.get("/api/budget-service/projects/:projectId/budget", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      
      // Get project budget
      const budget = await db.select().from(projectBudgets).where(eq(projectBudgets.project_id, projectId)).limit(1);
      let projectBudget = budget.length > 0 ? budget[0] : null;
      
      // Get budget categories if budget exists
      let categories = [];
      if (projectBudget) {
        const categoriesResult = await db.select().from(budgetCategories).where(eq(budgetCategories.project_budget_id, projectBudget.id));
        
        // Get spending entries for each category
        const categoriesWithSpending = await Promise.all(
          categoriesResult.map(async (category) => {
            const spendingEntries = await db.select().from(budgetSpending).where(eq(budgetSpending.budget_category_id, category.id));
            return {
              ...category,
              budget_spending: spendingEntries
            };
          })
        );
        
        categories = categoriesWithSpending;
        
        // Attach categories to budget object
        projectBudget = {
          ...projectBudget,
          budget_categories: categories
        };
      } else {
        // If no budget exists, create empty structure with categories
        projectBudget = {
          budget_categories: []
        };
      }
      
      // Get budget types
      const budgetTypes = await db.select().from(budgetTypeConfig).where(eq(budgetTypeConfig.enabled, true));
      
      res.json({
        success: true,
        data: {
          budget: projectBudget,
          budgetTypes: budgetTypes,
          categories: categories,
          spendingEntries: []
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project budget" 
      });
    }
  });

  // Budget service - Create or update budget category
  app.post("/api/budget-service/projects/:projectId/categories", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      
      // Ensure project budget exists
      let budget = await db.select().from(projectBudgets).where(eq(projectBudgets.project_id, projectId)).limit(1);
      if (budget.length === 0) {
        // Create budget for project
        const newBudget = await db.insert(projectBudgets).values({
          project_id: projectId,
          created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
        }).returning();
        budget = newBudget;
      }
      
      // Create category
      const categoryData = insertBudgetCategorySchema.parse({
        ...req.body,
        project_budget_id: budget[0].id,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newCategory = await db.insert(budgetCategories).values(categoryData).returning();
      
      res.json({
        success: true,
        data: newCategory[0]
      });
    } catch (error) {
      // Check if it's a Zod validation error
      if (error && typeof error === 'object' && 'issues' in error) {
        res.status(400).json({ 
          success: false,
          error: "Validation failed",
          details: error.issues
        });
      } else {
        res.status(500).json({ 
          success: false,
          error: error instanceof Error ? error.message : "Failed to create budget category" 
        });
      }
    }
  });

  // Budget service - Delete budget category
  app.delete("/api/budget-service/projects/:projectId/categories/:categoryId", async (req, res) => {
    try {
      const categoryId = req.params.categoryId;
      
      await db.delete(budgetCategories).where(eq(budgetCategories.id, categoryId));
      
      res.json({
        success: true,
        data: { message: "Category deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete budget category" 
      });
    }
  });

  // Budget service - Create spending entry
  app.post("/api/budget-service/projects/:projectId/spending", async (req, res) => {
    try {
      const spendingData = insertBudgetSpendingSchema.parse({
        ...req.body,
        created_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538"
      });
      
      const newSpending = await db.insert(budgetSpending).values(spendingData).returning();
      
      res.json({
        success: true,
        data: newSpending[0]
      });
    } catch (error) {
      // Check if it's a Zod validation error
      if (error && typeof error === 'object' && 'issues' in error) {
        res.status(400).json({ 
          success: false,
          error: "Validation failed",
          details: error.issues
        });
      } else {
        res.status(500).json({ 
          success: false,
          error: error instanceof Error ? error.message : "Failed to create spending entry" 
        });
      }
    }
  });

  // Budget service - Delete spending entry
  app.delete("/api/budget-service/projects/:projectId/spending/:spendingId", async (req, res) => {
    try {
      const spendingId = req.params.spendingId;
      
      await db.delete(budgetSpending).where(eq(budgetSpending.id, spendingId));
      
      res.json({
        success: true,
        data: { message: "Spending entry deleted successfully" }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete spending entry" 
      });
    }
  });

  // Grant module permissions (frontend expected endpoint)
  app.post("/api/access-service/permissions/grant", async (req, res) => {
    try {
      const { projectId, userEmail, module, accessLevel } = req.body;
      
      if (!projectId || !userEmail || !module || !accessLevel) {
        return res.status(400).json({
          success: false,
          error: "Project ID, user email, module, and access level are required"
        });
      }

      // Find user by email
      const user = await db.select().from(users).where(eq(users.email, userEmail.toLowerCase())).limit(1);
      
      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found"
        });
      }
      
      const userId = user[0].id;
      
      // Map frontend access levels to database roles (using 'member' for both since it's the only valid role)
      const roleMapping: { [key: string]: string } = {
        'read': 'member',
        'write': 'member',
        'admin': 'member'
      };
      
      const dbRole = roleMapping[accessLevel] || 'member';
      
      // Check if permission already exists
      const existingPermission = await db.select()
        .from(projectMembers)
        .where(and(
          eq(projectMembers.project_id, projectId),
          eq(projectMembers.user_id, userId)
        ));
      
      if (existingPermission.length > 0) {
        // Update existing permission
        await db.update(projectMembers)
          .set({ 
            role: dbRole,
            updated_at: new Date().toISOString()
          })
          .where(and(
            eq(projectMembers.project_id, projectId),
            eq(projectMembers.user_id, userId)
          ));
      } else {
        // Insert new permission
        const memberData = insertProjectMemberSchema.parse({
          project_id: projectId,
          user_id: userId,
          role: dbRole,
          invited_by: "6dc39f1e-2af3-4b78-8488-317d90f4f538",
          status: "active"
        });
        
        await db.insert(projectMembers).values(memberData);
      }
      
      res.json({
        success: true,
        data: { 
          message: "Permission granted successfully",
          permission: {
            projectId,
            userId,
            module,
            accessLevel
          }
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to grant permission" 
      });
    }
  });

  // ================== Jira Integration API ==================

  // Get Jira integration settings for a project
  app.get("/api/jira-service/projects/:projectId/integration", verifyToken, async (req, res) => {
    try {
      const { projectId } = req.params;
      const integration = await db.select().from(jiraIntegrations).where(eq(jiraIntegrations.project_id, projectId)).limit(1);
      
      if (integration.length === 0) {
        return res.json({
          success: true,
          data: null
        });
      }

      // Don't return the API token for security
      const { jira_api_token, ...safeIntegration } = integration[0];
      
      res.json({
        success: true,
        data: safeIntegration
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get Jira integration"
      });
    }
  });

  // Create or update Jira integration settings
  app.post("/api/jira-service/projects/:projectId/integration", verifyToken, async (req, res) => {
    try {
      console.log('=== JIRA INTEGRATION REQUEST START ===');
      console.log('Project ID:', req.params.projectId);
      console.log('User ID:', req.user?.id);
      console.log('Request body keys:', Object.keys(req.body));
      
      const { projectId } = req.params;
      const { jira_base_url, jira_email, jira_api_token, jira_project_key } = req.body;
      
      console.log('Parsed credentials:', {
        jira_base_url,
        jira_email,
        jira_project_key,
        jira_api_token: jira_api_token ? `${jira_api_token.substring(0, 10)}...` : 'undefined'
      });
      
      if (!jira_base_url || !jira_email || !jira_api_token || !jira_project_key) {
        console.log('Missing required fields validation failed');
        return res.status(400).json({
          success: false,
          error: "Jira base URL, email, API token, and project key are required"
        });
      }

      console.log('Creating JiraService instance...');
      // Test the connection first
      const jiraService = new JiraService(jira_base_url, jira_email, jira_api_token, jira_project_key);
      console.log('Testing connection...');
      const connectionTest = await jiraService.testConnection();
      console.log('Connection test result:', connectionTest);
      
      if (!connectionTest.success) {
        console.log('Connection test failed, returning error');
        return res.status(400).json({
          success: false,
          error: `Jira connection failed: ${connectionTest.error}`
        });
      }

      // Check if integration exists
      const existing = await db.select().from(jiraIntegrations).where(eq(jiraIntegrations.project_id, projectId)).limit(1);

      const integrationData = insertJiraIntegrationSchema.parse({
        project_id: projectId,
        jira_base_url,
        jira_email,
        jira_api_token, // In production, this should be encrypted
        jira_project_key,
        field_mapping: JSON.stringify(defaultJiraFieldMapping),
        created_by: req.user.id
      });

      if (existing.length > 0) {
        // Update existing integration
        await db.update(jiraIntegrations)
          .set({
            ...integrationData,
            updated_at: new Date()
          })
          .where(eq(jiraIntegrations.project_id, projectId));
      } else {
        // Create new integration
        await db.insert(jiraIntegrations).values(integrationData);
      }

      res.json({
        success: true,
        data: { message: "Jira integration configured successfully" }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to configure Jira integration"
      });
    }
  });

  // Test Jira connection
  app.post("/api/jira-service/projects/:projectId/test-connection", verifyToken, async (req, res) => {
    try {
      const { projectId } = req.params;
      const integration = await db.select().from(jiraIntegrations).where(eq(jiraIntegrations.project_id, projectId)).limit(1);
      
      if (integration.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Jira integration not configured"
        });
      }

      const config = integration[0];
      const jiraService = new JiraService(config.jira_base_url, config.jira_email, config.jira_api_token, config.jira_project_key);
      const result = await jiraService.testConnection();

      res.json({
        success: result.success,
        data: result.success ? { message: "Connection successful" } : null,
        error: result.error
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to test connection"
      });
    }
  });

  // Sync task to Jira
  app.post("/api/jira-service/projects/:projectId/tasks/:taskId/sync", verifyToken, async (req, res) => {
    try {
      const { projectId, taskId } = req.params;
      
      // Get integration settings
      const integration = await db.select().from(jiraIntegrations).where(eq(jiraIntegrations.project_id, projectId)).limit(1);
      if (integration.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Jira integration not configured"
        });
      }

      // Get task
      const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (task.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Task not found"
        });
      }

      const config = integration[0];
      const taskData = task[0];

      // Check if task is already synced
      if (taskData.jira_synced && taskData.jira_issue_key) {
        return res.status(400).json({
          success: false,
          error: "Task is already synced to Jira"
        });
      }

      const jiraService = new JiraService(config.jira_base_url, config.jira_email, config.jira_api_token, config.jira_project_key);
      const fieldMapping = JSON.parse(config.field_mapping || JSON.stringify(defaultJiraFieldMapping));

      // Create issue in Jira
      const jiraPayload = JiraService.taskToJiraPayload(taskData, config.jira_project_key, fieldMapping);
      const createdIssue = await jiraService.createIssue(jiraPayload);

      // Update task with Jira information
      await db.update(tasks)
        .set({
          jira_synced: true,
          jira_sync_enabled: true,
          jira_issue_key: createdIssue.key,
          jira_issue_id: createdIssue.id,
          jira_last_sync: new Date(),
          updated_at: new Date()
        })
        .where(eq(tasks.id, taskId));

      // Log sync history
      const syncHistoryData = insertJiraSyncHistorySchema.parse({
        project_id: projectId,
        task_id: taskId,
        jira_issue_key: createdIssue.key,
        sync_direction: 'to_jira',
        operation: 'create',
        status: 'success',
        sync_data: JSON.stringify({ issue: createdIssue }),
        performed_by: req.user.id
      });
      await db.insert(jiraSyncHistory).values(syncHistoryData);

      res.json({
        success: true,
        data: {
          message: "Task synced to Jira successfully",
          jira_issue_key: createdIssue.key,
          jira_url: `${config.jira_base_url}/browse/${createdIssue.key}`
        }
      });
    } catch (error) {
      // Log failed sync
      try {
        const syncHistoryData = insertJiraSyncHistorySchema.parse({
          project_id: req.params.projectId,
          task_id: req.params.taskId,
          sync_direction: 'to_jira',
          operation: 'create',
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          performed_by: req.user.id
        });
        await db.insert(jiraSyncHistory).values(syncHistoryData);
      } catch (logError) {
        console.error('Failed to log sync error:', logError);
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync task to Jira"
      });
    }
  });

  // Unsync task from Jira
  app.delete("/api/jira-service/projects/:projectId/tasks/:taskId/sync", verifyToken, async (req, res) => {
    try {
      const { taskId } = req.params;
      
      // Update task to remove Jira sync
      await db.update(tasks)
        .set({
          jira_synced: false,
          jira_sync_enabled: false,
          jira_issue_key: null,
          jira_issue_id: null,
          jira_last_sync: null,
          updated_at: new Date()
        })
        .where(eq(tasks.id, taskId));

      res.json({
        success: true,
        data: { message: "Task unsynced from Jira successfully" }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to unsync task from Jira"
      });
    }
  });

  // Get Jira sync history for a project
  app.get("/api/jira-service/projects/:projectId/sync-history", verifyToken, async (req, res) => {
    try {
      const { projectId } = req.params;
      const history = await db.select().from(jiraSyncHistory)
        .where(eq(jiraSyncHistory.project_id, projectId))
        .orderBy(jiraSyncHistory.created_at);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get sync history"
      });
    }
  });

  // Update Jira sync status for a task
  app.patch("/api/jira-service/projects/:projectId/tasks/:taskId/sync-status", verifyToken, async (req, res) => {
    try {
      const { taskId } = req.params;
      const { jira_sync_enabled } = req.body;
      
      await db.update(tasks)
        .set({
          jira_sync_enabled: jira_sync_enabled,
          updated_at: new Date()
        })
        .where(eq(tasks.id, taskId));

      res.json({
        success: true,
        data: { message: "Sync status updated successfully" }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update sync status"
      });
    }
  });

  // BULK SYNC OPERATIONS
  
  // Import all tasks from Jira project to local project
  app.post("/api/jira-service/projects/:projectId/import-from-jira", verifyToken, async (req, res) => {
    console.log("=== IMPORT FROM JIRA START ===");
    console.log("Project ID:", req.params.projectId);
    console.log("User ID:", req.user?.id);
    try {
      const { projectId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        console.log("ERROR: User not authenticated");
        return res.status(401).json({
          success: false,
          error: "User not authenticated"
        });
      }

      console.log("Looking for Jira integration for project:", projectId);
      // Get integration settings
      const integration = await db.select().from(jiraIntegrations)
        .where(eq(jiraIntegrations.project_id, projectId))
        .limit(1);

      console.log("Integration query result:", integration.length > 0 ? "FOUND" : "NOT FOUND");

      if (integration.length === 0) {
        console.log("ERROR: No Jira integration found for project");
        return res.status(404).json({
          success: false,
          error: "Jira integration not configured for this project"
        });
      }

      const integrationData = integration[0];
      
      // Create Jira service
      const jiraService = new JiraService(
        integrationData.jira_base_url,
        integrationData.jira_email,
        integrationData.jira_api_token,
        integrationData.jira_project_key
      );

      console.log("Searching for Jira issues in project:", integrationData.jira_project_key);
      
      // Search for all issues in the Jira project
      const jql = `project = ${integrationData.jira_project_key} ORDER BY created DESC`;
      const searchResult = await jiraService.searchIssues(jql, 100);
      
      console.log(`Found ${searchResult.issues.length} issues in Jira`);

      let importedCount = 0;
      let skippedCount = 0;
      const importResults = [];

      for (const issue of searchResult.issues) {
        try {
          // Check if task already exists with this Jira issue key in backlog or tasks
          const existingTaskInTasks = await db.select().from(tasks)
            .where(and(
              eq(tasks.project_id, projectId),
              eq(tasks.jira_issue_key, issue.key)
            ))
            .limit(1);

          const existingTaskInBacklog = await db.select().from(taskBacklog)
            .where(and(
              eq(taskBacklog.project_id, projectId),
              eq(taskBacklog.jira_issue_key, issue.key)
            ))
            .limit(1);

          if (existingTaskInTasks.length > 0 || existingTaskInBacklog.length > 0) {
            console.log(`Task already exists for ${issue.key}, skipping`);
            skippedCount++;
            importResults.push({
              jira_issue_key: issue.key,
              status: 'skipped',
              reason: 'Task already exists'
            });
            continue;
          }

          // Map Jira status to local status
          let localStatus = 'todo';
          const jiraStatus = issue.fields.status.name.toLowerCase();
          if (jiraStatus.includes('progress') || jiraStatus.includes('doing')) {
            localStatus = 'in_progress';
          } else if (jiraStatus.includes('done') || jiraStatus.includes('complete')) {
            localStatus = 'completed';
          } else if (jiraStatus.includes('block') || jiraStatus.includes('stop')) {
            localStatus = 'blocked';
          }

          // Create task in backlog from Jira issue
          const taskBacklogData = insertTaskBacklogSchema.parse({
            project_id: projectId,
            title: issue.fields.summary,
            description: issue.fields.description || '',
            status: localStatus,
            priority: issue.fields.priority?.name.toLowerCase() || 'medium',
            source_type: 'jira',
            jira_synced: true,
            jira_issue_key: issue.key,
            jira_issue_id: issue.id,
            jira_sync_enabled: true,
            jira_last_sync: new Date(),
            created_by: userId
          });

          const [newTask] = await db.insert(taskBacklog).values(taskBacklogData).returning();
          
          // Log sync history
          const syncHistoryData = insertJiraSyncHistorySchema.parse({
            project_id: projectId,
            task_id: newTask.id,
            jira_issue_key: issue.key,
            sync_direction: 'from_jira',
            operation: 'import',
            status: 'success',
            sync_data: JSON.stringify({
              jira_issue_id: issue.id,
              jira_summary: issue.fields.summary,
              jira_status: issue.fields.status.name
            }),
            performed_by: userId
          });

          await db.insert(jiraSyncHistory).values(syncHistoryData);
          
          importedCount++;
          importResults.push({
            jira_issue_key: issue.key,
            task_id: newTask.id,
            status: 'imported'
          });

          console.log(`Imported ${issue.key} -> ${newTask.id}`);

        } catch (error) {
          console.error(`Failed to import ${issue.key}:`, error);
          
          // Log failed sync
          const syncHistoryData = insertJiraSyncHistorySchema.parse({
            project_id: projectId,
            jira_issue_key: issue.key,
            sync_direction: 'from_jira',
            operation: 'import',
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            performed_by: userId
          });

          await db.insert(jiraSyncHistory).values(syncHistoryData);

          importResults.push({
            jira_issue_key: issue.key,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Update integration last sync time
      await db.update(jiraIntegrations)
        .set({ last_sync: new Date(), updated_at: new Date() })
        .where(eq(jiraIntegrations.project_id, projectId));

      console.log(`Import complete: ${importedCount} imported, ${skippedCount} skipped`);

      res.json({
        success: true,
        data: {
          imported: importedCount,
          skipped: skippedCount,
          total: searchResult.issues.length,
          results: importResults
        }
      });

    } catch (error) {
      console.error("Import from Jira failed:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to import from Jira"
      });
    }
  });

  // Export all project tasks to Jira
  app.post("/api/jira-service/projects/:projectId/export-to-jira", verifyToken, async (req, res) => {
    console.log("=== EXPORT TO JIRA START ===");
    try {
      const { projectId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User not authenticated"
        });
      }

      // Get integration settings
      const integration = await db.select().from(jiraIntegrations)
        .where(eq(jiraIntegrations.project_id, projectId))
        .limit(1);

      if (integration.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Jira integration not configured for this project"
        });
      }

      const integrationData = integration[0];
      
      // Create Jira service
      const jiraService = new JiraService(
        integrationData.jira_base_url,
        integrationData.jira_email,
        integrationData.jira_api_token,
        integrationData.jira_project_key
      );

      // Get all tasks that are not yet synced to Jira
      const tasksToExport = await db.select().from(tasks)
        .where(and(
          eq(tasks.project_id, projectId),
          or(
            eq(tasks.jira_synced, false),
            isNull(tasks.jira_issue_key)
          )
        ));

      console.log(`Found ${tasksToExport.length} tasks to export to Jira`);

      let exportedCount = 0;
      const exportResults = [];
      
      // Get field mapping (use default for now)
      const fieldMapping = {
        statusMapping: {
          'todo': 'To Do',
          'in_progress': 'In Progress', 
          'completed': 'Done',
          'blocked': 'Blocked',
          'on_hold': 'On Hold'
        },
        priorityMapping: {
          'low': 'Low',
          'medium': 'Medium',
          'high': 'High',
          'urgent': 'Highest'
        },
        issueType: 'Task'
      };

      for (const task of tasksToExport) {
        try {
          // Create Jira issue payload
          const jiraPayload = {
            fields: {
              project: { key: integrationData.jira_project_key },
              summary: task.title,
              description: task.description || '',
              issuetype: { name: fieldMapping.issueType },
              priority: task.priority && fieldMapping.priorityMapping[task.priority as keyof typeof fieldMapping.priorityMapping]
                ? { name: fieldMapping.priorityMapping[task.priority as keyof typeof fieldMapping.priorityMapping] }
                : { name: 'Medium' }
            }
          };

          // Create issue in Jira
          const createdIssue = await jiraService.createIssue(jiraPayload);
          
          // Update local task with Jira information
          await db.update(tasks)
            .set({
              jira_synced: true,
              jira_issue_key: createdIssue.key,
              jira_issue_id: createdIssue.id,
              jira_sync_enabled: true,
              jira_last_sync: new Date(),
              updated_at: new Date()
            })
            .where(eq(tasks.id, task.id));

          // Log sync history
          const syncHistoryData = insertJiraSyncHistorySchema.parse({
            project_id: projectId,
            task_id: task.id,
            jira_issue_key: createdIssue.key,
            sync_direction: 'to_jira',
            operation: 'export',
            status: 'success',
            sync_data: JSON.stringify({
              jira_issue_id: createdIssue.id,
              local_title: task.title,
              local_status: task.status
            }),
            performed_by: userId
          });

          await db.insert(jiraSyncHistory).values(syncHistoryData);
          
          exportedCount++;
          exportResults.push({
            task_id: task.id,
            jira_issue_key: createdIssue.key,
            status: 'exported'
          });

          console.log(`Exported task ${task.id} -> ${createdIssue.key}`);

        } catch (error) {
          console.error(`Failed to export task ${task.id}:`, error);
          
          // Log failed sync
          const syncHistoryData = insertJiraSyncHistorySchema.parse({
            project_id: projectId,
            task_id: task.id,
            sync_direction: 'to_jira',
            operation: 'export',
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            performed_by: userId
          });

          await db.insert(jiraSyncHistory).values(syncHistoryData);

          exportResults.push({
            task_id: task.id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Update integration last sync time
      await db.update(jiraIntegrations)
        .set({ last_sync: new Date(), updated_at: new Date() })
        .where(eq(jiraIntegrations.project_id, projectId));

      console.log(`Export complete: ${exportedCount} exported`);

      res.json({
        success: true,
        data: {
          exported: exportedCount,
          total: tasksToExport.length,
          results: exportResults
        }
      });

    } catch (error) {
      console.error("Export to Jira failed:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to export to Jira"
      });
    }
  });

  // Bulk export backlog tasks to Jira
  app.post("/api/jira-service/projects/:projectId/bulk-export-to-jira", verifyToken, async (req, res) => {
    console.log("=== BULK EXPORT TO JIRA START ===");
    try {
      const { projectId } = req.params;
      const { taskIds } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User not authenticated"
        });
      }

      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No task IDs provided"
        });
      }

      // Get integration settings
      const integration = await db.select().from(jiraIntegrations)
        .where(eq(jiraIntegrations.project_id, projectId))
        .limit(1);

      if (integration.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Jira integration not configured for this project"
        });
      }

      const integrationData = integration[0];
      
      // Create Jira service
      const jiraService = new JiraService(
        integrationData.jira_base_url,
        integrationData.jira_email,
        integrationData.jira_api_token,
        integrationData.jira_project_key
      );

      // Get the specific backlog tasks to export
      const tasksToExport = await db.select().from(taskBacklog)
        .where(and(
          eq(taskBacklog.project_id, projectId),
          inArray(taskBacklog.id, taskIds)
        ));

      console.log(`Found ${tasksToExport.length} backlog tasks to export to Jira`);

      const exportResults = [];
      
      // Field mapping for backlog tasks
      const fieldMapping = {
        statusMapping: {
          'backlog': 'To Do',
          'todo': 'To Do',
          'in_progress': 'In Progress', 
          'completed': 'Done',
          'blocked': 'Blocked',
          'on_hold': 'On Hold'
        },
        priorityMapping: {
          'low': 'Low',
          'medium': 'Medium',
          'high': 'High',
          'critical': 'Highest'
        }
      };

      for (const task of tasksToExport) {
        try {
          let jiraIssue;
          let operation = 'create';

          // Check if this task already has a Jira issue (update scenario)
          if (task.jira_issue_key && task.jira_issue_id) {
            try {
              // Try to update existing issue
              const updateData = {
                fields: {
                  summary: task.title,
                  description: task.description || '',
                  priority: {
                    name: fieldMapping.priorityMapping[task.priority] || 'Medium'
                  }
                }
              };

              await jiraService.updateIssue(task.jira_issue_id, updateData);
              
              // Try to transition status if needed (non-blocking)
              if (task.status && task.status !== 'backlog') {
                try {
                  const transitionId = await jiraService.mapStatusToTransition(task.jira_issue_key, task.status, fieldMapping);
                  if (transitionId) {
                    await jiraService.transitionIssue(task.jira_issue_key, transitionId);
                  }
                } catch (transitionError) {
                  console.log(`Could not transition ${task.jira_issue_key}:`, transitionError);
                }
              }

              operation = 'update';
              jiraIssue = {
                id: task.jira_issue_id,
                key: task.jira_issue_key
              };
            } catch (updateError) {
              console.log(`Failed to update existing issue ${task.jira_issue_key}, will create new one`);
              // Fall back to creating new issue
              jiraIssue = null;
              operation = 'create';
            }
          }

          // Create new issue if update failed or no existing issue
          if (!jiraIssue) {
            const issueData = {
              fields: {
                project: { key: integrationData.jira_project_key },
                summary: task.title,
                description: task.description || '',
                issuetype: { name: 'Task' },
                priority: {
                  name: fieldMapping.priorityMapping[task.priority] || 'Medium'
                }
              }
            };

            jiraIssue = await jiraService.createIssue(issueData);
            
            // Set initial status if not default "To Do"
            if (task.status && task.status !== 'backlog' && task.status !== 'todo') {
              try {
                const transitionId = await jiraService.mapStatusToTransition(jiraIssue.key, task.status, fieldMapping);
                if (transitionId) {
                  await jiraService.transitionIssue(jiraIssue.key, transitionId);
                }
              } catch (transitionError) {
                console.log(`Could not set initial status for ${jiraIssue.key}:`, transitionError);
              }
            }
            
            operation = 'create';
          }

          // Update the backlog task with Jira sync information
          await db.update(taskBacklog)
            .set({
              jira_synced: true,
              jira_issue_key: jiraIssue.key,
              jira_issue_id: jiraIssue.id,
              jira_sync_enabled: true,
              jira_last_sync: new Date(),
              updated_at: new Date()
            })
            .where(eq(taskBacklog.id, task.id));

          // Log sync history
          const syncHistoryData = insertJiraSyncHistorySchema.parse({
            project_id: projectId,
            task_id: task.id,
            jira_issue_key: jiraIssue.key,
            sync_direction: 'to_jira',
            operation: operation,
            status: 'success',
            sync_data: JSON.stringify({
              jira_issue_id: jiraIssue.id,
              task_title: task.title,
              operation: operation
            }),
            performed_by: userId
          });

          await db.insert(jiraSyncHistory).values(syncHistoryData);

          exportResults.push({
            task_id: task.id,
            task_title: task.title,
            jira_issue_key: jiraIssue.key,
            jira_issue_id: jiraIssue.id,
            operation: operation,
            status: 'success'
          });

          console.log(`${operation} ${task.title} -> ${jiraIssue.key}`);

        } catch (error) {
          console.error(`Failed to export task ${task.title}:`, error);
          
          exportResults.push({
            task_id: task.id,
            task_title: task.title,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          // Log failed sync
          try {
            const syncHistoryData = insertJiraSyncHistorySchema.parse({
              project_id: projectId,
              task_id: task.id,
              jira_issue_key: '',
              sync_direction: 'to_jira',
              operation: 'export',
              status: 'failed',
              sync_data: JSON.stringify({
                task_title: task.title,
                error: error instanceof Error ? error.message : 'Unknown error'
              }),
              performed_by: userId
            });

            await db.insert(jiraSyncHistory).values(syncHistoryData);
          } catch (logError) {
            console.error('Failed to log sync error:', logError);
          }
        }
      }

      const successCount = exportResults.filter(r => r.status === 'success').length;
      const failureCount = exportResults.filter(r => r.status === 'failed').length;

      console.log(`Bulk export complete: ${successCount} succeeded, ${failureCount} failed`);

      res.json({
        success: true,
        data: {
          total: tasksToExport.length,
          succeeded: successCount,
          failed: failureCount,
          results: exportResults
        }
      });

    } catch (error) {
      console.error("Bulk export to Jira failed:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to export to Jira"
      });
    }
  });

  // Full bidirectional sync
  app.post("/api/jira-service/projects/:projectId/full-sync", verifyToken, async (req, res) => {
    console.log("=== FULL SYNC START ===");
    try {
      const { projectId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User not authenticated"
        });
      }

      // First import from Jira
      const importResponse = await fetch(`${req.protocol}://${req.get('host')}/api/jira-service/projects/${projectId}/import-from-jira`, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.authorization || '',
          'Content-Type': 'application/json'
        }
      });
      const importResult = await importResponse.json();

      if (!importResult.success) {
        throw new Error(`Import failed: ${importResult.error}`);
      }

      // Then export to Jira
      const exportResponse = await fetch(`${req.protocol}://${req.get('host')}/api/jira-service/projects/${projectId}/export-to-jira`, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.authorization || '',
          'Content-Type': 'application/json'
        }
      });
      const exportResult = await exportResponse.json();

      if (!exportResult.success) {
        throw new Error(`Export failed: ${exportResult.error}`);
      }

      console.log("Full sync complete");

      res.json({
        success: true,
        data: {
          import: importResult.data,
          export: exportResult.data,
          message: "Full bidirectional sync completed successfully"
        }
      });

    } catch (error) {
      console.error("Full sync failed:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to perform full sync"
      });
    }
  });

  // Email reminder API - Send reminder for overdue task
  app.post("/api/analytics-service/send-overdue-reminder", verifyToken, async (req, res) => {
    try {
      const { taskId } = req.body;
      
      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: "Task ID is required"
        });
      }
      
      // Get task details with stakeholder information and project access verification
      const taskWithOwner = await db.select({
        task: tasks,
        stakeholder: stakeholders,
        project: projects
      })
        .from(tasks)
        .leftJoin(stakeholders, eq(tasks.owner_id, stakeholders.id))
        .leftJoin(projects, eq(tasks.project_id, projects.id))
        .where(eq(tasks.id, taskId))
        .limit(1);
        
      if (taskWithOwner.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Task not found"
        });
      }
      
      const { task: taskData, stakeholder, project } = taskWithOwner[0];
      
      // Verify user has access to this project (project owner or task owner)
      const isProjectOwner = project?.created_by === req.user?.id;
      const isTaskOwner = taskData.owner_id === req.user?.id;
      
      if (!isProjectOwner && !isTaskOwner) {
        return res.status(403).json({
          success: false,
          error: "You don't have permission to send reminders for this task"
        });
      }
      
      if (!taskData.due_date) {
        return res.status(400).json({
          success: false,
          error: "Task has no due date"
        });
      }
      
      if (!stakeholder || !stakeholder.email) {
        return res.status(400).json({
          success: false,
          error: "Task owner has no email address"
        });
      }
      
      const dueDate = new Date(taskData.due_date);
      const today = new Date();
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Ensure task is actually overdue
      if (daysOverdue <= 0) {
        return res.status(400).json({
          success: false,
          error: "Task is not overdue"
        });
      }
      
      // Create email transporter
      const transporter = createEmailTransporter();
      
      // Email content
      const emailSubject = `Overdue Task Reminder: ${taskData.title}`;
      const emailBody = `
        <h2>Task Overdue Reminder</h2>
        <p>Hello,</p>
        <p>This is a reminder that the following task is overdue:</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #f59e0b;">⚠️ ${taskData.title}</h3>
          <p><strong>Due Date:</strong> ${dueDate.toDateString()}</p>
          <p><strong>Days Overdue:</strong> ${daysOverdue} days</p>
          <p><strong>Status:</strong> ${taskData.status}</p>
          ${taskData.description ? `<p><strong>Description:</strong> ${taskData.description}</p>` : ''}
        </div>
        
        <p>Please take immediate action to complete this task or update its status.</p>
        <p>Thank you for your attention to this matter.</p>
        
        <hr style="margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          This is an automated reminder from the Airbus Project Hub.
        </p>
      `;
      
      // Send email
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: stakeholder.email,
        subject: emailSubject,
        html: emailBody,
      });
      
      res.json({
        success: true,
        data: {
          message: `Reminder email sent to ${stakeholder.name} (${stakeholder.email})`,
          taskTitle: taskData.title,
          daysOverdue,
          recipientEmail: stakeholder.email
        }
      });
      
    } catch (error) {
      console.error('Failed to send overdue reminder:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send reminder email"
      });
    }
  });

  // ================== NEW ANALYTICS APIS ==================
  
  // 1. Velocity Analytics - Task completion trends
  app.get("/api/analytics/velocity", verifyToken, async (req, res) => {
    try {
      const { projectId, from, to } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      
      const velocityData = await db.select({
        date: sql<string>`DATE(${tasks.completed_at})`,
        completed: sql<number>`COUNT(*)`,
        story_points: sql<number>`COALESCE(SUM(CAST(${tasks.story_points} AS INTEGER)), 0)`
      })
        .from(tasks)
        .where(and(
          eq(tasks.project_id, projectId as string),
          eq(tasks.status, 'done'),
          gte(tasks.completed_at, fromDate.toISOString()),
          lte(tasks.completed_at, toDate.toISOString())
        ))
        .groupBy(sql`DATE(${tasks.completed_at})`)
        .orderBy(sql`DATE(${tasks.completed_at})`);
      
      res.json({ success: true, data: velocityData });
    } catch (error) {
      console.error('Velocity analytics error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch velocity data' });
    }
  });

  // 2. Lead Time Metrics - Delivery performance tracking
  app.get("/api/analytics/lead-time", verifyToken, async (req, res) => {
    try {
      const { projectId, from, to } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      
      const leadTimeData = await db.select({
        task_id: tasks.id,
        title: tasks.title,
        created_at: tasks.created_at,
        completed_at: tasks.completed_at,
        lead_time_hours: sql<number>`EXTRACT(EPOCH FROM (${tasks.completed_at} - ${tasks.created_at})) / 3600`
      })
        .from(tasks)
        .where(and(
          eq(tasks.project_id, projectId as string),
          eq(tasks.status, 'done'),
          gte(tasks.completed_at, fromDate.toISOString()),
          lte(tasks.completed_at, toDate.toISOString())
        ))
        .orderBy(tasks.completed_at);
      
      // Calculate percentiles
      const leadTimes = leadTimeData.map(t => t.lead_time_hours).sort((a, b) => a - b);
      const p50 = leadTimes[Math.floor(leadTimes.length * 0.5)] || 0;
      const p85 = leadTimes[Math.floor(leadTimes.length * 0.85)] || 0;
      
      res.json({ 
        success: true, 
        data: { 
          tasks: leadTimeData, 
          metrics: { p50, p85, average: leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length || 0 }
        }
      });
    } catch (error) {
      console.error('Lead time analytics error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch lead time data' });
    }
  });

  // 3. Aging Work Analysis - Identify bottlenecks
  app.get("/api/analytics/aging-work", verifyToken, async (req, res) => {
    try {
      const { projectId } = req.query;
      const now = new Date();
      
      const agingData = await db.select({
        task_id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        created_at: tasks.created_at,
        due_date: tasks.due_date,
        age_days: sql<number>`EXTRACT(EPOCH FROM (NOW() - ${tasks.created_at})) / 86400`,
        owner: stakeholders.name
      })
        .from(tasks)
        .leftJoin(stakeholders, eq(tasks.owner_id, stakeholders.id))
        .where(and(
          eq(tasks.project_id, projectId as string),
          ne(tasks.status, 'done')
        ))
        .orderBy(desc(sql`EXTRACT(EPOCH FROM (NOW() - ${tasks.created_at})) / 86400`));
      
      // Group by age buckets
      const buckets = {
        fresh: agingData.filter(t => t.age_days <= 3).length,
        moderate: agingData.filter(t => t.age_days > 3 && t.age_days <= 7).length,
        aging: agingData.filter(t => t.age_days > 7 && t.age_days <= 14).length,
        stale: agingData.filter(t => t.age_days > 14).length
      };
      
      res.json({ success: true, data: { tasks: agingData, buckets } });
    } catch (error) {
      console.error('Aging work analytics error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch aging work data' });
    }
  });

  // 4. Forecast Engine - Predict completion dates
  app.get("/api/analytics/forecast", verifyToken, async (req, res) => {
    try {
      const { projectId } = req.query;
      
      // Get project data
      const project = await db.select().from(projects).where(eq(projects.id, projectId as string)).limit(1);
      if (!project.length) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }
      
      // Get velocity data (last 4 weeks)
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
      const recentVelocity = await db.select({
        week: sql<string>`DATE_TRUNC('week', ${tasks.completed_at})`,
        completed: sql<number>`COUNT(*)`
      })
        .from(tasks)
        .where(and(
          eq(tasks.project_id, projectId as string),
          eq(tasks.status, 'done'),
          gte(tasks.completed_at, fourWeeksAgo.toISOString())
        ))
        .groupBy(sql`DATE_TRUNC('week', ${tasks.completed_at})`);
      
      const avgVelocity = recentVelocity.length > 0 
        ? recentVelocity.reduce((sum, week) => sum + week.completed, 0) / recentVelocity.length 
        : 0;
      
      // Get remaining work
      const remainingTasks = await db.select({
        count: sql<number>`COUNT(*)`
      })
        .from(tasks)
        .where(and(
          eq(tasks.project_id, projectId as string),
          ne(tasks.status, 'done')
        ));
      
      const remaining = remainingTasks[0]?.count || 0;
      const weeksToComplete = avgVelocity > 0 ? Math.ceil(remaining / avgVelocity) : null;
      const estimatedCompletion = weeksToComplete ? new Date(Date.now() + weeksToComplete * 7 * 24 * 60 * 60 * 1000) : null;
      
      res.json({ 
        success: true, 
        data: { 
          avgVelocity, 
          remainingTasks: remaining, 
          weeksToComplete, 
          estimatedCompletion,
          confidence: recentVelocity.length >= 3 ? 'High' : recentVelocity.length >= 2 ? 'Medium' : 'Low'
        }
      });
    } catch (error) {
      console.error('Forecast analytics error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate forecast' });
    }
  });

  // 5. Team Focus Metrics - Planned vs unplanned work
  app.get("/api/analytics/team-focus", verifyToken, async (req, res) => {
    try {
      const { projectId } = req.query;
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const focusData = await db.select({
        owner_id: tasks.owner_id,
        owner_name: stakeholders.name,
        planned: sql<number>`COUNT(CASE WHEN ${tasks.priority} IN ('high', 'medium') THEN 1 END)`,
        unplanned: sql<number>`COUNT(CASE WHEN ${tasks.priority} = 'low' OR ${tasks.priority} IS NULL THEN 1 END)`,
        total: sql<number>`COUNT(*)`
      })
        .from(tasks)
        .leftJoin(stakeholders, eq(tasks.owner_id, stakeholders.id))
        .where(and(
          eq(tasks.project_id, projectId as string),
          gte(tasks.created_at, lastWeek.toISOString())
        ))
        .groupBy(tasks.owner_id, stakeholders.name)
        .having(sql`COUNT(*) > 0`);
      
      const teamFocus = focusData.map(member => ({
        ...member,
        focus_ratio: member.total > 0 ? (member.planned / member.total) * 100 : 0
      }));
      
      res.json({ success: true, data: teamFocus });
    } catch (error) {
      console.error('Team focus analytics error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch team focus data' });
    }
  });

  // 6. Jira Sync Health - Integration status
  app.get("/api/jira/sync-health", verifyToken, async (req, res) => {
    try {
      const { projectId } = req.query;
      
      // Get sync status and recent errors
      const syncTasks = await db.select({
        id: tasks.id,
        title: tasks.title,
        jira_issue_key: tasks.jira_issue_key,
        last_synced: tasks.updated_at,
        sync_status: sql<string>`CASE WHEN ${tasks.jira_issue_key} IS NOT NULL THEN 'synced' ELSE 'not_synced' END`
      })
        .from(tasks)
        .where(eq(tasks.project_id, projectId as string));
      
      const totalTasks = syncTasks.length;
      const syncedTasks = syncTasks.filter(t => t.jira_issue_key).length;
      const syncPercentage = totalTasks > 0 ? (syncedTasks / totalTasks) * 100 : 0;
      
      // Mock recent sync activity (in real app, this would come from a sync log table)
      const lastSyncTime = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
      const syncHealth = syncPercentage > 80 ? 'healthy' : syncPercentage > 50 ? 'warning' : 'error';
      
      res.json({ 
        success: true, 
        data: { 
          syncPercentage, 
          totalTasks, 
          syncedTasks, 
          lastSyncTime, 
          syncHealth,
          recentErrors: [] // Would be populated from sync error logs
        }
      });
    } catch (error) {
      console.error('Jira sync health error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch Jira sync health' });
    }
  });

  // 7. Budget Summary - Burn rate and runway
  app.get("/api/budget/summary", verifyToken, async (req, res) => {
    try {
      const { projectId } = req.query;
      
      // Get project budget (would be from a budget table in real app)
      const project = await db.select().from(projects).where(eq(projects.id, projectId as string)).limit(1);
      if (!project.length) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }
      
      // Mock budget data (in real app, this would come from budget/expense tracking)
      const totalBudget = 500000; // $500k
      const spentToDate = Math.floor(Math.random() * 300000); // Random spent amount
      const burnRate = 50000; // $50k per month
      const remaining = totalBudget - spentToDate;
      const runwayMonths = remaining > 0 ? Math.floor(remaining / burnRate) : 0;
      
      const budgetHealth = remaining > totalBudget * 0.3 ? 'healthy' : remaining > totalBudget * 0.1 ? 'warning' : 'critical';
      
      // Category breakdown (mock data)
      const categoryAllocation = [
        { category: 'Personnel', amount: spentToDate * 0.6, percentage: 60 },
        { category: 'Infrastructure', amount: spentToDate * 0.2, percentage: 20 },
        { category: 'External Services', amount: spentToDate * 0.15, percentage: 15 },
        { category: 'Other', amount: spentToDate * 0.05, percentage: 5 }
      ];
      
      res.json({ 
        success: true, 
        data: { 
          totalBudget, 
          spentToDate, 
          remaining, 
          burnRate, 
          runwayMonths, 
          budgetHealth,
          spentPercentage: (spentToDate / totalBudget) * 100,
          categoryAllocation
        }
      });
    } catch (error) {
      console.error('Budget summary error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch budget summary' });
    }
  });

  // ================== PORTFOLIO ANALYTICS ENDPOINTS ==================
  
  // Portfolio Summary Analytics
  app.get("/api/analytics/portfolio/summary", verifyToken, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Get projects user has access to
      const userProjects = await db
        .select({ project_id: projectMembers.project_id })
        .from(projectMembers)
        .where(eq(projectMembers.user_id, userId));
      
      const projectIds = userProjects.map(p => p.project_id);
      
      if (projectIds.length === 0) {
        return res.json({
          success: true,
          data: {
            totalProjects: 0,
            activeProjects: 0,
            completedProjects: 0,
            onHoldProjects: 0,
            atRiskProjects: 0,
            totalBudget: 0
          }
        });
      }
      
      // Count projects by status
      const statusDistribution = await getProjectStatusDistribution(userId);
      
      // Calculate totals
      const totalProjects = statusDistribution.reduce((sum, item) => sum + (item.count || 0), 0);
      const activeProjects = statusDistribution.find(s => s.status === 'in_progress')?.count || 0;
      const completedProjects = statusDistribution.find(s => s.status === 'completed')?.count || 0;
      const onHoldProjects = statusDistribution.find(s => s.status === 'on_hold')?.count || 0;
      
      // Calculate at-risk projects (projects with overdue tasks)
      const atRiskProjects = await db
        .select({ count: count() })
        .from(projects)
        .innerJoin(projectMembers, eq(projectMembers.project_id, projects.id))
        .innerJoin(tasks, eq(tasks.project_id, projects.id))
        .where(and(
          eq(projectMembers.user_id, userId),
          lte(tasks.due_date, new Date().toISOString()),
          or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress'))
        ))
        .groupBy(projects.id);
      
      // Estimate total budget (mock for now)
      const totalBudget = totalProjects * 150000; // ~€150k per project average
      
      res.json({
        success: true,
        data: {
          totalProjects,
          activeProjects,
          completedProjects,
          onHoldProjects,
          atRiskProjects: atRiskProjects.length,
          totalBudget
        }
      });
    } catch (error) {
      console.error('Portfolio summary error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch portfolio summary' });
    }
  });

  // Resource Summary Analytics  
  app.get("/api/analytics/resources/summary", verifyToken, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Get all team members in user's projects
      const resources = await db
        .select({
          user_id: teamMembers.user_id,
          team_id: teamMembers.team_id,
          team_name: teams.name
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.team_id))
        .innerJoin(projectMembers, eq(projectMembers.project_id, teams.project_id))
        .where(eq(projectMembers.user_id, userId));
      
      const totalResources = resources.length;
      
      // Calculate resource allocation based on task assignments
      const resourceTasks = await db
        .select({
          user_id: tasks.owner_id,
          task_count: sql<number>`COUNT(DISTINCT ${tasks.id})`
        })
        .from(tasks)
        .innerJoin(projectMembers, eq(projectMembers.project_id, tasks.project_id))
        .where(and(
          eq(projectMembers.user_id, userId),
          isNotNull(tasks.owner_id)
        ))
        .groupBy(tasks.owner_id);
      
      const assignedResources = resourceTasks.filter(r => (r.task_count || 0) > 0).length;
      const availableResources = Math.max(0, totalResources - assignedResources);
      const overallocatedResources = resourceTasks.filter(r => (r.task_count || 0) > 10).length; // Mock threshold
      
      res.json({
        success: true,
        data: {
          totalResources,
          assignedResources,
          availableResources,
          overallocatedResources
        }
      });
    } catch (error) {
      console.error('Resource summary error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch resource summary' });
    }
  });

  // Resource Utilization Analytics
  app.get("/api/analytics/resources/utilization", verifyToken, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const utilization = await getResourceUtilization(userId);
      
      // Add mock names and roles for demonstration
      const enhancedUtilization = utilization.map((resource, index) => ({
        ...resource,
        name: `Resource ${index + 1}`,
        role: ['Developer', 'Designer', 'QA', 'Manager'][index % 4],
        team: ['Engineering', 'Design', 'QA', 'DevOps'][index % 4],
        utilization: Math.min(120, Math.max(60, 75 + Math.random() * 40)) // 60-120% range
      }));
      
      res.json({
        success: true,
        data: enhancedUtilization
      });
    } catch (error) {
      console.error('Resource utilization error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch resource utilization' });
    }
  });

  // My Tasks Summary Analytics
  app.get("/api/analytics/me/tasks/summary", verifyToken, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Get user's task counts by status
      const taskCounts = await db
        .select({
          status: tasks.status,
          count: count()
        })
        .from(tasks)
        .where(eq(tasks.owner_id, userId))
        .groupBy(tasks.status);
      
      const assignedTasks = taskCounts.reduce((sum, item) => sum + (item.count || 0), 0);
      const completedTasks = taskCounts.find(t => t.status === 'completed')?.count || 0;
      const inProgressTasks = taskCounts.find(t => t.status === 'in_progress')?.count || 0;
      const pendingTasks = taskCounts.find(t => t.status === 'pending')?.count || 0;
      
      // Calculate at-risk tasks (overdue)
      const atRiskTasks = await db
        .select({ count: count() })
        .from(tasks)
        .where(and(
          eq(tasks.owner_id, userId),
          lte(tasks.due_date, new Date().toISOString()),
          or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress'))
        ));
      
      res.json({
        success: true,
        data: {
          assignedTasks,
          completedTasks,
          inProgressTasks,
          pendingTasks,
          atRiskTasks: atRiskTasks[0]?.count || 0
        }
      });
    } catch (error) {
      console.error('My tasks summary error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch task summary' });
    }
  });

  // My Tasks List
  app.get("/api/workspace-service/my-tasks", verifyToken, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      const myTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          due_date: tasks.due_date,
          progress: tasks.progress,
          project_id: tasks.project_id,
          project_name: projects.name
        })
        .from(tasks)
        .leftJoin(projects, eq(projects.id, tasks.project_id))
        .where(eq(tasks.owner_id, userId))
        .orderBy(desc(tasks.updated_at))
        .limit(50);
      
      res.json({
        success: true,
        data: myTasks
      });
    } catch (error) {
      console.error('My tasks error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch my tasks' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
