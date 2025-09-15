const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyProjectAccess, verifyAdmin } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /retro-service/projects/:id/retrospectives
router.get('/projects/:id/retrospectives', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    
    const retrospectivesQuery = `
      SELECT 
        r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', rc.id,
              'title', rc.title,
              'subtitle', rc.subtitle,
              'column_order', rc.column_order,
              'created_at', rc.created_at,
              'updated_at', rc.updated_at,
              'cards', COALESCE((
                SELECT json_agg(json_build_object(
                  'id', c.id,
                  'text', c.text,
                  'votes', c.votes,
                  'card_order', c.card_order,
                  'created_at', c.created_at,
                  'updated_at', c.updated_at,
                  'created_by', c.created_by
                ) ORDER BY c.card_order)
                FROM retrospective_cards c
                WHERE c.column_id = rc.id
              ), '[]'::json)
            )
            ORDER BY rc.column_order
          ) FILTER (WHERE rc.id IS NOT NULL), '[]'::json
        ) AS columns
      FROM retrospectives r
      LEFT JOIN retrospective_columns rc ON rc.retrospective_id = r.id
      WHERE r.project_id = $1
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `;
    
    const result = await query(retrospectivesQuery, [projectId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get retrospectives error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch retrospectives', 'FETCH_ERROR', 500));
  }
});

// POST /retro-service/projects/:id/retrospectives
router.post('/projects/:id/retrospectives', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;
    const userId = req.user.id;
    const { framework, iterationName, iterationId, columns } = req.body;
    
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');
      
      const retrospectiveId = uuidv4();
      const now = new Date();
      
      // Create retrospective
      const retroResult = await client.query(`
        INSERT INTO retrospectives (id, project_id, iteration_id, framework, status, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        retrospectiveId,
        projectId,
        iterationName || iterationId || retrospectiveId, // store provided iteration text or fallback
        framework || 'Classic',
        'active',
        userId,
        now,
        now
      ]);
      
      // Create default columns if provided
      if (columns && Array.isArray(columns)) {
        for (let i = 0; i < columns.length; i++) {
          const column = columns[i];
          const columnId = uuidv4();
          
          await client.query(`
            INSERT INTO retrospective_columns (id, retrospective_id, title, subtitle, column_order, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            columnId,
            retrospectiveId,
            column.title,
            column.subtitle || null,
            i,
            now,
            now
          ]);
        }
      } else {
        // Create default columns for Classic framework
        const defaultColumns = [
          { title: 'What went well?', subtitle: 'Things that worked' },
          { title: 'What could be improved?', subtitle: 'Areas for growth' },
          { title: 'Action items', subtitle: 'Next steps' }
        ];
        
        for (let i = 0; i < defaultColumns.length; i++) {
          const column = defaultColumns[i];
          const columnId = uuidv4();
          
          await client.query(`
            INSERT INTO retrospective_columns (id, retrospective_id, title, subtitle, column_order, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            columnId,
            retrospectiveId,
            column.title,
            column.subtitle,
            i,
            now,
            now
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      sendResponse(res, createSuccessResponse({
        message: 'Retrospective created successfully',
        retrospective: retroResult.rows[0]
      }));
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Create retrospective error:', error);
    sendResponse(res, createErrorResponse('Failed to create retrospective', 'CREATE_ERROR', 500));
  }
});

// POST /retro-service/retrospectives/:id/actions
router.post('/retrospectives/:id/actions', verifyToken, async (req, res) => {
  try {
    const retrospectiveId = req.params.id;
    const userId = req.user.id;
    const { what_task, when_sprint, who_responsible, how_approach, backlog_ref_id } = req.body;
    
    if (!what_task) {
      return sendResponse(res, createErrorResponse('Task description required', 'MISSING_FIELDS', 400));
    }

    // Verify user has access to the retrospective's project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospectives r
        JOIN projects p ON r.project_id = p.id
        WHERE r.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin'::app_role) OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [retrospectiveId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Retrospective access denied', 'FORBIDDEN', 403));
    }

    const actionId = uuidv4();
    const now = new Date();
    
    const insertQuery = `
      INSERT INTO retrospective_action_items (id, retrospective_id, what_task, when_sprint, who_responsible, how_approach, backlog_ref_id, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      actionId,
      retrospectiveId,
      what_task,
      when_sprint || null,
      who_responsible || null,
      how_approach || null,
      backlog_ref_id || null,
      userId,
      now,
      now
    ]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Action item created successfully',
      action: result.rows[0]
    }));
  } catch (error) {
    console.error('Create action item error:', error);
    sendResponse(res, createErrorResponse('Failed to create action item', 'CREATE_ERROR', 500));
  }
});

// GET /retro-service/stats
router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM retrospectives) as total_retrospectives,
        (SELECT COUNT(*) FROM retrospective_action_items) as total_action_items,
        (SELECT COUNT(*) FROM retrospective_action_items WHERE converted_to_task = true) as converted_tasks,
        CASE 
          WHEN (SELECT COUNT(*) FROM retrospective_action_items) > 0 
          THEN (SELECT COUNT(*) FROM retrospective_action_items WHERE converted_to_task = true) * 100.0 / (SELECT COUNT(*) FROM retrospective_action_items)
          ELSE 0
        END as conversion_rate
    `;
    
    const result = await query(statsQuery);
    const stats = result.rows[0];
    
    sendResponse(res, createSuccessResponse({
      totalRetrospectives: parseInt(stats.total_retrospectives),
      totalActionItems: parseInt(stats.total_action_items),
      convertedTasks: parseInt(stats.converted_tasks),
      conversionRate: parseFloat(stats.conversion_rate) || 0
    }));
  } catch (error) {
    console.error('Get retro stats error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch retrospective statistics', 'STATS_ERROR', 500));
  }
});

// GET /retro-service/retrospectives/:id/columns
router.get('/retrospectives/:id/columns', verifyToken, async (req, res) => {
  try {
    const retrospectiveId = req.params.id;
    const userId = req.user.id;
    
    // Verify user has access to the retrospective's project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospectives r
        JOIN projects p ON r.project_id = p.id
        WHERE r.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [retrospectiveId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Retrospective access denied', 'FORBIDDEN', 403));
    }
    
    const columnsQuery = `
      SELECT * FROM retrospective_columns
      WHERE retrospective_id = $1
      ORDER BY column_order
    `;
    
    const result = await query(columnsQuery, [retrospectiveId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get retrospective columns error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch retrospective columns', 'FETCH_ERROR', 500));
  }
});

// GET /retro-service/retrospectives/:id/cards
router.get('/retrospectives/:id/cards', verifyToken, async (req, res) => {
  try {
    const retrospectiveId = req.params.id;
    const userId = req.user.id;
    
    // Verify user has access to the retrospective's project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospectives r
        JOIN projects p ON r.project_id = p.id
        WHERE r.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [retrospectiveId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Retrospective access denied', 'FORBIDDEN', 403));
    }
    
    const cardsQuery = `
      SELECT rc.*, pr.full_name as created_by_name
      FROM retrospective_cards rc
      JOIN retrospective_columns rcol ON rc.column_id = rcol.id
      LEFT JOIN profiles pr ON rc.created_by = pr.id
      WHERE rcol.retrospective_id = $1
      ORDER BY rc.column_id, rc.card_order
    `;
    
    const result = await query(cardsQuery, [retrospectiveId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get retrospective cards error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch retrospective cards', 'FETCH_ERROR', 500));
  }
});

// POST /retro-service/columns/:id/cards
router.post('/columns/:id/cards', verifyToken, async (req, res) => {
  try {
    const columnId = req.params.id;
    const userId = req.user.id;
    const { text, card_order } = req.body;
    
    if (!text) {
      return sendResponse(res, createErrorResponse('Card text required', 'MISSING_FIELDS', 400));
    }

    // Verify user has access to the column's retrospective project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospective_columns rc
        JOIN retrospectives r ON rc.retrospective_id = r.id
        JOIN projects p ON r.project_id = p.id
        WHERE rc.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [columnId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Column access denied', 'FORBIDDEN', 403));
    }

    const cardId = uuidv4();
    const now = new Date();
    
    const insertQuery = `
      INSERT INTO retrospective_cards (id, column_id, text, card_order, votes, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      cardId,
      columnId,
      text,
      card_order || 0,
      0,
      userId,
      now,
      now
    ]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Card created successfully',
      card: result.rows[0]
    }));
  } catch (error) {
    console.error('Create retrospective card error:', error);
    sendResponse(res, createErrorResponse('Failed to create card', 'CREATE_ERROR', 500));
  }
});

// PUT /retro-service/cards/:id
router.put('/cards/:id', verifyToken, async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.user.id;
    const { text, card_order, column_id } = req.body;
    
    // Verify user has access to the card's retrospective project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospective_cards rc
        JOIN retrospective_columns rcol ON rc.column_id = rcol.id
        JOIN retrospectives r ON rcol.retrospective_id = r.id
        JOIN projects p ON r.project_id = p.id
        WHERE rc.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [cardId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Card access denied', 'FORBIDDEN', 403));
    }
    
    const updateQuery = `
      UPDATE retrospective_cards 
      SET text = COALESCE($2, text),
          card_order = COALESCE($3, card_order),
          column_id = COALESCE($4, column_id),
          updated_at = $5
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      cardId,
      text,
      card_order,
      column_id,
      new Date()
    ]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Card not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({
      message: 'Card updated successfully',
      card: result.rows[0]
    }));
  } catch (error) {
    console.error('Update retrospective card error:', error);
    sendResponse(res, createErrorResponse('Failed to update card', 'UPDATE_ERROR', 500));
  }
});

// DELETE /retro-service/cards/:id
router.delete('/cards/:id', verifyToken, async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.user.id;
    
    // Verify user has access to the card's retrospective project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospective_cards rc
        JOIN retrospective_columns rcol ON rc.column_id = rcol.id
        JOIN retrospectives r ON rcol.retrospective_id = r.id
        JOIN projects p ON r.project_id = p.id
        WHERE rc.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [cardId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Card access denied', 'FORBIDDEN', 403));
    }
    
    const deleteQuery = 'DELETE FROM retrospective_cards WHERE id = $1 RETURNING id';
    const result = await query(deleteQuery, [cardId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Card not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Card deleted successfully' }));
  } catch (error) {
    console.error('Delete retrospective card error:', error);
    sendResponse(res, createErrorResponse('Failed to delete card', 'DELETE_ERROR', 500));
  }
});

// POST /retro-service/cards/:id/vote
router.post('/cards/:id/vote', verifyToken, async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.user.id;
    
    // Verify user has access to the card's retrospective project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospective_cards rc
        JOIN retrospective_columns rcol ON rc.column_id = rcol.id
        JOIN retrospectives r ON rcol.retrospective_id = r.id
        JOIN projects p ON r.project_id = p.id
        WHERE rc.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [cardId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Card access denied', 'FORBIDDEN', 403));
    }
    
    // Check if user has already voted
    const existingVoteQuery = 'SELECT id FROM retrospective_card_votes WHERE card_id = $1 AND user_id = $2';
    const existingVote = await query(existingVoteQuery, [cardId, userId]);
    
    if (existingVote.rows.length > 0) {
      return sendResponse(res, createErrorResponse('User has already voted on this card', 'ALREADY_VOTED', 400));
    }

    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');
      
      // Add vote
      const voteId = uuidv4();
      await client.query(
        'INSERT INTO retrospective_card_votes (id, card_id, user_id, created_at) VALUES ($1, $2, $3, $4)',
        [voteId, cardId, userId, new Date()]
      );
      
      // Update vote count
      await client.query(
        'UPDATE retrospective_cards SET votes = votes + 1 WHERE id = $1',
        [cardId]
      );
      
      await client.query('COMMIT');
      
      sendResponse(res, createSuccessResponse({ message: 'Vote added successfully' }));
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Vote on card error:', error);
    sendResponse(res, createErrorResponse('Failed to vote on card', 'VOTE_ERROR', 500));
  }
});

// DELETE /retro-service/cards/:id/unvote
router.delete('/cards/:id/unvote', verifyToken, async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.user.id;
    
    // Verify user has access to the card's retrospective project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospective_cards rc
        JOIN retrospective_columns rcol ON rc.column_id = rcol.id
        JOIN retrospectives r ON rcol.retrospective_id = r.id
        JOIN projects p ON r.project_id = p.id
        WHERE rc.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [cardId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Card access denied', 'FORBIDDEN', 403));
    }

    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');
      
      // Remove vote
      const deleteResult = await client.query(
        'DELETE FROM retrospective_card_votes WHERE card_id = $1 AND user_id = $2 RETURNING id',
        [cardId, userId]
      );
      
      if (deleteResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendResponse(res, createErrorResponse('Vote not found', 'NOT_FOUND', 404));
      }
      
      // Update vote count
      await client.query(
        'UPDATE retrospective_cards SET votes = GREATEST(votes - 1, 0) WHERE id = $1',
        [cardId]
      );
      
      await client.query('COMMIT');
      
      sendResponse(res, createSuccessResponse({ message: 'Vote removed successfully' }));
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Unvote card error:', error);
    sendResponse(res, createErrorResponse('Failed to remove vote', 'UNVOTE_ERROR', 500));
  }
});

// PUT /retro-service/cards/:id/move
router.put('/cards/:id/move', verifyToken, async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.user.id;
    const { column_id } = req.body;
    
    if (!column_id) {
      return sendResponse(res, createErrorResponse('Column ID required', 'MISSING_FIELDS', 400));
    }
    
    // Verify user has access to the card's retrospective project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospective_cards rc
        JOIN retrospective_columns rcol ON rc.column_id = rcol.id
        JOIN retrospectives r ON rcol.retrospective_id = r.id
        JOIN projects p ON r.project_id = p.id
        WHERE rc.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [cardId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Card access denied', 'FORBIDDEN', 403));
    }
    
    const updateQuery = `
      UPDATE retrospective_cards 
      SET column_id = $2, updated_at = $3
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(updateQuery, [cardId, column_id, new Date()]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Card not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Card moved successfully' }));
  } catch (error) {
    console.error('Move card error:', error);
    sendResponse(res, createErrorResponse('Failed to move card', 'MOVE_ERROR', 500));
  }
});

// GET /retro-service/retrospectives/:id/action-items
router.get('/retrospectives/:id/action-items', verifyToken, async (req, res) => {
  try {
    const retrospectiveId = req.params.id;
    const userId = req.user.id;
    
    // Verify user has access to the retrospective's project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospectives r
        JOIN projects p ON r.project_id = p.id
        WHERE r.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [retrospectiveId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Retrospective access denied', 'FORBIDDEN', 403));
    }
    
    const actionItemsQuery = `
      SELECT rai.*, pr.full_name as created_by_name
      FROM retrospective_action_items rai
      LEFT JOIN profiles pr ON rai.created_by = pr.id
      WHERE rai.retrospective_id = $1
      ORDER BY rai.created_at DESC
    `;
    
    const result = await query(actionItemsQuery, [retrospectiveId]);
    
    sendResponse(res, createSuccessResponse(result.rows));
  } catch (error) {
    console.error('Get retrospective action items error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch action items', 'FETCH_ERROR', 500));
  }
});

// POST /retro-service/retrospectives/:id/action-items
router.post('/retrospectives/:id/action-items', verifyToken, async (req, res) => {
  try {
    const retrospectiveId = req.params.id;
    const userId = req.user.id;
    const { what_task, when_sprint, who_responsible, how_approach, from_card_id } = req.body;
    
    if (!what_task) {
      return sendResponse(res, createErrorResponse('Task description required', 'MISSING_FIELDS', 400));
    }

    // Verify user has access to the retrospective's project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospectives r
        JOIN projects p ON r.project_id = p.id
        WHERE r.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [retrospectiveId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Retrospective access denied', 'FORBIDDEN', 403));
    }

    const actionItemId = uuidv4();
    const now = new Date();
    
    const insertQuery = `
      INSERT INTO retrospective_action_items (id, retrospective_id, what_task, when_sprint, who_responsible, how_approach, from_card_id, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      actionItemId,
      retrospectiveId,
      what_task,
      when_sprint || null,
      who_responsible || null,
      how_approach || null,
      from_card_id || null,
      userId,
      now,
      now
    ]);
    
    sendResponse(res, createSuccessResponse({
      message: 'Action item created successfully',
      actionItem: result.rows[0]
    }));
  } catch (error) {
    console.error('Create retrospective action item error:', error);
    sendResponse(res, createErrorResponse('Failed to create action item', 'CREATE_ERROR', 500));
  }
});

// PUT /retro-service/action-items/:id
router.put('/action-items/:id', verifyToken, async (req, res) => {
  try {
    const actionItemId = req.params.id;
    const userId = req.user.id;
    const { what_task, when_sprint, who_responsible, how_approach, backlog_status } = req.body;
    
    // Verify user has access to the action item's retrospective project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospective_action_items rai
        JOIN retrospectives r ON rai.retrospective_id = r.id
        JOIN projects p ON r.project_id = p.id
        WHERE rai.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [actionItemId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Action item access denied', 'FORBIDDEN', 403));
    }
    
    const updateQuery = `
      UPDATE retrospective_action_items 
      SET what_task = COALESCE($2, what_task),
          when_sprint = COALESCE($3, when_sprint),
          who_responsible = COALESCE($4, who_responsible),
          how_approach = COALESCE($5, how_approach),
          backlog_status = COALESCE($6, backlog_status),
          updated_at = $7
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      actionItemId,
      what_task,
      when_sprint,
      who_responsible,
      how_approach,
      backlog_status,
      new Date()
    ]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Action item not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({
      message: 'Action item updated successfully',
      actionItem: result.rows[0]
    }));
  } catch (error) {
    console.error('Update retrospective action item error:', error);
    sendResponse(res, createErrorResponse('Failed to update action item', 'UPDATE_ERROR', 500));
  }
});

// DELETE /retro-service/action-items/:id
router.delete('/action-items/:id', verifyToken, async (req, res) => {
  try {
    const actionItemId = req.params.id;
    const userId = req.user.id;
    
    // Verify user has access to the action item's retrospective project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospective_action_items rai
        JOIN retrospectives r ON rai.retrospective_id = r.id
        JOIN projects p ON r.project_id = p.id
        WHERE rai.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [actionItemId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Action item access denied', 'FORBIDDEN', 403));
    }
    
    const deleteQuery = 'DELETE FROM retrospective_action_items WHERE id = $1 RETURNING id';
    const result = await query(deleteQuery, [actionItemId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Action item not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Action item deleted successfully' }));
  } catch (error) {
    console.error('Delete retrospective action item error:', error);
    sendResponse(res, createErrorResponse('Failed to delete action item', 'DELETE_ERROR', 500));
  }
});

// DELETE /retro-service/:id (delete retrospective)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const retrospectiveId = req.params.id;
    const userId = req.user.id;
    
    // Verify user has access to the retrospective's project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM retrospectives r
        JOIN projects p ON r.project_id = p.id
        WHERE r.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = p.id AND mp.user_id = $2)
        )
      ) as has_access
    `;
    
    const accessResult = await query(accessQuery, [retrospectiveId, userId]);
    
    if (!accessResult.rows[0].has_access) {
      return sendResponse(res, createErrorResponse('Retrospective access denied', 'FORBIDDEN', 403));
    }
    
    const deleteQuery = 'DELETE FROM retrospectives WHERE id = $1 RETURNING id';
    const result = await query(deleteQuery, [retrospectiveId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Retrospective not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Retrospective deleted successfully' }));
  } catch (error) {
    console.error('Delete retrospective error:', error);
    sendResponse(res, createErrorResponse('Failed to delete retrospective', 'DELETE_ERROR', 500));
  }
});

module.exports = router;