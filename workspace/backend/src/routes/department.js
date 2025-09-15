const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /department-service/departments
router.get('/departments', verifyToken, async (req, res) => {
  try {
    const departmentsQuery = `
      SELECT id, name, created_at, updated_at
      FROM departments
      ORDER BY name
    `;
    
    const result = await query(departmentsQuery);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get departments error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch departments', 'FETCH_ERROR', 500));
  }
});

// POST /department-service/departments
router.post('/departments', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return sendResponse(res, createErrorResponse('Department name required', 'MISSING_FIELDS', 400));
    }

    const departmentId = uuidv4();
    const now = new Date();
    
    const insertQuery = `
      INSERT INTO departments (id, name, created_at, updated_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [departmentId, name, now, now]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Department created successfully',
      department: result.rows[0]
    }));
  } catch (error) {
    console.error('Create department error:', error);
    if (error.code === '23505') {
      sendResponse(res, createErrorResponse('Department name already exists', 'DUPLICATE_NAME', 400));
    } else {
      sendResponse(res, createErrorResponse('Failed to create department', 'CREATE_ERROR', 500));
    }
  }
});

// DELETE /department-service/departments/:id
router.delete('/departments/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const departmentId = req.params.id;
    
    const deleteQuery = 'DELETE FROM departments WHERE id = $1 RETURNING id';
    const result = await query(deleteQuery, [departmentId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Department not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Department deleted successfully' }));
  } catch (error) {
    console.error('Delete department error:', error);
    if (error.code === '23503') {
      sendResponse(res, createErrorResponse('Cannot delete department with existing references', 'FOREIGN_KEY_VIOLATION', 400));
    } else {
      sendResponse(res, createErrorResponse('Failed to delete department', 'DELETE_ERROR', 500));
    }
  }
});

module.exports = router;