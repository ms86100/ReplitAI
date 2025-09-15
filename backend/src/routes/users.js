const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /:id/role (getUserRole method)
router.get('/:id/role', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Allow users to get their own role or admin to get any role
    if (req.user.id !== id) {
      const adminResult = await query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2::app_role',
        [req.user.id, 'admin']
      );
      
      if (adminResult.rows.length === 0) {
        return sendResponse(res, createErrorResponse('Access denied', 'FORBIDDEN', 403));
      }
    }
    
    const roleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [id]
    );

    if (roleResult.rows.length === 0) {
      return sendResponse(res, createSuccessResponse({ role: null }));
    }

    sendResponse(res, createSuccessResponse({ role: roleResult.rows[0].role }));
  } catch (error) {
    console.error('Get user role error:', error);
    sendResponse(res, createErrorResponse('Failed to get user role', 'GET_ROLE_ERROR', 500));
  }
});

module.exports = router;