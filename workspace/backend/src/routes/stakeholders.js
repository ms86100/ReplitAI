const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyProjectAccess } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /stakeholder-service/projects/:id/stakeholders
router.get('/projects/:id/stakeholders', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    const stakeholdersQuery = `
      SELECT s.*, pr.full_name as created_by_name
      FROM stakeholders s
      LEFT JOIN profiles pr ON s.created_by = pr.id
      WHERE s.project_id = $1
      ORDER BY s.name
    `;
    
    const result = await query(stakeholdersQuery, [projectId]);
    
    sendResponse(res, createSuccessResponse({
      projectId,
      stakeholders: result.rows
    }));
  } catch (error) {
    console.error('Get stakeholders error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch stakeholders', 'FETCH_ERROR', 500));
  }
});

// POST /stakeholder-service/projects/:id/stakeholders
router.post('/projects/:id/stakeholders', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const userId = req.user.id;
    const { name, email, department, raci, influence_level, notes } = req.body;
    
    if (!name) {
      return sendResponse(res, createErrorResponse('Stakeholder name required', 'MISSING_FIELDS', 400));
    }

    const stakeholderId = uuidv4();
    
    const insertQuery = `
      INSERT INTO stakeholders (id, project_id, name, email, department, raci, influence_level, notes, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const now = new Date();
    const result = await query(insertQuery, [
      stakeholderId,
      projectId,
      name,
      email || null,
      department || null,
      raci || null,
      influence_level || null,
      notes || null,
      userId,
      now,
      now
    ]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Stakeholder created successfully',
      stakeholder: result.rows[0]
    }));
  } catch (error) {
    console.error('Create stakeholder error:', error);
    sendResponse(res, createErrorResponse('Failed to create stakeholder', 'CREATE_ERROR', 500));
  }
});

// PUT /stakeholder-service/projects/:id/stakeholders/:stakeholderId
router.put('/projects/:id/stakeholders/:stakeholderId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const stakeholderId = req.params.stakeholderId;
    const { name, email, department, raci, influence_level, notes } = req.body;
    
    const updateQuery = `
      UPDATE stakeholders 
      SET name = COALESCE($3, name),
          email = COALESCE($4, email),
          department = COALESCE($5, department),
          raci = COALESCE($6, raci),
          influence_level = COALESCE($7, influence_level),
          notes = COALESCE($8, notes),
          updated_at = $9
      WHERE id = $1 AND project_id = $2
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      stakeholderId,
      projectId,
      name,
      email,
      department,
      raci,
      influence_level,
      notes,
      new Date()
    ]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Stakeholder not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({
      message: 'Stakeholder updated successfully',
      stakeholder: result.rows[0]
    }));
  } catch (error) {
    console.error('Update stakeholder error:', error);
    sendResponse(res, createErrorResponse('Failed to update stakeholder', 'UPDATE_ERROR', 500));
  }
});

// DELETE /stakeholder-service/projects/:id/stakeholders/:stakeholderId
router.delete('/projects/:id/stakeholders/:stakeholderId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const stakeholderId = req.params.stakeholderId;
    
    const deleteQuery = 'DELETE FROM stakeholders WHERE id = $1 AND project_id = $2 RETURNING id';
    const result = await query(deleteQuery, [stakeholderId, projectId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Stakeholder not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Stakeholder deleted successfully' }));
  } catch (error) {
    console.error('Delete stakeholder error:', error);
    sendResponse(res, createErrorResponse('Failed to delete stakeholder', 'DELETE_ERROR', 500));
  }
});

module.exports = router;