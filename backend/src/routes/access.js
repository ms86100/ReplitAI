const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyProjectAccess } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /access-service/projects/:id/access
router.get('/projects/:id/access', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    const permissionsQuery = `
      SELECT mp.*, 
        p.email, p.full_name,
        gb.email as granted_by_email, gb.full_name as granted_by_name
      FROM module_permissions mp
      JOIN profiles p ON mp.user_id = p.id
      LEFT JOIN profiles gb ON mp.granted_by = gb.id
      WHERE mp.project_id = $1
      ORDER BY p.full_name, mp.module
    `;
    
    const result = await query(permissionsQuery, [projectId]);
    
    sendResponse(res, createSuccessResponse({
      projectId,
      permissions: result.rows
    }));
  } catch (error) {
    console.error('Get project access error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch project access', 'FETCH_ERROR', 500));
  }
});

// POST /access-service/projects/:id/access
router.post('/projects/:id/access', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const userId = req.user.id;
    const { userEmail, module, accessLevel } = req.body;
    
    if (!userEmail || !module || !accessLevel) {
      return sendResponse(res, createErrorResponse('User email, module, and access level required', 'MISSING_FIELDS', 400));
    }

    // Find user by email
    const userResult = await query('SELECT id FROM profiles WHERE email = $1', [userEmail.toLowerCase()]);
    
    if (userResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('User not found', 'USER_NOT_FOUND', 404));
    }
    
    const targetUserId = userResult.rows[0].id;
    
    // Check if permission already exists
    const existingResult = await query(
      'SELECT id FROM module_permissions WHERE project_id = $1 AND user_id = $2 AND module = $3',
      [projectId, targetUserId, module]
    );
    
    if (existingResult.rows.length > 0) {
      // Update existing permission
      const updateResult = await query(`
        UPDATE module_permissions 
        SET access_level = $1, granted_by = $2, updated_at = $3
        WHERE project_id = $4 AND user_id = $5 AND module = $6
        RETURNING *
      `, [accessLevel, userId, new Date(), projectId, targetUserId, module]);
      
      sendResponse(res, createSuccessResponse({
        message: 'Permission updated successfully',
        permission: updateResult.rows[0]
      }));
    } else {
      // Create new permission
      const permissionId = uuidv4();
      const now = new Date();
      
      const insertResult = await query(`
        INSERT INTO module_permissions (id, project_id, user_id, module, access_level, granted_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [permissionId, projectId, targetUserId, module, accessLevel, userId, now, now]);
      
      sendResponse(res, createSuccessResponse({
        message: 'Permission granted successfully',
        permission: insertResult.rows[0]
      }));
    }
  } catch (error) {
    console.error('Grant access error:', error);
    sendResponse(res, createErrorResponse('Failed to grant access', 'GRANT_ERROR', 500));
  }
});

// PUT /access-service/projects/:id/access/:userId
router.put('/projects/:id/access/:userId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const targetUserId = req.params.userId;
    const grantedBy = req.user.id;
    const { module, accessLevel } = req.body;
    
    if (!module || !accessLevel) {
      return sendResponse(res, createErrorResponse('Module and access level required', 'MISSING_FIELDS', 400));
    }

    const updateQuery = `
      UPDATE module_permissions 
      SET access_level = $1, granted_by = $2, updated_at = $3
      WHERE project_id = $4 AND user_id = $5 AND module = $6
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      accessLevel,
      grantedBy,
      new Date(),
      projectId,
      targetUserId,
      module
    ]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Permission not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({
      message: 'Permission updated successfully',
      permission: result.rows[0]
    }));
  } catch (error) {
    console.error('Update permission error:', error);
    sendResponse(res, createErrorResponse('Failed to update permission', 'UPDATE_ERROR', 500));
  }
});

// DELETE /access-service/projects/:id/access/:userId
router.delete('/projects/:id/access/:userId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const targetUserId = req.params.userId;
    const { module } = req.query;
    
    let deleteQuery = 'DELETE FROM module_permissions WHERE project_id = $1 AND user_id = $2';
    let queryParams = [projectId, targetUserId];
    
    if (module) {
      deleteQuery += ' AND module = $3';
      queryParams.push(module);
    }
    
    deleteQuery += ' RETURNING id';
    
    const result = await query(deleteQuery, queryParams);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Permission not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Permission revoked successfully' }));
  } catch (error) {
    console.error('Revoke permission error:', error);
    sendResponse(res, createErrorResponse('Failed to revoke permission', 'REVOKE_ERROR', 500));
  }
});

// GET /access-service/permissions
router.get('/permissions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const permissionsQuery = `
      SELECT mp.*, p.name as project_name
      FROM module_permissions mp
      JOIN projects p ON mp.project_id = p.id
      WHERE mp.user_id = $1
      ORDER BY p.name, mp.module
    `;
    
    const result = await query(permissionsQuery, [userId]);
    
    sendResponse(res, createSuccessResponse({ permissions: result.rows }));
  } catch (error) {
    console.error('Get user permissions error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch permissions', 'FETCH_ERROR', 500));
  }
});

// POST /access-service/log-access
router.post('/log-access', verifyToken, async (req, res) => {
  try {
    const { userId, projectId, module, accessType, accessLevel } = req.body;
    const id = uuidv4();
    const now = new Date();

    try {
      await query(
        `INSERT INTO module_access_audit (id, user_id, project_id, module, access_type, access_level, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, userId || req.user.id, projectId || req.body.project_id, module, accessType, accessLevel || null, now]
      );
    } catch (dbErr) {
      console.warn('Log access insert failed, continuing:', dbErr.message);
    }

    sendResponse(res, createSuccessResponse({ message: 'Access logged' }));
  } catch (error) {
    console.error('Log access error:', error);
    sendResponse(res, createErrorResponse('Failed to log access', 'LOG_ERROR', 500));
  }
});

module.exports = router;