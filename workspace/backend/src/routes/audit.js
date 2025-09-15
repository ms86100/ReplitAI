const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyProjectAccess } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /audit-service/projects/:id/history
router.get('/projects/:id/history', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const { limit = 50, offset = 0 } = req.query;
    
    const auditQuery = `
      SELECT al.*, p.full_name as user_name
      FROM audit_log al
      LEFT JOIN profiles p ON al.user_id = p.id
      WHERE al.project_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await query(auditQuery, [projectId, parseInt(limit), parseInt(offset)]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get project history error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch project history', 'FETCH_ERROR', 500));
  }
});

// POST /audit-service/audit/log
router.post('/audit/log', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, module, action, entity_type, entity_id, old_values, new_values, description } = req.body;
    
    if (!projectId || !module || !action) {
      return sendResponse(res, createErrorResponse('Project ID, module, and action required', 'MISSING_FIELDS', 400));
    }

    // Verify user has access to project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin'::app_role) OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = $1 AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [projectId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Project access denied', 'FORBIDDEN', 403));
    }

    const logId = uuidv4();
    
    const insertQuery = `
      INSERT INTO audit_log (id, project_id, user_id, module, action, entity_type, entity_id, old_values, new_values, description, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      logId,
      projectId,
      userId,
      module,
      action,
      entity_type || null,
      entity_id || null,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      description || null,
      new Date()
    ]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Audit log entry created successfully',
      entry: result.rows[0]
    }));
  } catch (error) {
    console.error('Create audit log error:', error);
    sendResponse(res, createErrorResponse('Failed to create audit log entry', 'CREATE_ERROR', 500));
  }
});

// GET /audit-service/projects/:id/logs (alternative endpoint)
router.get('/projects/:id/logs', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const { module, action, limit = 100 } = req.query;
    
    let auditQuery = `
      SELECT al.*, p.full_name as user_name
      FROM audit_log al
      LEFT JOIN profiles p ON al.user_id = p.id
      WHERE al.project_id = $1
    `;
    
    const queryParams = [projectId];
    
    if (module) {
      auditQuery += ` AND al.module = $${queryParams.length + 1}`;
      queryParams.push(module);
    }
    
    if (action) {
      auditQuery += ` AND al.action = $${queryParams.length + 1}`;
      queryParams.push(action);
    }
    
    auditQuery += ` ORDER BY al.created_at DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(parseInt(limit));
    
    const result = await query(auditQuery, queryParams);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get audit logs error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch audit logs', 'FETCH_ERROR', 500));
  }
});

module.exports = router;