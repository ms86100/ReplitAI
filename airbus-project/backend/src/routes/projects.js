const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /projects-service/projects
router.get('/projects', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get projects user has access to
    const projectsQuery = `
      SELECT DISTINCT p.*, 
        d.name as department_name,
        pr.full_name as creator_name
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN profiles pr ON p.created_by = pr.id
      WHERE p.created_by = $1 
        OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $1 AND ur.role = 'admin'::app_role)
        OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1)
        OR EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $1)
      ORDER BY p.created_at DESC
    `;
    
    const result = await query(projectsQuery, [userId]);
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get projects error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch projects', 'FETCH_ERROR', 500));
  }
});

// POST /projects-service/projects
router.post('/projects', verifyToken, async (req, res) => {
  try {
    const { name, description, startDate, endDate, priority, status, departmentId } = req.body;
    const userId = req.user.id;
    
    if (!name) {
      return sendResponse(res, createErrorResponse('Project name required', 'MISSING_FIELDS', 400));
    }

    const projectId = uuidv4();
    
    const insertQuery = `
      INSERT INTO projects (id, name, description, start_date, end_date, priority, status, department_id, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const now = new Date();
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
    
    sendResponse(res, createSuccessResponse(result.rows[0]));
  } catch (error) {
    console.error('Create project error:', error);
    sendResponse(res, createErrorResponse('Failed to create project', 'CREATE_ERROR', 500));
  }
});

// GET /projects-service/projects/:id
router.get('/projects/:id', verifyToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;
    
    // Check access and get project
    const projectQuery = `
      SELECT p.*, 
        d.name as department_name,
        pr.full_name as creator_name
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN profiles pr ON p.created_by = pr.id
      WHERE p.id = $1 AND (
        p.created_by = $2 OR
        EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin'::app_role) OR
        EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2) OR
        EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = $1 AND mp.user_id = $2)
      )
    `;
    
    const result = await query(projectQuery, [projectId, userId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Project not found or access denied', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse(result.rows[0]));
  } catch (error) {
    console.error('Get project error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch project', 'FETCH_ERROR', 500));
  }
});

// PUT /projects-service/projects/:id
router.put('/projects/:id', verifyToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;
    const { name, description, startDate, endDate, priority, status } = req.body;
    
    // Check if user can update project (creator or admin)
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin'::app_role)
        )
      ) as can_update
    `;
    
    const accessResult = await query(accessQuery, [projectId, userId]);
    
    if (!accessResult.rows[0].can_update) {
      return sendResponse(res, createErrorResponse('Update access denied', 'FORBIDDEN', 403));
    }
    
    const updateQuery = `
      UPDATE projects 
      SET name = COALESCE($2, name),
          description = COALESCE($3, description),
          start_date = COALESCE($4, start_date),
          end_date = COALESCE($5, end_date),
          priority = COALESCE($6, priority),
          status = COALESCE($7, status),
          updated_at = $8
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      projectId,
      name,
      description,
      startDate,
      endDate,
      priority,
      status,
      new Date()
    ]);
    
    sendResponse(res, createSuccessResponse(result.rows[0]));
  } catch (error) {
    console.error('Update project error:', error);
    sendResponse(res, createErrorResponse('Failed to update project', 'UPDATE_ERROR', 500));
  }
});

// DELETE /projects-service/projects/:id
router.delete('/projects/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    const deleteQuery = 'DELETE FROM projects WHERE id = $1 RETURNING id';
    const result = await query(deleteQuery, [projectId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Project not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Project deleted successfully' }));
  } catch (error) {
    console.error('Delete project error:', error);
    sendResponse(res, createErrorResponse('Failed to delete project', 'DELETE_ERROR', 500));
  }
});

// GET /projects-service/stats
router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
        COUNT(CASE WHEN status = 'planning' THEN 1 END) as planning_projects
      FROM projects
    `;
    
    const result = await query(statsQuery);
    sendResponse(res, createSuccessResponse(result.rows[0]));
  } catch (error) {
    console.error('Get stats error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch statistics', 'STATS_ERROR', 500));
  }
});

module.exports = router;