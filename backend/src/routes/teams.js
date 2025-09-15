const express = require('express');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middleware/auth');
const { sendResponse, createSuccessResponse, createErrorResponse } = require('../utils/responses');

const router = express.Router();

// GET /projects/:projectId/teams - Get all teams for a project
router.get('/projects/:projectId/teams', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    console.log('📋 Fetching teams for project:', projectId, 'User:', userId);

    // Verify user has access to the project
    const projectQuery = `
      SELECT p.id 
      FROM projects p 
      LEFT JOIN project_members pm ON p.id = pm.project_id 
      WHERE p.id = $1 
      AND (p.created_by = $2 OR pm.user_id = $2)
    `;
    const projectResult = await query(projectQuery, [projectId, userId]);
    
    if (projectResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Project not found or access denied', 'PROJECT_NOT_FOUND'), 404);
    }

    // Get teams with member count
    const teamsQuery = `
      SELECT 
        t.*,
        COUNT(tm.id) as member_count
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      WHERE t.project_id = $1
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;
    
    const result = await query(teamsQuery, [projectId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Error fetching teams:', error);
    sendResponse(res, createErrorResponse('Failed to fetch teams', 'DATABASE_ERROR'), 500);
  }
});

// POST /projects/:projectId/teams - Create a new team
router.post('/projects/:projectId/teams', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    console.log('📝 Creating team:', { projectId, name, description, userId });

    if (!name || !name.trim()) {
      return sendResponse(res, createErrorResponse('Team name is required', 'VALIDATION_ERROR'), 400);
    }

    // Verify user has access to the project
    const projectQuery = `
      SELECT p.id 
      FROM projects p 
      LEFT JOIN project_members pm ON p.id = pm.project_id 
      WHERE p.id = $1 
      AND (p.created_by = $2 OR pm.user_id = $2)
    `;
    const projectResult = await query(projectQuery, [projectId, userId]);
    
    if (projectResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Project not found or access denied', 'PROJECT_NOT_FOUND'), 404);
    }

    const teamId = uuidv4();
    const insertQuery = `
      INSERT INTO teams (id, project_id, team_name, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [teamId, projectId, name.trim(), description?.trim() || null, userId]);
    
    sendResponse(res, createSuccessResponse(result.rows[0]));
  } catch (error) {
    console.error('Error creating team:', error);
    
    // Provide more specific error details
    let errorMessage = 'Failed to create team';
    let errorCode = 'DATABASE_ERROR';
    
    if (error.code === '23505') { // Unique constraint violation
      errorMessage = 'Team name already exists in this project';
      errorCode = 'DUPLICATE_TEAM_NAME';
    } else if (error.code === '23503') { // Foreign key constraint violation
      errorMessage = 'Invalid project ID or user reference';
      errorCode = 'INVALID_REFERENCE';
    } else if (error.code === '23502') { // Not null constraint violation
      errorMessage = 'Missing required fields for team creation';
      errorCode = 'MISSING_REQUIRED_FIELDS';
    } else if (error.message) {
      errorMessage = `Failed to create team: ${error.message}`;
    }
    
    sendResponse(res, createErrorResponse(errorMessage, errorCode), 500);
  }
});

// PUT /teams/:teamId - Update a team
router.put('/teams/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    console.log('📝 Updating team:', { teamId, name, description, userId });

    if (!name || !name.trim()) {
      return sendResponse(res, createErrorResponse('Team name is required', 'VALIDATION_ERROR'), 400);
    }

    // Verify user has access to the team
    const accessQuery = `
      SELECT t.id 
      FROM teams t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id 
      WHERE t.id = $1 
      AND (p.created_by = $2 OR pm.user_id = $2)
    `;
    const accessResult = await query(accessQuery, [teamId, userId]);
    
    if (accessResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Team not found or access denied', 'TEAM_NOT_FOUND'), 404);
    }

    const updateQuery = `
      UPDATE teams 
      SET team_name = $1, description = $2, updated_at = now()
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await query(updateQuery, [name.trim(), description?.trim() || null, teamId]);
    
    sendResponse(res, createSuccessResponse(result.rows[0]));
  } catch (error) {
    console.error('Error updating team:', error);
    sendResponse(res, createErrorResponse('Failed to update team', 'DATABASE_ERROR'), 500);
  }
});

// DELETE /teams/:teamId - Delete a team
router.delete('/teams/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    console.log('🗑️ Deleting team:', teamId, 'User:', userId);

    // Verify user has access to the team
    const accessQuery = `
      SELECT t.id 
      FROM teams t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1 
      AND p.created_by = $2
    `;
    const accessResult = await query(accessQuery, [teamId, userId]);
    
    if (accessResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Team not found or access denied', 'TEAM_NOT_FOUND'), 404);
    }

    const deleteQuery = 'DELETE FROM teams WHERE id = $1';
    await query(deleteQuery, [teamId]);
    
    sendResponse(res, createSuccessResponse({ message: 'Team deleted successfully' }));
  } catch (error) {
    console.error('Error deleting team:', error);
    sendResponse(res, createErrorResponse('Failed to delete team', 'DATABASE_ERROR'), 500);
  }
});

// GET /teams/:teamId/members - Get team members
router.get('/teams/:teamId/members', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    console.log('📋 Fetching team members for team:', teamId, 'User:', userId);

    // Verify user has access to the team
    const accessQuery = `
      SELECT t.id 
      FROM teams t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id 
      WHERE t.id = $1 
      AND (p.created_by = $2 OR pm.user_id = $2)
    `;
    const accessResult = await query(accessQuery, [teamId, userId]);
    
    if (accessResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Team not found or access denied', 'TEAM_NOT_FOUND'), 404);
    }

    const membersQuery = `
      SELECT * FROM team_members 
      WHERE team_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await query(membersQuery, [teamId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Error fetching team members:', error);
    sendResponse(res, createErrorResponse('Failed to fetch team members', 'DATABASE_ERROR'), 500);
  }
});

// POST /teams/:teamId/members - Add team member
router.post('/teams/:teamId/members', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { member_name, role, email, skills, work_mode, default_availability_percent } = req.body;
    const userId = req.user.id;

    console.log('📝 Adding team member:', { teamId, member_name, role, email, userId });

    if (!member_name || !member_name.trim()) {
      return sendResponse(res, createErrorResponse('Member name is required', 'VALIDATION_ERROR'), 400);
    }

    // Verify user has access to the team
    const accessQuery = `
      SELECT t.id 
      FROM teams t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id 
      WHERE t.id = $1 
      AND (p.created_by = $2 OR pm.user_id = $2)
    `;
    const accessResult = await query(accessQuery, [teamId, userId]);
    
    if (accessResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Team not found or access denied', 'TEAM_NOT_FOUND'), 404);
    }

    const memberId = uuidv4();
    const insertQuery = `
      INSERT INTO team_members (
        id, team_id, member_name, role, email, skills, work_mode, 
        default_availability_percent, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      memberId,
      teamId,
      member_name.trim(),
      role?.trim() || null,
      email?.trim() || null,
      skills || [],
      work_mode || 'office',
      default_availability_percent || 100,
      userId
    ]);
    
    sendResponse(res, createSuccessResponse(result.rows[0]));
  } catch (error) {
    console.error('Error adding team member:', error);
    sendResponse(res, createErrorResponse('Failed to add team member', 'DATABASE_ERROR'), 500);
  }
});

// PUT /team-members/:memberId - Update team member
router.put('/team-members/:memberId', verifyToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { member_name, role, email, skills, work_mode, default_availability_percent } = req.body;
    const userId = req.user.id;

    console.log('📝 Updating team member:', { memberId, member_name, role, userId });

    if (!member_name || !member_name.trim()) {
      return sendResponse(res, createErrorResponse('Member name is required', 'VALIDATION_ERROR'), 400);
    }

    // Verify user has access to the team member
    const accessQuery = `
      SELECT tm.id 
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id 
      WHERE tm.id = $1 
      AND (p.created_by = $2 OR pm.user_id = $2)
    `;
    const accessResult = await query(accessQuery, [memberId, userId]);
    
    if (accessResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Team member not found or access denied', 'MEMBER_NOT_FOUND'), 404);
    }

    const updateQuery = `
      UPDATE team_members 
      SET 
        member_name = $1, 
        role = $2, 
        email = $3, 
        skills = $4, 
        work_mode = $5,
        default_availability_percent = $6,
        updated_at = now()
      WHERE id = $7
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      member_name.trim(),
      role?.trim() || null,
      email?.trim() || null,
      skills || [],
      work_mode || 'office',
      default_availability_percent || 100,
      memberId
    ]);
    
    sendResponse(res, createSuccessResponse(result.rows[0]));
  } catch (error) {
    console.error('Error updating team member:', error);
    sendResponse(res, createErrorResponse('Failed to update team member', 'DATABASE_ERROR'), 500);
  }
});

// DELETE /team-members/:memberId - Delete team member
router.delete('/team-members/:memberId', verifyToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const userId = req.user.id;

    console.log('🗑️ Deleting team member:', memberId, 'User:', userId);

    // Verify user has access to the team member
    const accessQuery = `
      SELECT tm.id 
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id 
      WHERE tm.id = $1 
      AND (p.created_by = $2 OR pm.user_id = $2)
    `;
    const accessResult = await query(accessQuery, [memberId, userId]);
    
    if (accessResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Team member not found or access denied', 'MEMBER_NOT_FOUND'), 404);
    }

    const deleteQuery = 'DELETE FROM team_members WHERE id = $1';
    await query(deleteQuery, [memberId]);
    
    sendResponse(res, createSuccessResponse({ message: 'Team member removed successfully' }));
  } catch (error) {
    console.error('Error deleting team member:', error);
    sendResponse(res, createErrorResponse('Failed to remove team member', 'DATABASE_ERROR'), 500);
  }
});

// GET /teams/:teamId - Fetch team details
router.get('/teams/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const teamRes = await query(`
      SELECT t.*
      FROM teams t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE t.id = $1 AND (p.created_by = $2 OR pm.user_id = $2)
    `, [teamId, userId]);

    if (teamRes.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Team not found or access denied', 'TEAM_NOT_FOUND'), 404);
    }

    sendResponse(res, createSuccessResponse(teamRes.rows[0]));
  } catch (error) {
    console.error('Error fetching team:', error);
    sendResponse(res, createErrorResponse('Failed to fetch team', 'DATABASE_ERROR'), 500);
  }
});

module.exports = router;