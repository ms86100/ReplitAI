const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyProjectAccess } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /workspace-service/projects/:id/workspace
router.get('/projects/:id/workspace', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    // Get project summary
    const projectQuery = `
      SELECT p.*,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_tasks,
        (SELECT COUNT(*) FROM milestones WHERE project_id = p.id) as total_milestones,
        (SELECT COUNT(*) FROM milestones WHERE project_id = p.id AND status = 'completed') as completed_milestones,
        d.name as department_name
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = $1
    `;
    
    const projectResult = await query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Project not found', 'NOT_FOUND', 404));
    }
    
    const project = projectResult.rows[0];
    
    // Get recent tasks
    const recentTasksQuery = `
      SELECT t.*, m.name as milestone_name, pr.full_name as created_by_name
      FROM tasks t
      LEFT JOIN milestones m ON t.milestone_id = m.id
      LEFT JOIN profiles pr ON t.created_by = pr.id
      WHERE t.project_id = $1
      ORDER BY t.updated_at DESC
      LIMIT 10
    `;
    
    const recentTasksResult = await query(recentTasksQuery, [projectId]);
    
    // Get upcoming milestones
    const upcomingMilestonesQuery = `
      SELECT m.*, pr.full_name as created_by_name,
        CASE 
          WHEN m.due_date < CURRENT_DATE AND m.status NOT IN ('completed') THEN true
          ELSE false
        END as overdue
      FROM milestones m
      LEFT JOIN profiles pr ON m.created_by = pr.id
      WHERE m.project_id = $1 AND m.status != 'completed'
      ORDER BY m.due_date
      LIMIT 5
    `;
    
    const upcomingMilestonesResult = await query(upcomingMilestonesQuery, [projectId]);
    
    // Calculate completion percentages
    const taskCompletionRate = project.total_tasks > 0 
      ? Math.round((project.completed_tasks / project.total_tasks) * 100) 
      : 0;
    
    const milestoneCompletionRate = project.total_milestones > 0 
      ? Math.round((project.completed_milestones / project.total_milestones) * 100) 
      : 0;
    
    const summary = {
      ...project,
      taskCompletionRate,
      milestoneCompletionRate
    };
    
    sendResponse(res, createSuccessResponse({
      projectId,
      summary,
      recentTasks: recentTasksResult.rows,
      upcomingMilestones: upcomingMilestonesResult.rows
    }));
  } catch (error) {
    console.error('Get workspace error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch workspace data', 'FETCH_ERROR', 500));
  }
});

// GET /workspace-service/projects/:id/tasks
router.get('/projects/:id/tasks', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const tasksQuery = `
      SELECT t.*, m.name AS milestone_name
      FROM tasks t
      LEFT JOIN milestones m ON t.milestone_id = m.id
      WHERE t.project_id = $1
      ORDER BY t.created_at DESC
    `;
    const result = await query(tasksQuery, [projectId]);
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get project tasks error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch tasks', 'FETCH_ERROR', 500));
  }
});

// GET /workspace-service/projects/:id/milestones
router.get('/projects/:id/milestones', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const milestonesQuery = `
      SELECT m.*, COALESCE(COUNT(t.id), 0) AS task_count
      FROM milestones m
      LEFT JOIN tasks t ON t.milestone_id = m.id
      WHERE m.project_id = $1
      GROUP BY m.id
      ORDER BY m.due_date NULLS LAST, m.created_at DESC
    `;
    const result = await query(milestonesQuery, [projectId]);
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get project milestones error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch milestones', 'FETCH_ERROR', 500));
  }
});

// POST /workspace-service/projects/:id/tasks
router.post('/projects/:id/tasks', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const userId = req.user.id;
    const { title, description, priority, status, milestoneId, dueDate, ownerId } = req.body;
    
    if (!title) {
      return sendResponse(res, createErrorResponse('Task title required', 'MISSING_FIELDS', 400));
    }

    const taskId = uuidv4();
    const now = new Date();
    
    const insertQuery = `
      INSERT INTO tasks (id, project_id, milestone_id, title, description, priority, status, due_date, owner_id, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      taskId,
      projectId,
      milestoneId || null,
      title,
      description || null,
      priority || 'medium',
      status || 'todo',
      dueDate || null,
      ownerId || null,
      userId,
      now,
      now
    ]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Task created successfully',
      task: result.rows[0]
    }));
  } catch (error) {
    console.error('Create task error:', error);
    sendResponse(res, createErrorResponse('Failed to create task', 'CREATE_ERROR', 500));
  }
});

// PUT /workspace-service/tasks/:id
router.put('/tasks/:id', verifyToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;
    const { title, description, priority, status, milestoneId, dueDate, ownerId } = req.body;
    
    // Verify user has access to task's project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin'::app_role) OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [taskId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Task access denied', 'FORBIDDEN', 403));
    }
    
    const updateQuery = `
      UPDATE tasks 
      SET title = COALESCE($2, title),
          description = COALESCE($3, description),
          priority = COALESCE($4, priority),
          status = COALESCE($5, status),
          milestone_id = COALESCE($6, milestone_id),
          due_date = COALESCE($7, due_date),
          owner_id = COALESCE($8, owner_id),
          updated_at = $9
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      taskId,
      title,
      description,
      priority,
      status,
      milestoneId,
      dueDate,
      ownerId,
      new Date()
    ]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Task not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse(result.rows[0]));
  } catch (error) {
    console.error('Update task error:', error);
    sendResponse(res, createErrorResponse('Failed to update task', 'UPDATE_ERROR', 500));
  }
});

// DELETE /workspace-service/tasks/:id
router.delete('/tasks/:id', verifyToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;
    
    // Verify user has access to task's project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [taskId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Task access denied', 'FORBIDDEN', 403));
    }
    
    const deleteQuery = 'DELETE FROM tasks WHERE id = $1 RETURNING id';
    const result = await query(deleteQuery, [taskId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Task not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Task deleted successfully' }));
  } catch (error) {
    console.error('Delete task error:', error);
    sendResponse(res, createErrorResponse('Failed to delete task', 'DELETE_ERROR', 500));
  }
});

// GET /workspace-service/tasks/:id/status-history
router.get('/tasks/:id/status-history', verifyToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;
    
    // Verify user has access to task's project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [taskId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Task access denied', 'FORBIDDEN', 403));
    }
    
    const historyQuery = `
      SELECT tsh.*, p.full_name as changed_by_name
      FROM task_status_history tsh
      LEFT JOIN profiles p ON tsh.changed_by = p.id
      WHERE tsh.task_id = $1
      ORDER BY tsh.changed_at DESC
    `;
    
    const result = await query(historyQuery, [taskId]);
    
    sendResponse(res, createSuccessResponse({ history: result.rows }));
  } catch (error) {
    console.error('Get task status history error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch task status history', 'FETCH_ERROR', 500));
  }
});

// PUT /workspace-service/tasks/:id/move
router.put('/tasks/:id/move', verifyToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;
    const { milestone_id } = req.body;
    
    // Verify user has access to task's project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [taskId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Task access denied', 'FORBIDDEN', 403));
    }
    
    const updateQuery = `
      UPDATE tasks 
      SET milestone_id = $2, updated_at = $3
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(updateQuery, [taskId, milestone_id, new Date()]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Task not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Task moved successfully' }));
  } catch (error) {
    console.error('Move task error:', error);
    sendResponse(res, createErrorResponse('Failed to move task', 'MOVE_ERROR', 500));
  }
});

// POST /workspace-service/projects/:id/discussions
router.post('/projects/:id/discussions', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const userId = req.user.id;
    
    console.log('🔍 Discussion creation request:', {
      projectId,
      userId,
      body: req.body
    });
    
    const { meeting_title, meeting_date, attendees, summary_notes } = req.body;
    
    if (!meeting_title || !meeting_date) {
      console.error('❌ Missing required fields:', { meeting_title, meeting_date });
      return sendResponse(res, createErrorResponse('Meeting title and date are required', 'MISSING_FIELDS', 400));
    }

    const discussionId = uuidv4();
    const now = new Date();
    
    // Normalize attendees (ensure it's properly formatted for JSON storage)
    let attendeesJson = null;
    if (attendees) {
      if (Array.isArray(attendees)) {
        attendeesJson = JSON.stringify(attendees);
      } else if (typeof attendees === 'string') {
        try {
          // Try to parse if it's already a JSON string
          JSON.parse(attendees);
          attendeesJson = attendees;
        } catch {
          // If not valid JSON, treat as plain string and wrap in array
          attendeesJson = JSON.stringify([attendees]);
        }
      } else {
        attendeesJson = JSON.stringify(attendees);
      }
    }
    
    console.log('📝 Normalized discussion data:', {
      discussionId, projectId, meeting_title, meeting_date, 
      attendeesJson, summary_notes, userId
    });
    
    const insertQuery = `
      INSERT INTO project_discussions (id, project_id, meeting_title, meeting_date, attendees, summary_notes, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      discussionId,
      projectId,
      meeting_title,
      meeting_date,
      attendeesJson,
      summary_notes || null,
      userId,
      now,
      now
    ]);
    
    console.log('✅ Discussion created successfully:', result.rows[0]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Discussion created successfully',
      discussion: result.rows[0]
    }));
  } catch (error) {
    console.error('🔥 Create discussion error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint
    });
    
    const errorMessage = error.detail || error.message || 'Unknown database error';
    const errorCode = error.code || 'CREATE_ERROR';
    
    sendResponse(res, createErrorResponse(
      `Failed to create discussion: ${errorMessage}`, 
      errorCode, 
      500
    ));
  }
});

// GET /workspace-service/projects/:id/discussions
router.get('/projects/:id/discussions', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    const discussionsQuery = `
      SELECT pd.*, pr.full_name as created_by_name
      FROM project_discussions pd
      LEFT JOIN profiles pr ON pd.created_by = pr.id
      WHERE pd.project_id = $1
      ORDER BY pd.meeting_date DESC, pd.created_at DESC
    `;
    
    const result = await query(discussionsQuery, [projectId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get discussions error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch discussions', 'FETCH_ERROR', 500));
  }
});

// PUT /workspace-service/projects/:id/discussions/:discussionId
router.put('/projects/:id/discussions/:discussionId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const discussionId = req.params.discussionId;
    const { meeting_title, meeting_date, attendees, summary_notes } = req.body;
    
    const updateQuery = `
      UPDATE project_discussions 
      SET meeting_title = COALESCE($3, meeting_title),
          meeting_date = COALESCE($4, meeting_date),
          attendees = COALESCE($5, attendees),
          summary_notes = COALESCE($6, summary_notes),
          updated_at = $7
      WHERE id = $1 AND project_id = $2
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      discussionId,
      projectId,
      meeting_title,
      meeting_date,
      attendees ? JSON.stringify(attendees) : null,
      summary_notes,
      new Date()
    ]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Discussion not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({
      message: 'Discussion updated successfully',
      discussion: result.rows[0]
    }));
  } catch (error) {
    console.error('Update discussion error:', error);
    sendResponse(res, createErrorResponse('Failed to update discussion', 'UPDATE_ERROR', 500));
  }
});

// DELETE /workspace-service/projects/:id/discussions/:discussionId
router.delete('/projects/:id/discussions/:discussionId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const discussionId = req.params.discussionId;
    
    const deleteQuery = 'DELETE FROM project_discussions WHERE id = $1 AND project_id = $2 RETURNING id';
    const result = await query(deleteQuery, [discussionId, projectId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Discussion not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Discussion deleted successfully' }));
  } catch (error) {
    console.error('Delete discussion error:', error);
    sendResponse(res, createErrorResponse('Failed to delete discussion', 'DELETE_ERROR', 500));
  }
});

// POST /workspace-service/projects/:id/action-items
router.post('/projects/:id/action-items', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const userId = req.user.id;
    const { discussion_id, task_description, owner_id, target_date } = req.body;
    
    if (!discussion_id || !task_description) {
      return sendResponse(res, createErrorResponse('Discussion ID and task description required', 'MISSING_FIELDS', 400));
    }

    const actionItemId = uuidv4();
    const now = new Date();
    
    const insertQuery = `
      INSERT INTO discussion_action_items (id, discussion_id, task_description, owner_id, target_date, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      actionItemId,
      discussion_id,
      task_description,
      owner_id || null,
      target_date || null,
      userId,
      now,
      now
    ]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Action item created successfully',
      actionItem: result.rows[0]
    }));
  } catch (error) {
    console.error('Create action item error:', error);
    sendResponse(res, createErrorResponse('Failed to create action item', 'CREATE_ERROR', 500));
  }
});

// GET /workspace-service/projects/:id/action-items
router.get('/projects/:id/action-items', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    const actionItemsQuery = `
      SELECT dai.*, pd.meeting_title, pr.full_name as created_by_name
      FROM discussion_action_items dai
      JOIN project_discussions pd ON dai.discussion_id = pd.id
      LEFT JOIN profiles pr ON dai.created_by = pr.id
      WHERE pd.project_id = $1
      ORDER BY dai.created_at DESC
    `;
    
    const result = await query(actionItemsQuery, [projectId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get action items error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch action items', 'FETCH_ERROR', 500));
  }
});

// PUT /workspace-service/projects/:id/action-items/:actionItemId
router.put('/projects/:id/action-items/:actionItemId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const actionItemId = req.params.actionItemId;
    const { task_description, owner_id, target_date, status } = req.body;
    
    const updateQuery = `
      UPDATE discussion_action_items 
      SET task_description = COALESCE($2, task_description),
          owner_id = COALESCE($3, owner_id),
          target_date = COALESCE($4, target_date),
          status = COALESCE($5, status),
          updated_at = $6
      WHERE id = $1 AND discussion_id IN (
        SELECT id FROM project_discussions WHERE project_id = $7
      )
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      actionItemId,
      task_description,
      owner_id,
      target_date,
      status,
      new Date(),
      projectId
    ]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Action item not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({
      message: 'Action item updated successfully',
      actionItem: result.rows[0]
    }));
  } catch (error) {
    console.error('Update action item error:', error);
    sendResponse(res, createErrorResponse('Failed to update action item', 'UPDATE_ERROR', 500));
  }
});

// DELETE /workspace-service/projects/:id/action-items/:actionItemId
router.delete('/projects/:id/action-items/:actionItemId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const actionItemId = req.params.actionItemId;
    
    const deleteQuery = `
      DELETE FROM discussion_action_items 
      WHERE id = $1 AND discussion_id IN (
        SELECT id FROM project_discussions WHERE project_id = $2
      )
      RETURNING id
    `;
    
    const result = await query(deleteQuery, [actionItemId, projectId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Action item not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Action item deleted successfully' }));
  } catch (error) {
    console.error('Delete action item error:', error);
    sendResponse(res, createErrorResponse('Failed to delete action item', 'DELETE_ERROR', 500));
  }
});

// GET /workspace-service/projects/:id/risks
router.get('/projects/:id/risks', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    const risksQuery = `
      SELECT rr.*, pr.full_name as created_by_name
      FROM risk_register rr
      LEFT JOIN profiles pr ON rr.created_by = pr.id
      WHERE rr.project_id = $1
      ORDER BY rr.risk_score DESC NULLS LAST, rr.created_at DESC
    `;
    
    const result = await query(risksQuery, [projectId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get risks error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    sendResponse(res, createErrorResponse(`Failed to fetch risks: ${error.message}`, 'FETCH_ERROR', 500));
  }
});

// POST /workspace-service/projects/:id/risks
router.post('/projects/:id/risks', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const userId = req.user.id;
    
    console.log('🔍 Risk creation request:', {
      projectId,
      userId,
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? `${req.headers.authorization.substring(0, 16)}...` : 'none'
      }
    });
    
    // Extract and normalize fields to match edge function format
    let { 
      risk_code, title, description, category, cause, consequence, 
      likelihood, impact, owner, response_strategy, mitigation_plan, 
      contingency_plan, status, notes 
    } = req.body;
    
    // Validate required fields
    if (!risk_code || !title) {
      console.error('❌ Missing required fields:', { risk_code, title });
      return sendResponse(res, createErrorResponse('Risk code and title are required', 'MISSING_FIELDS', 400));
    }

    // Normalize data to match edge function format
    // Convert empty strings to null for nullable fields
    description = description?.trim() === '' ? null : description;
    category = category?.trim() === '' ? null : category;
    cause = cause?.trim() === '' ? null : cause;
    consequence = consequence?.trim() === '' ? null : consequence;
    owner = owner?.trim() === '' ? null : owner;
    response_strategy = response_strategy?.trim() === '' ? null : response_strategy;
    contingency_plan = contingency_plan?.trim() === '' ? null : contingency_plan;
    notes = notes?.trim() === '' ? null : notes;
    
    // Ensure mitigation_plan is handled properly (it can be string or array)
    if (typeof mitigation_plan === 'string' && mitigation_plan.trim() === '') {
      mitigation_plan = null;
    }
    
    // Ensure numeric fields are proper numbers
    likelihood = likelihood === '' || likelihood === null || likelihood === undefined ? null : Number(likelihood);
    impact = impact === '' || impact === null || impact === undefined ? null : Number(impact);
    
    // Ensure status has a default
    status = status || 'open';

    const riskId = uuidv4();
    const now = new Date();
    const risk_score = (likelihood && impact) ? likelihood * impact : null;
    
    console.log('📝 Normalized risk data:', {
      riskId, projectId, risk_code, title, description, category, cause, consequence,
      likelihood, impact, risk_score, owner, response_strategy, mitigation_plan,
      contingency_plan, status, notes, userId
    });
    
    const insertQuery = `
      INSERT INTO risk_register (
        id, project_id, risk_code, title, description, category, cause, consequence,
        likelihood, impact, owner, response_strategy, mitigation_plan,
        contingency_plan, status, notes, identified_date, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      riskId, projectId, risk_code, title, description, category, cause, consequence,
      likelihood, impact, owner, response_strategy, mitigation_plan,
      contingency_plan, status, notes, now.toISOString().split('T')[0], userId, now, now
    ]);
    
    console.log('✅ Risk created successfully:', result.rows[0]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Risk created successfully',
      risk: result.rows[0]
    }));
  } catch (error) {
    console.error('🔥 Create risk error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      where: error.where,
      position: error.position,
      internalPosition: error.internalPosition,
      internalQuery: error.internalQuery,
      file: error.file,
      line: error.line,
      routine: error.routine
    });
    
    // Return detailed error information
    const errorMessage = error.detail || error.message || 'Unknown database error';
    const errorCode = error.code || 'CREATE_ERROR';
    
    sendResponse(res, createErrorResponse(
      `Failed to create risk: ${errorMessage}`, 
      errorCode, 
      500
    ));
  }
});

// PUT /workspace-service/projects/:id/risks/:riskId
router.put('/projects/:id/risks/:riskId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const riskId = req.params.riskId;
    const { 
      risk_code, title, description, category, cause, consequence, 
      likelihood, impact, owner, response_strategy, mitigation_plan, 
      contingency_plan, status, notes 
    } = req.body;
    
    // Calculate risk score if likelihood and impact are provided
    let risk_score = null;
    if (likelihood !== undefined && impact !== undefined) {
      risk_score = likelihood * impact;
    }
    
    const updateQuery = `
      UPDATE risk_register 
      SET risk_code = COALESCE($3, risk_code),
          title = COALESCE($4, title),
          description = COALESCE($5, description),
          category = COALESCE($6, category),
          cause = COALESCE($7, cause),
          consequence = COALESCE($8, consequence),
          likelihood = COALESCE($9, likelihood),
          impact = COALESCE($10, impact),
          owner = COALESCE($11, owner),
          response_strategy = COALESCE($12, response_strategy),
          mitigation_plan = COALESCE($13, mitigation_plan),
          contingency_plan = COALESCE($14, contingency_plan),
          status = COALESCE($15, status),
          notes = COALESCE($16, notes),
          last_updated = $17,
          updated_at = $18
      WHERE id = $1 AND project_id = $2
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      riskId, projectId, risk_code, title, description, category, cause, consequence,
      likelihood, impact, owner, response_strategy, mitigation_plan,
      contingency_plan, status, notes, new Date().toISOString().split('T')[0], new Date()
    ]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Risk not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({
      message: 'Risk updated successfully',
      risk: result.rows[0]
    }));
  } catch (error) {
    console.error('Update risk error:', error);
    sendResponse(res, createErrorResponse('Failed to update risk', 'UPDATE_ERROR', 500));
  }
});

// DELETE /workspace-service/projects/:id/risks/:riskId
router.delete('/projects/:id/risks/:riskId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const riskId = req.params.riskId;
    
    const deleteQuery = 'DELETE FROM risk_register WHERE id = $1 AND project_id = $2 RETURNING id';
    const result = await query(deleteQuery, [riskId, projectId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Risk not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Risk deleted successfully' }));
  } catch (error) {
    console.error('Delete risk error:', error);
    sendResponse(res, createErrorResponse('Failed to delete risk', 'DELETE_ERROR', 500));
  }
});

// GET /workspace-service/projects/:id/members
router.get('/projects/:id/members', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    const membersQuery = `
      SELECT pm.*, pr.full_name, pr.email
      FROM project_members pm
      LEFT JOIN profiles pr ON pm.user_id = pr.id
      WHERE pm.project_id = $1
      ORDER BY pr.full_name ASC
    `;
    
    const result = await query(membersQuery, [projectId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get project members error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch project members', 'FETCH_ERROR', 500));
  }
});

// GET /workspace-service/projects/:id/change-log
router.get('/projects/:id/change-log', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    const changeLogQuery = `
      SELECT dcl.*, pr.full_name as changed_by_name,
             pd.meeting_title as discussion_title,
             dai.task_description as action_item_description
      FROM discussion_change_log dcl
      LEFT JOIN profiles pr ON dcl.changed_by = pr.id
      LEFT JOIN project_discussions pd ON dcl.discussion_id = pd.id
      LEFT JOIN discussion_action_items dai ON dcl.action_item_id = dai.id
      WHERE dcl.discussion_id IN (
        SELECT id FROM project_discussions WHERE project_id = $1
      )
      ORDER BY dcl.created_at DESC
    `;
    
    const result = await query(changeLogQuery, [projectId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get change log error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch change log', 'FETCH_ERROR', 500));
  }
});

module.exports = router;
