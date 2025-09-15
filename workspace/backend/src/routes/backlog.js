const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyProjectAccess } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /backlog-service/projects/:id/backlog
router.get('/projects/:id/backlog', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const { status } = req.query;
    
    let backlogQuery = `
      SELECT tb.*, pr.full_name as created_by_name
      FROM task_backlog tb
      LEFT JOIN profiles pr ON tb.created_by = pr.id
      WHERE tb.project_id = $1
    `;
    
    const queryParams = [projectId];
    
    if (status) {
      backlogQuery += ` AND tb.status = $2`;
      queryParams.push(status);
    }
    
    backlogQuery += ` ORDER BY tb.created_at DESC`;
    
    const result = await query(backlogQuery, queryParams);
    
    sendResponse(res, createSuccessResponse({
      projectId,
      items: result.rows
    }));
  } catch (error) {
    console.error('Get backlog error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch backlog', 'FETCH_ERROR', 500));
  }
});

// POST /backlog-service/projects/:id/backlog
router.post('/projects/:id/backlog', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const userId = req.user.id;
    const { title, description, priority, status, ownerId, targetDate, sourceType } = req.body;
    
    if (!title) {
      return sendResponse(res, createErrorResponse('Title required', 'MISSING_FIELDS', 400));
    }

    const itemId = uuidv4();
    
    const insertQuery = `
      INSERT INTO task_backlog (id, project_id, title, description, priority, status, owner_id, target_date, source_type, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const now = new Date();
    const result = await query(insertQuery, [
      itemId,
      projectId,
      title,
      description || null,
      priority || 'medium',
      status || 'backlog',
      ownerId || null,
      targetDate || null,
      sourceType || 'manual',
      userId,
      now,
      now
    ]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Backlog item created successfully',
      item: result.rows[0]
    }));
  } catch (error) {
    console.error('Create backlog item error:', error);
    sendResponse(res, createErrorResponse('Failed to create backlog item', 'CREATE_ERROR', 500));
  }
});

// PUT /backlog-service/projects/:id/backlog/:itemId
router.put('/projects/:id/backlog/:itemId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const itemId = req.params.itemId;
    const { title, description, priority, status, ownerId, targetDate } = req.body;
    
    const updateQuery = `
      UPDATE task_backlog 
      SET title = COALESCE($3, title),
          description = COALESCE($4, description),
          priority = COALESCE($5, priority),
          status = COALESCE($6, status),
          owner_id = COALESCE($7, owner_id),
          target_date = COALESCE($8, target_date),
          updated_at = $9
      WHERE id = $1 AND project_id = $2
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      itemId,
      projectId,
      title,
      description,
      priority,
      status,
      ownerId,
      targetDate,
      new Date()
    ]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Backlog item not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({
      message: 'Backlog item updated successfully',
      item: result.rows[0]
    }));
  } catch (error) {
    console.error('Update backlog item error:', error);
    sendResponse(res, createErrorResponse('Failed to update backlog item', 'UPDATE_ERROR', 500));
  }
});

// DELETE /backlog-service/projects/:id/backlog/:itemId
router.delete('/projects/:id/backlog/:itemId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const itemId = req.params.itemId;
    
    const deleteQuery = 'DELETE FROM task_backlog WHERE id = $1 AND project_id = $2 RETURNING id';
    const result = await query(deleteQuery, [itemId, projectId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Backlog item not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Backlog item deleted successfully' }));
  } catch (error) {
    console.error('Delete backlog item error:', error);
    sendResponse(res, createErrorResponse('Failed to delete backlog item', 'DELETE_ERROR', 500));
  }
});

// POST /backlog-service/projects/:id/backlog/:itemId/move
router.post('/projects/:id/backlog/:itemId/move', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const itemId = req.params.itemId;
    const userId = req.user.id;
    const { milestoneId } = req.body;
    
    if (!milestoneId) {
      return sendResponse(res, createErrorResponse('Milestone ID required', 'MISSING_FIELDS', 400));
    }

    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get backlog item
      const backlogResult = await client.query(
        'SELECT * FROM task_backlog WHERE id = $1 AND project_id = $2',
        [itemId, projectId]
      );
      
      if (backlogResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendResponse(res, createErrorResponse('Backlog item not found', 'NOT_FOUND', 404));
      }
      
      const backlogItem = backlogResult.rows[0];
      
      // Create task from backlog item
      const taskId = uuidv4();
      const now = new Date();
      
      const taskResult = await client.query(`
        INSERT INTO tasks (id, project_id, milestone_id, title, description, priority, status, due_date, owner_id, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        taskId,
        projectId,
        milestoneId,
        backlogItem.title,
        backlogItem.description,
        backlogItem.priority,
        'todo',
        backlogItem.target_date,
        backlogItem.owner_id,
        userId,
        now,
        now
      ]);
      
      // Update backlog item status
      await client.query(
        'UPDATE task_backlog SET status = $1 WHERE id = $2',
        ['done', itemId]
      );
      
      await client.query('COMMIT');
      
      sendResponse(res, createSuccessResponse({
        message: 'Backlog item moved to milestone successfully',
        task: taskResult.rows[0]
      }));
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Move backlog item error:', error);
    sendResponse(res, createErrorResponse('Failed to move backlog item', 'MOVE_ERROR', 500));
  }
});

module.exports = router;