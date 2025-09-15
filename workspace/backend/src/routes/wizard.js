const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// POST /wizard-service/projects/wizard/start
router.post('/projects/wizard/start', verifyToken, async (req, res) => {
  try {
    const seed = req.body || {};
    const sessionId = uuidv4();
    
    sendResponse(res, createSuccessResponse({
      message: 'Wizard session started',
      sessionId,
      seed
    }));
  } catch (error) {
    console.error('Start wizard error:', error);
    sendResponse(res, createErrorResponse('Failed to start wizard', 'START_ERROR', 500));
  }
});

// POST /wizard-service/projects/wizard/complete
router.post('/projects/wizard/complete', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, startDate, endDate, priority, status, departmentId } = req.body;
    
    if (!name) {
      return sendResponse(res, createErrorResponse('Project name required', 'MISSING_FIELDS', 400));
    }

    const projectId = uuidv4();
    const now = new Date();
    
    const insertQuery = `
      INSERT INTO projects (id, name, description, start_date, end_date, priority, status, department_id, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      projectId,
      name,
      description || null,
      startDate || null,
      endDate || null,
      priority || 'medium',
      status || 'planning',
      departmentId || null,
      userId,
      now,
      now
    ]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Project created successfully',
      project: result.rows[0]
    }));
  } catch (error) {
    console.error('Complete wizard error:', error);
    sendResponse(res, createErrorResponse('Failed to create project', 'CREATE_ERROR', 500));
  }
});

// POST /wizard-service/projects/create (with milestones and tasks)
router.post('/projects/create', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, objective, startDate, endDate, tasks, milestones, inviteEmails } = req.body;
    
    if (!name) {
      return sendResponse(res, createErrorResponse('Project name required', 'MISSING_FIELDS', 400));
    }

    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');
      
      const projectId = uuidv4();
      const now = new Date();
      
      // Create project
      const projectResult = await client.query(`
        INSERT INTO projects (id, name, description, start_date, end_date, priority, status, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        projectId,
        name,
        objective || null,
        startDate || null,
        endDate || null,
        'medium',
        'planning',
        userId,
        now,
        now
      ]);
      
      const project = projectResult.rows[0];
      let createdMilestones = 0;
      let createdTasks = 0;
      
      // Create milestones if provided
      if (milestones && Array.isArray(milestones)) {
        for (const milestone of milestones) {
          const milestoneId = uuidv4();
          
          await client.query(`
            INSERT INTO milestones (id, project_id, name, description, due_date, status, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            milestoneId,
            projectId,
            milestone.name,
            milestone.description || null,
            milestone.due_date || null,
            'planning',
            userId,
            now,
            now
          ]);
          
          createdMilestones++;
          
          // Create tasks for this milestone if provided
          if (milestone.tasks && Array.isArray(milestone.tasks)) {
            for (const task of milestone.tasks) {
              const taskId = uuidv4();
              
              await client.query(`
                INSERT INTO tasks (id, project_id, milestone_id, title, description, priority, status, created_by, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              `, [
                taskId,
                projectId,
                milestoneId,
                task.title,
                task.description || null,
                task.priority || 'medium',
                'todo',
                userId,
                now,
                now
              ]);
              
              createdTasks++;
            }
          }
        }
      }
      
      // Create standalone tasks only when no milestones are provided
      if ((!milestones || milestones.length === 0) && tasks && Array.isArray(tasks)) {
        for (const task of tasks) {
          const taskId = uuidv4();
          
          await client.query(`
            INSERT INTO tasks (id, project_id, title, description, priority, status, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            taskId,
            projectId,
            task.title,
            task.description || null,
            task.priority || 'medium',
            'todo',
            userId,
            now,
            now
          ]);
          
          createdTasks++;
        }
      }
      
      await client.query('COMMIT');
      
      const summaryMessage = `Project created with ${createdMilestones} milestones and ${createdTasks} tasks`;
      
      sendResponse(res, createSuccessResponse({
        message: summaryMessage,
        project,
        summary: {
          milestonesCreated: createdMilestones,
          tasksCreated: createdTasks
        }
      }));
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Create project with structure error:', error);
    sendResponse(res, createErrorResponse('Failed to create project structure', 'CREATE_ERROR', 500));
  }
});

module.exports = router;