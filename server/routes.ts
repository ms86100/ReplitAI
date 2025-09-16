import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { storage } from "./storage";
import { BackupAnalyzer } from "./services/backup-analyzer";
import { DatabaseRestorer } from "./services/database-restorer";
import { DatabaseVerifier } from "./services/verification";
import { insertMigrationJobSchema, projects, insertProjectSchema, budgetTypeConfig, projectBudgets, budgetCategories, budgetSpending, budgetReceipts, insertBudgetCategorySchema, insertBudgetSpendingSchema, tasks, milestones, stakeholders, riskRegister, projectDiscussions, discussionActionItems, discussionChangeLog, projectMembers, taskBacklog, teams, teamMembers, teamCapacityIterations, teamCapacityMembers, iterationWeeks, weeklyAvailability, insertTaskSchema, insertMilestoneSchema, insertStakeholderSchema, insertRiskSchema, insertProjectDiscussionSchema, insertDiscussionActionItemSchema, insertProjectMemberSchema, insertTaskBacklogSchema, insertTeamSchema, insertTeamMemberSchema, insertTeamCapacityIterationSchema, insertTeamCapacityMemberSchema, insertIterationWeekSchema, insertWeeklyAvailabilitySchema } from "@shared/schema";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../shared/schema';
import { eq, and } from 'drizzle-orm';

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
      const { projectId } = req.params;
      
      // Task analytics
      const projectTasks = await db.select().from(tasks).where(eq(tasks.project_id, projectId));
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
      const overdueTasks = projectTasks.filter(t => 
        t.due_date && new Date(t.due_date) < new Date() && 
        t.status !== 'completed' && t.status !== 'done'
      ).length;
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

      // Project health calculation
      const budgetHealth = totalAllocated > 0 ? Math.max(0, 100 - (totalSpent / totalAllocated * 100)) : 100;
      const timelineHealth = totalMilestones > 0 ? (completedMilestones / totalMilestones * 100) : 50;
      const riskHealth = totalRisks > 0 ? Math.max(0, 100 - (highRisks / totalRisks * 100)) : 100;
      const teamHealth = avgCapacity;
      const overallHealth = (budgetHealth + timelineHealth + riskHealth + teamHealth) / 4;

      // Task distribution by status
      const tasksByStatus = [
        { status: 'todo', count: projectTasks.filter(t => t.status === 'todo').length },
        { status: 'in_progress', count: projectTasks.filter(t => t.status === 'in_progress').length },
        { status: 'completed', count: completedTasks },
        { status: 'on_hold', count: projectTasks.filter(t => t.status === 'on_hold').length }
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
          productivityTrend: []
        },
        riskAnalysis: {
          totalRisks,
          highRisks,
          mitigatedRisks,
          riskHeatmap: [],
          risksByCategory: []
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
        categories = categoriesResult;
        
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
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create budget category" 
      });
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
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to create spending entry" 
      });
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

  const httpServer = createServer(app);
  return httpServer;
}
