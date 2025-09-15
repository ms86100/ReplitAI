const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyProjectAccess, verifyAdmin } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /capacity-service/projects/:id/capacity
router.get('/projects/:id/capacity', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    // Get iterations
    const iterationsQuery = `
      SELECT tci.*, pr.full_name as created_by_name
      FROM team_capacity_iterations tci
      LEFT JOIN profiles pr ON tci.created_by = pr.id
      WHERE tci.project_id = $1
      ORDER BY tci.start_date DESC
    `;
    
    const iterationsResult = await query(iterationsQuery, [projectId]);
    const iterations = iterationsResult.rows;
    
    // Get members for all iterations
    const iterationIds = iterations.map(i => i.id);
    let members = [];
    
    if (iterationIds.length > 0) {
      const membersQuery = `
        SELECT tcm.*, pr.full_name as created_by_name, s.name as stakeholder_name
        FROM team_capacity_members tcm
        LEFT JOIN profiles pr ON tcm.created_by = pr.id
        LEFT JOIN stakeholders s ON tcm.stakeholder_id = s.id
        WHERE tcm.iteration_id = ANY($1::uuid[])
        ORDER BY tcm.member_name
      `;
      
      const membersResult = await query(membersQuery, [iterationIds]);
      members = membersResult.rows;
    }
    
    // Calculate summary
    const totalCapacity = members.reduce((sum, member) => sum + (member.effective_capacity_days || 0), 0);
    
    sendResponse(res, createSuccessResponse({
      projectId,
      iterations,
      members,
      summary: {
        totalIterations: iterations.length,
        totalCapacity: Math.round(totalCapacity * 10) / 10
      }
    }));
  } catch (error) {
    console.error('Get capacity error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch capacity data', 'FETCH_ERROR', 500));
  }
});

// POST /capacity-service/projects/:id/capacity
router.post('/projects/:id/capacity', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const userId = req.user.id;
    
    console.log('🔍 Capacity creation request:', {
      projectId,
      userId,
      body: req.body
    });
    
    const { type, ...data } = req.body;
    
    if (type === 'iteration') {
      const { iterationName, startDate, endDate, workingDays, committedStoryPoints } = data;
      
      if (!iterationName || !startDate || !endDate || !workingDays) {
        console.error('❌ Missing iteration fields:', { iterationName, startDate, endDate, workingDays });
        return sendResponse(res, createErrorResponse('Iteration name, dates, and working days are required', 'MISSING_FIELDS', 400));
      }

      const iterationId = uuidv4();
      const now = new Date();
      
      console.log('📝 Creating iteration:', {
        iterationId, projectId, iterationName, startDate, endDate, workingDays, committedStoryPoints
      });
      
      const insertQuery = `
        INSERT INTO team_capacity_iterations (id, project_id, team_id, iteration_name, start_date, end_date, working_days, committed_story_points, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        iterationId,
        projectId,
        data.teamId || null,  // Add the team_id to the database
        iterationName,
        startDate,
        endDate,
        workingDays,
        committedStoryPoints || 0,
        userId,
        now,
        now
      ]);
      
      console.log('✅ Iteration created successfully with team_id:', result.rows[0].team_id);
      
      sendResponse(res, createSuccessResponse({
        message: 'Capacity iteration created successfully',
        iteration: result.rows[0]
      }));
      
    } else if (type === 'member') {
      const { iterationId, memberName, role, workMode, availabilityPercent, leaves, stakeholderId, teamId } = data;
      
      if (!iterationId || !memberName || !role) {
        console.error('❌ Missing member fields:', { iterationId, memberName, role });
        return sendResponse(res, createErrorResponse('Iteration ID, member name, and role are required', 'MISSING_FIELDS', 400));
      }

      // Calculate effective capacity
      const iterationResult = await query('SELECT working_days FROM team_capacity_iterations WHERE id = $1', [iterationId]);
      
      if (iterationResult.rows.length === 0) {
        console.error('❌ Iteration not found:', iterationId);
        return sendResponse(res, createErrorResponse('Iteration not found', 'ITERATION_NOT_FOUND', 404));
      }
      
      const workingDays = iterationResult.rows[0].working_days;
      const effectiveCapacity = (workingDays - (leaves || 0)) * ((availabilityPercent || 100) / 100);
      
      const memberId = uuidv4();
      const now = new Date();
      
      console.log('📝 Creating team member:', {
        memberId, iterationId, memberName, role, workMode, 
        availabilityPercent, leaves, effectiveCapacity, stakeholderId, teamId
      });
      
      const insertQuery = `
        INSERT INTO team_capacity_members (id, iteration_id, stakeholder_id, team_id, member_name, role, work_mode, leaves, availability_percent, effective_capacity_days, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        memberId,
        iterationId,
        stakeholderId || null,
        teamId || null,
        memberName,
        role,
        workMode || 'office',
        leaves || 0,
        availabilityPercent || 100,
        effectiveCapacity,
        userId,
        now,
        now
      ]);
      
      console.log('✅ Team member added successfully:', result.rows[0]);
      
      sendResponse(res, createSuccessResponse({
        message: 'Team member added successfully',
        member: result.rows[0]
      }));
      
    } else {
      console.error('❌ Invalid type provided:', type);
      sendResponse(res, createErrorResponse('Invalid type. Must be "iteration" or "member"', 'INVALID_TYPE', 400));
    }
  } catch (error) {
    console.error('🔥 Create capacity item error:', {
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
      `Failed to create capacity item: ${errorMessage}`, 
      errorCode, 
      500
    ));
  }
});

// PUT /capacity-service/projects/:id/capacity/:itemId
router.put('/projects/:id/capacity/:itemId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const itemId = req.params.itemId;
    const { type, ...updateData } = req.body;
    
    if (type === 'iteration') {
      const { iterationName, startDate, endDate, workingDays, committedStoryPoints } = updateData;
      
      const updateQuery = `
        UPDATE team_capacity_iterations 
        SET iteration_name = COALESCE($2, iteration_name),
            start_date = COALESCE($3, start_date),
            end_date = COALESCE($4, end_date),
            working_days = COALESCE($5, working_days),
            committed_story_points = COALESCE($6, committed_story_points),
            updated_at = $7
        WHERE id = $1 AND project_id = $8
        RETURNING *
      `;
      
      const result = await query(updateQuery, [
        itemId,
        iterationName,
        startDate,
        endDate,
        workingDays,
        committedStoryPoints,
        new Date(),
        projectId
      ]);
      
      if (result.rows.length === 0) {
        return sendResponse(res, createErrorResponse('Iteration not found', 'NOT_FOUND', 404));
      }
      
      sendResponse(res, createSuccessResponse({
        message: 'Iteration updated successfully',
        iteration: result.rows[0]
      }));
    } else if (type === 'member') {
      const { memberName, role, workMode, availabilityPercent, leaves } = updateData;
      
      // Recalculate effective capacity if working days changed
      let effectiveCapacity = null;
      if (availabilityPercent !== undefined || leaves !== undefined) {
        const memberResult = await query(`
          SELECT tcm.*, tci.working_days
          FROM team_capacity_members tcm
          JOIN team_capacity_iterations tci ON tcm.iteration_id = tci.id
          WHERE tcm.id = $1
        `, [itemId]);
        
        if (memberResult.rows.length > 0) {
          const member = memberResult.rows[0];
          const workingDays = member.working_days;
          const newLeaves = leaves !== undefined ? leaves : member.leaves;
          const newAvailability = availabilityPercent !== undefined ? availabilityPercent : member.availability_percent;
          effectiveCapacity = (workingDays - newLeaves) * (newAvailability / 100);
        }
      }
      
      const updateQuery = `
        UPDATE team_capacity_members 
        SET member_name = COALESCE($2, member_name),
            role = COALESCE($3, role),
            work_mode = COALESCE($4, work_mode),
            availability_percent = COALESCE($5, availability_percent),
            leaves = COALESCE($6, leaves),
            effective_capacity_days = COALESCE($7, effective_capacity_days),
            updated_at = $8
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await query(updateQuery, [
        itemId,
        memberName,
        role,
        workMode,
        availabilityPercent,
        leaves,
        effectiveCapacity,
        new Date()
      ]);
      
      if (result.rows.length === 0) {
        return sendResponse(res, createErrorResponse('Team member not found', 'NOT_FOUND', 404));
      }
      
      sendResponse(res, createSuccessResponse({
        message: 'Team member updated successfully',
        member: result.rows[0]
      }));
    } else {
      sendResponse(res, createErrorResponse('Invalid type. Must be "iteration" or "member"', 'INVALID_TYPE', 400));
    }
  } catch (error) {
    console.error('Update capacity item error:', error);
    sendResponse(res, createErrorResponse('Failed to update capacity item', 'UPDATE_ERROR', 500));
  }
});

// DELETE /capacity-service/projects/:id/capacity/:itemId
router.delete('/projects/:id/capacity/:itemId', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const itemId = req.params.itemId;
    const { type } = req.query;
    
    if (type === 'iteration') {
      const deleteQuery = 'DELETE FROM team_capacity_iterations WHERE id = $1 AND project_id = $2 RETURNING id';
      const result = await query(deleteQuery, [itemId, projectId]);
      
      if (result.rows.length === 0) {
        return sendResponse(res, createErrorResponse('Iteration not found', 'NOT_FOUND', 404));
      }
      
      sendResponse(res, createSuccessResponse({ message: 'Iteration deleted successfully' }));
    } else if (type === 'member') {
      const deleteQuery = 'DELETE FROM team_capacity_members WHERE id = $1 RETURNING id';
      const result = await query(deleteQuery, [itemId]);
      
      if (result.rows.length === 0) {
        return sendResponse(res, createErrorResponse('Team member not found', 'NOT_FOUND', 404));
      }
      
      sendResponse(res, createSuccessResponse({ message: 'Team member deleted successfully' }));
    } else {
      sendResponse(res, createErrorResponse('Type parameter required (iteration or member)', 'MISSING_TYPE', 400));
    }
  } catch (error) {
    console.error('Delete capacity item error:', error);
    sendResponse(res, createErrorResponse('Failed to delete capacity item', 'DELETE_ERROR', 500));
  }
});

// GET /capacity-service/stats
router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM team_capacity_iterations) as total_iterations,
        (SELECT COUNT(*) FROM team_capacity_members) as total_members,
        (SELECT AVG(effective_capacity_days) FROM team_capacity_members) as avg_capacity,
        (SELECT COUNT(DISTINCT project_id) FROM team_capacity_iterations) as total_projects
    `;
    
    const result = await query(statsQuery);
    const stats = result.rows[0];
    
    sendResponse(res, createSuccessResponse({
      totalIterations: parseInt(stats.total_iterations),
      totalMembers: parseInt(stats.total_members),
      avgCapacity: parseFloat(stats.avg_capacity) || 0,
      totalProjects: parseInt(stats.total_projects)
    }));
  } catch (error) {
    console.error('Get capacity stats error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch capacity statistics', 'STATS_ERROR', 500));
  }
});

// POST /capacity-service/iterations/:iterationId/availability
router.post('/iterations/:iterationId/availability', verifyToken, async (req, res) => {
  try {
    const { iterationId } = req.params;
    const userId = req.user.id;
    const availability = Array.isArray(req.body?.availability) ? req.body.availability : [];

    if (availability.length === 0) {
      return sendResponse(res, createErrorResponse('No availability data provided', 'INVALID_PAYLOAD', 400));
    }

    // Ensure storage table exists (local backend convenience)
    await query(`
      CREATE TABLE IF NOT EXISTS public.team_member_weekly_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        iteration_id UUID NOT NULL REFERENCES public.team_capacity_iterations(id) ON DELETE CASCADE,
        week_index INT NOT NULL,
        team_member_id VARCHAR(255) NOT NULL,
        availability_percent INT NOT NULL DEFAULT 100,
        days_present INT NOT NULL DEFAULT 0,
        days_total INT NOT NULL DEFAULT 5,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(iteration_id, week_index, team_member_id)
      );
    `);

    // Verify access by resolving project_id from iteration
    const iterRes = await query('SELECT project_id FROM public.team_capacity_iterations WHERE id = $1', [iterationId]);
    if (iterRes.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Iteration not found', 'ITERATION_NOT_FOUND', 404));
    }
    const projectId = iterRes.rows[0].project_id;

    const accessRes = await query(`
      SELECT EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = $1 AND mp.user_id = $2)
        )
      ) AS has_access
    `, [projectId, userId]);

    if (!accessRes.rows[0]?.has_access) {
      return sendResponse(res, createErrorResponse('Project access denied', 'FORBIDDEN', 403));
    }

    let upserts = 0;
    for (const item of availability) {
      const weekId = String(item.iteration_week_id || '');
      const match = /week-(\d+)/.exec(weekId);
      const weekIndex = match ? parseInt(match[1], 10) : 1;
      const percent = Math.max(0, Math.min(100, parseInt(item.availability_percent ?? 0)));
      const daysPresent = Number.isFinite(item.calculated_days_present) ? item.calculated_days_present : Math.round((percent / 100) * 5);
      const daysTotal = Number.isFinite(item.calculated_days_total) ? item.calculated_days_total : 5;

      await query(`
        INSERT INTO public.team_member_weekly_availability 
          (iteration_id, week_index, team_member_id, availability_percent, days_present, days_total, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (iteration_id, week_index, team_member_id)
        DO UPDATE SET 
          availability_percent = EXCLUDED.availability_percent,
          days_present = EXCLUDED.days_present,
          days_total = EXCLUDED.days_total,
          updated_at = now()
      `, [iterationId, weekIndex, item.team_member_id, percent, daysPresent, daysTotal, userId]);
      upserts++;
    }

    return sendResponse(res, createSuccessResponse({ message: 'Availability saved', updated: upserts }));
  } catch (error) {
    console.error('Save weekly availability error:', error);
    return sendResponse(res, createErrorResponse('Failed to save weekly availability', 'SAVE_ERROR', 500));
  }
});

// GET /capacity-service/availability/:availabilityId/daily
router.get('/availability/:availabilityId/daily', verifyToken, async (req, res) => {
  try {
    const { availabilityId } = req.params;
    
    // Create table if not exists
    await query(`
      CREATE TABLE IF NOT EXISTS public.daily_attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        availability_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        day_of_week VARCHAR(20) NOT NULL,
        status CHAR(1) NOT NULL CHECK (status IN ('P', 'A')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(availability_id, date)
      );
    `);
    
    const attendanceResult = await query(
      'SELECT date, day_of_week, status FROM public.daily_attendance WHERE availability_id = $1 ORDER BY date',
      [availabilityId]
    );
    
    sendResponse(res, createSuccessResponse(attendanceResult.rows));
  } catch (error) {
    console.error('Get daily attendance error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch daily attendance', 'FETCH_ERROR', 500));
  }
});

// POST /capacity-service/members/:memberId/weeks/:weekId/attendance
router.post('/members/:memberId/weeks/:weekId/attendance', verifyToken, async (req, res) => {
  try {
    const { memberId, weekId } = req.params;
    const { attendance } = req.body;
    
    if (!Array.isArray(attendance)) {
      return sendResponse(res, createErrorResponse('Attendance data must be an array', 'INVALID_DATA', 400));
    }
    
    // Create table if not exists
    await query(`
      CREATE TABLE IF NOT EXISTS public.daily_attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        availability_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        day_of_week VARCHAR(20) NOT NULL,
        status CHAR(1) NOT NULL CHECK (status IN ('P', 'A')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(availability_id, date)
      );
    `);
    
    // Use a combined key for availability_id
    const availabilityId = `${memberId}-${weekId}`;
    
    // Delete existing attendance for this member and week
    await query('DELETE FROM public.daily_attendance WHERE availability_id = $1', [availabilityId]);
    
    // Insert new attendance records
    for (const record of attendance) {
      await query(`
        INSERT INTO public.daily_attendance (availability_id, date, day_of_week, status)
        VALUES ($1, $2, $3, $4)
      `, [availabilityId, record.date, record.day_of_week, record.status]);
    }
    
    sendResponse(res, createSuccessResponse({ 
      message: 'Daily attendance saved successfully',
      records: attendance.length 
    }));
  } catch (error) {
    console.error('Save daily attendance error:', error);
    sendResponse(res, createErrorResponse('Failed to save daily attendance', 'SAVE_ERROR', 500));
  }
});

// GET /capacity-service/iterations/:iterationId/availability
router.get('/iterations/:iterationId/availability', verifyToken, async (req, res) => {
  try {
    const { iterationId } = req.params;

    // Ensure storage table exists (local backend convenience)
    await query(`
      CREATE TABLE IF NOT EXISTS public.team_member_weekly_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        iteration_id UUID NOT NULL REFERENCES public.team_capacity_iterations(id) ON DELETE CASCADE,
        week_index INT NOT NULL,
        team_member_id VARCHAR(255) NOT NULL,
        availability_percent INT NOT NULL DEFAULT 100,
        days_present INT NOT NULL DEFAULT 0,
        days_total INT NOT NULL DEFAULT 5,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(iteration_id, week_index, team_member_id)
      );
    `);

    const rowsRes = await query(
      `SELECT iteration_id, week_index, team_member_id, availability_percent, days_present, days_total
       FROM public.team_member_weekly_availability
       WHERE iteration_id = $1
       ORDER BY week_index ASC`,
      [iterationId]
    );

    return sendResponse(res, createSuccessResponse(rowsRes.rows));
  } catch (error) {
    console.error('Fetch weekly availability error:', error);
    return sendResponse(res, createErrorResponse('Failed to fetch weekly availability', 'FETCH_ERROR', 500));
  }
});

// Additional helper endpoints for UI compatibility

// GET /capacity-service/projects/:id/settings
router.get('/projects/:id/settings', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    // Return sensible defaults; can be extended to fetch from DB later
    sendResponse(res, createSuccessResponse({
      workModeWeights: { office: 1.0, wfh: 0.9, hybrid: 0.95 },
      defaultWorkingDays: 5,
      defaultAvailability: 100,
    }));
  } catch (error) {
    sendResponse(res, createErrorResponse('Failed to load capacity settings', 'SETTINGS_ERROR', 500));
  }
});

// GET /capacity-service/projects/:id/iterations
router.get('/projects/:id/iterations', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const result = await query(`
      SELECT tci.*, t.team_name
      FROM team_capacity_iterations tci
      LEFT JOIN teams t ON t.id = tci.team_id
      WHERE tci.project_id = $1
      ORDER BY tci.start_date DESC NULLS LAST, tci.created_at DESC
    `, [projectId]);

    const iterations = result.rows.map((r) => {
      let weeks_count = 0;
      if (r.start_date && r.end_date) {
        const start = new Date(r.start_date);
        const end = new Date(r.end_date);
        const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
        weeks_count = Math.max(1, Math.ceil(diffDays / 7));
      }
      return { ...r, weeks_count };
    });

    sendResponse(res, createSuccessResponse(iterations));
  } catch (error) {
    console.error('Get iterations error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch iterations', 'FETCH_ERROR', 500));
  }
});

// DELETE /capacity-service/capacity/:itemId?type=iteration|member
router.delete('/capacity/:itemId', verifyToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { type } = req.query;
    const userId = req.user.id;

    if (!type) return sendResponse(res, createErrorResponse('Type parameter required', 'MISSING_TYPE', 400));

    if (type === 'iteration') {
      // Resolve project for access check
      const iterRes = await query('SELECT project_id FROM team_capacity_iterations WHERE id = $1', [itemId]);
      if (iterRes.rows.length === 0) return sendResponse(res, createErrorResponse('Iteration not found', 'NOT_FOUND', 404));
      const projectId = iterRes.rows[0].project_id;

      // Access check (same as other endpoints)
      const accessRes = await query(`
        SELECT EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = $1 AND (
            p.created_by = $2 OR
            EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin'::app_role) OR
            EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2) OR
            EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = $1 AND mp.user_id = $2)
          )
        ) AS has_access
      `, [projectId, userId]);
      if (!accessRes.rows[0]?.has_access) return sendResponse(res, createErrorResponse('Project access denied', 'FORBIDDEN', 403));

      const del = await query('DELETE FROM team_capacity_iterations WHERE id = $1 RETURNING id', [itemId]);
      if (del.rows.length === 0) return sendResponse(res, createErrorResponse('Iteration not found', 'NOT_FOUND', 404));
      return sendResponse(res, createSuccessResponse({ message: 'Iteration deleted successfully' }));
    }

    if (type === 'member') {
      const del = await query('DELETE FROM team_capacity_members WHERE id = $1 RETURNING id', [itemId]);
      if (del.rows.length === 0) return sendResponse(res, createErrorResponse('Team member not found', 'NOT_FOUND', 404));
      return sendResponse(res, createSuccessResponse({ message: 'Team member deleted successfully' }));
    }

    return sendResponse(res, createErrorResponse('Invalid type. Must be "iteration" or "member"', 'INVALID_TYPE', 400));
  } catch (error) {
    console.error('Delete capacity error:', error);
    sendResponse(res, createErrorResponse('Failed to delete capacity item', 'DELETE_ERROR', 500));
  }
});

module.exports = router;
