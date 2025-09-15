const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyProjectAccess } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /roadmap-service/projects/:id/roadmap
router.get('/projects/:id/roadmap', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    const milestonesQuery = `
      SELECT m.*,
        pr.full_name as created_by_name,
        CASE 
          WHEN m.due_date < CURRENT_DATE AND m.status NOT IN ('completed') THEN true
          ELSE false
        END as overdue
      FROM milestones m
      LEFT JOIN profiles pr ON m.created_by = pr.id
      WHERE m.project_id = $1
      ORDER BY m.due_date, m.created_at
    `;
    
    const result = await query(milestonesQuery, [projectId]);
    
    sendResponse(res, createSuccessResponse({
      projectId,
      milestones: result.rows
    }));
  } catch (error) {
    console.error('Get roadmap error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch roadmap', 'FETCH_ERROR', 500));
  }
});

// POST /roadmap-service/projects/:id/roadmap
router.post('/projects/:id/roadmap', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const userId = req.user.id;
    const { name, description, dueDate, status } = req.body;
    
    if (!name || !dueDate) {
      return sendResponse(res, createErrorResponse('Name and due date required', 'MISSING_FIELDS', 400));
    }

    const milestoneId = uuidv4();
    
    const insertQuery = `
      INSERT INTO milestones (id, project_id, name, description, due_date, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const now = new Date();
    const result = await query(insertQuery, [
      milestoneId,
      projectId,
      name,
      description || null,
      dueDate,
      status || 'planning',
      userId,
      now,
      now
    ]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Milestone created successfully',
      milestone: result.rows[0]
    }));
  } catch (error) {
    console.error('Create milestone error:', error);
    sendResponse(res, createErrorResponse('Failed to create milestone', 'CREATE_ERROR', 500));
  }
});

// PUT /roadmap-service/projects/:id/roadmap/:milestoneId
router.put('/projects/:id/roadmap/:milestoneId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const milestoneId = req.params.milestoneId;
    const { name, description, dueDate, status } = req.body;
    
    const updateQuery = `
      UPDATE milestones 
      SET name = COALESCE($3, name),
          description = COALESCE($4, description),
          due_date = COALESCE($5, due_date),
          status = COALESCE($6, status),
          updated_at = $7
      WHERE id = $1 AND project_id = $2
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      milestoneId,
      projectId,
      name,
      description,
      dueDate,
      status,
      new Date()
    ]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Milestone not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({
      message: 'Milestone updated successfully',
      milestone: result.rows[0]
    }));
  } catch (error) {
    console.error('Update milestone error:', error);
    sendResponse(res, createErrorResponse('Failed to update milestone', 'UPDATE_ERROR', 500));
  }
});

// DELETE /roadmap-service/projects/:id/roadmap/:milestoneId
router.delete('/projects/:id/roadmap/:milestoneId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const milestoneId = req.params.milestoneId;
    
    const deleteQuery = 'DELETE FROM milestones WHERE id = $1 AND project_id = $2 RETURNING id';
    const result = await query(deleteQuery, [milestoneId, projectId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Milestone not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Milestone deleted successfully' }));
  } catch (error) {
    console.error('Delete milestone error:', error);
    sendResponse(res, createErrorResponse('Failed to delete milestone', 'DELETE_ERROR', 500));
  }
});

module.exports = router;