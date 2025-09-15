import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  createSuccessResponse,
  createErrorResponse,
  handleCorsOptions,
  parseRequestBody,
  validateAuthToken,
  extractPathParams,
  logRequest,
} from '../shared/api-utils.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CreateRetrospectiveBody {
  framework?: string;
  iterationName?: string;
  columns?: { title: string; subtitle?: string }[];
}

interface CreateRetroActionBody {
  what_task: string;
  when_sprint?: string;
  who_responsible?: string;
  how_approach?: string;
  backlog_ref_id?: string;
  from_card_id?: string;
}

async function hasProjectAccess(userId: string, projectId: string) {
  // Project exists?
  const { data: project } = await supabase
    .from('projects')
    .select('id, created_by')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) return { ok: false, reason: 'PROJECT_NOT_FOUND' };

  // Admin?
  const { data: adminRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (project.created_by === userId || adminRole) return { ok: true };

  // Member?
  const { data: membership } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membership) return { ok: true };

  // Any module permission?
  const { data: modulePerm } = await supabase
    .from('module_permissions')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (modulePerm) return { ok: true };

  return { ok: false, reason: 'FORBIDDEN' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // logRequest moved after authentication to include user context

  try {
    // All endpoints require authentication
    const { user, error: authError } = await validateAuthToken(req, supabase);
    if (authError || !user) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED', 401);
    }
    // Create a user-scoped client so RLS and auth.uid() work in triggers
    const db = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') || '',
        },
      },
    });
    logRequest(method, path, user);

    // GET /retro-service/projects/:id/retrospectives
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/retrospectives')) {
      const params = extractPathParams(url, '/retro-service/projects/:id/retrospectives');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: retrospectives, error } = await db
        .from('retrospectives')
        .select(`
          id, project_id, iteration_id, framework, status, created_at, updated_at, created_by,
          columns:retrospective_columns (
            id, title, subtitle, column_order, created_at, updated_at,
            cards:retrospective_cards (
              id, text, votes, card_order, created_at, updated_at, created_by
            )
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching retrospectives:', error);
        return createErrorResponse('Failed to fetch retrospectives', 'FETCH_ERROR');
      }

      return createSuccessResponse(retrospectives || []);
    }

    // POST /retro-service/projects/:id/retrospectives
    if (method === 'POST' && path.includes('/projects/') && path.endsWith('/retrospectives')) {
      const params = extractPathParams(url, '/retro-service/projects/:id/retrospectives');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const body: CreateRetrospectiveBody = await parseRequestBody(req);
      const framework = body.framework || 'Classic';

      const { data: retrospective, error: createError } = await db
        .from('retrospectives')
        .insert({
          project_id: projectId,
          iteration_id: body.iterationName || null,
          framework,
          status: 'active',
          created_by: user.id,
        })
        .select()
        .single();

      if (createError || !retrospective) {
        console.error('Error creating retrospective:', createError);
        return createErrorResponse('Failed to create retrospective', 'CREATE_ERROR');
      }

      // Default columns based on framework
      const frameworkColumns = {
        classic: [
          { title: 'Start', subtitle: 'What should we start doing?' },
          { title: 'Stop', subtitle: 'What should we stop doing?' },
          { title: 'Continue', subtitle: 'What should we continue doing?' }
        ],
        '4ls': [
          { title: 'Liked', subtitle: 'What did we like?' },
          { title: 'Learned', subtitle: 'What did we learn?' },
          { title: 'Lacked', subtitle: 'What was missing or lacking?' },
          { title: 'Longed For', subtitle: 'What did we long for?' }
        ],
        kiss: [
          { title: 'Keep', subtitle: 'What should we continue doing?' },
          { title: 'Improve', subtitle: 'What could be improved?' },
          { title: 'Start', subtitle: 'What should we try next?' },
          { title: 'Stop', subtitle: 'What should we avoid?' }
        ],
        sailboat: [
          { title: 'Wind', subtitle: 'Things pushing the team forward' },
          { title: 'Anchor', subtitle: 'Things holding the team back' },
          { title: 'Rocks', subtitle: 'Risks or obstacles ahead' },
          { title: 'Island', subtitle: 'Goals or desired state' }
        ],
        mad_sad_glad: [
          { title: 'Mad', subtitle: 'What frustrated us?' },
          { title: 'Sad', subtitle: 'What disappointed us?' },
          { title: 'Glad', subtitle: 'What made us happy?' }
        ]
      };

      const columns = body.columns && body.columns.length > 0 ? body.columns : frameworkColumns[framework] || frameworkColumns.classic;

      const toInsert = columns.map((c, idx) => ({
        retrospective_id: retrospective.id,
        title: c.title,
        subtitle: c.subtitle || null,
        column_order: idx,
      }));

      const { error: colError } = await db
        .from('retrospective_columns')
        .insert(toInsert);

      if (colError) {
        console.error('Error creating columns:', colError);
        return createErrorResponse('Retrospective created but failed to create columns', 'PARTIAL_CREATE');
      }

      return createSuccessResponse({
        message: 'Retrospective created successfully',
        retrospective,
      });
    }

    // POST /retro-service/retrospectives/:id/actions
    if (method === 'POST' && path.includes('/retrospectives/') && path.endsWith('/actions')) {
      const pathParts = path.split('/');
      const retroIdIndex = pathParts.findIndex((p) => p === 'retrospectives') + 1;
      const retrospectiveId = pathParts[retroIdIndex];
      if (!retrospectiveId) return createErrorResponse('Retrospective ID is required', 'MISSING_RETRO_ID');

      // Find project for access check
      const { data: retro } = await db
        .from('retrospectives')
        .select('id, project_id')
        .eq('id', retrospectiveId)
        .maybeSingle();

      if (!retro) return createErrorResponse('Retrospective not found', 'RETRO_NOT_FOUND', 404);

      const access = await hasProjectAccess(user.id, retro.project_id);
      if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);

      const body: CreateRetroActionBody = await parseRequestBody(req);
      if (!body.what_task) return createErrorResponse('what_task is required', 'MISSING_FIELDS');

      const { data: action, error } = await db
        .from('retrospective_action_items')
        .insert({
          retrospective_id: retrospectiveId,
          what_task: body.what_task,
          when_sprint: body.when_sprint || null,
          who_responsible: body.who_responsible || null,
          how_approach: body.how_approach || null,
          backlog_ref_id: body.backlog_ref_id || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating action item:', error);
        return createErrorResponse('Failed to create action item', 'CREATE_ERROR');
      }

      return createSuccessResponse({
        message: 'Action item created successfully',
        action,
      });
    }

    // POST /retro-service/retrospectives/:id/action-items (alias)
    if (method === 'POST' && path.includes('/retrospectives/') && path.endsWith('/action-items')) {
      const pathParts = path.split('/');
      const retroIdIndex = pathParts.findIndex((p) => p === 'retrospectives') + 1;
      const retrospectiveId = pathParts[retroIdIndex];
      if (!retrospectiveId) return createErrorResponse('Retrospective ID is required', 'MISSING_RETRO_ID');

      const { data: retro } = await db
        .from('retrospectives')
        .select('id, project_id')
        .eq('id', retrospectiveId)
        .maybeSingle();

      if (!retro) return createErrorResponse('Retrospective not found', 'RETRO_NOT_FOUND', 404);

      const access = await hasProjectAccess(user.id, retro.project_id);
      if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);

      const body: CreateRetroActionBody = await parseRequestBody(req);
      if (!body.what_task) return createErrorResponse('what_task is required', 'MISSING_FIELDS');

      const insertPayload: any = {
        retrospective_id: retrospectiveId,
        what_task: body.what_task,
        when_sprint: body.when_sprint || null,
        who_responsible: body.who_responsible || null,
        how_approach: body.how_approach || null,
        backlog_ref_id: body.backlog_ref_id || null,
        created_by: user.id,
      };
      if (body.from_card_id) insertPayload.from_card_id = body.from_card_id;

      const { data: action, error } = await db
        .from('retrospective_action_items')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('Error creating action item (alias):', error);
        return createErrorResponse('Failed to create action item', 'CREATE_ERROR');
      }

      return createSuccessResponse({
        message: 'Action item created successfully',
        action,
      });
    }

    // POST /retro-service/columns/:id/cards
    if (method === 'POST' && path.includes('/columns/') && path.endsWith('/cards')) {
      const pathParts = path.split('/');
      const columnIdIndex = pathParts.findIndex((p) => p === 'columns') + 1;
      const columnId = pathParts[columnIdIndex];
      if (!columnId) return createErrorResponse('Column ID is required', 'MISSING_COLUMN_ID');

      const body: { text: string; card_order: number } = await parseRequestBody(req);
      if (!body.text) return createErrorResponse('text is required', 'MISSING_FIELDS');

      // Find retrospective for access check
      const { data: column } = await db
        .from('retrospective_columns')
        .select('retrospective_id')
        .eq('id', columnId)
        .maybeSingle();

      if (!column) return createErrorResponse('Column not found', 'COLUMN_NOT_FOUND', 404);

      const { data: retro } = await db
        .from('retrospectives')
        .select('project_id')
        .eq('id', column.retrospective_id)
        .maybeSingle();

      if (!retro) return createErrorResponse('Retrospective not found', 'RETRO_NOT_FOUND', 404);

      const access = await hasProjectAccess(user.id, retro.project_id);
      if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);

      const { data: card, error } = await db
        .from('retrospective_cards')
        .insert({
          column_id: columnId,
          text: body.text,
          card_order: body.card_order || 0,
          votes: 0,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating card:', error);
        return createErrorResponse('Failed to create card', 'CREATE_ERROR');
      }

      return createSuccessResponse({ message: 'Card created successfully', card });
    }

    // POST /retro-service/cards/:id/vote
    if (method === 'POST' && path.includes('/cards/') && path.endsWith('/vote')) {
      const pathParts = path.split('/');
      const cardIdIndex = pathParts.findIndex((p) => p === 'cards') + 1;
      const cardId = pathParts[cardIdIndex];
      if (!cardId) return createErrorResponse('Card ID is required', 'MISSING_CARD_ID');

      // Find retrospective for access check
      const { data: cardData } = await db
        .from('retrospective_cards')
        .select(`
          id, votes,
          column:retrospective_columns!inner(
            retrospective:retrospectives!inner(project_id)
          )
        `)
        .eq('id', cardId)
        .maybeSingle();

      if (!cardData) return createErrorResponse('Card not found', 'CARD_NOT_FOUND', 404);

      const projectId = (cardData.column as any).retrospective.project_id;
      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);

      // Check if user already voted
      const { data: existingVote } = await db
        .from('retrospective_card_votes')
        .select('id')
        .eq('card_id', cardId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingVote) {
        // Remove vote
        await db.from('retrospective_card_votes').delete().eq('id', existingVote.id);
        await db.from('retrospective_cards').update({ votes: Math.max(0, cardData.votes - 1) }).eq('id', cardId);
        return createSuccessResponse({ message: 'Vote removed' });
      } else {
        // Add vote
        await db.from('retrospective_card_votes').insert({ card_id: cardId, user_id: user.id });
        await db.from('retrospective_cards').update({ votes: cardData.votes + 1 }).eq('id', cardId);
        return createSuccessResponse({ message: 'Vote added' });
      }
    }

    // DELETE /retro-service/cards/:id
    if (method === 'DELETE' && path.includes('/cards/')) {
      const pathParts = path.split('/');
      const cardIdIndex = pathParts.findIndex((p) => p === 'cards') + 1;
      const cardId = pathParts[cardIdIndex];
      if (!cardId) return createErrorResponse('Card ID is required', 'MISSING_CARD_ID');

      // Find and verify ownership/access
      const { data: cardData } = await db
        .from('retrospective_cards')
        .select(`
          id, created_by,
          column:retrospective_columns!inner(
            retrospective:retrospectives!inner(project_id, created_by)
          )
        `)
        .eq('id', cardId)
        .maybeSingle();

      if (!cardData) return createErrorResponse('Card not found', 'CARD_NOT_FOUND', 404);

      const projectId = (cardData.column as any).retrospective.project_id;
      const retroCreatedBy = (cardData.column as any).retrospective.created_by;
      
      // Only card creator or retrospective creator can delete
      if (cardData.created_by !== user.id && retroCreatedBy !== user.id) {
        const access = await hasProjectAccess(user.id, projectId);
        if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);
      }

      const { error } = await db.from('retrospective_cards').delete().eq('id', cardId);
      if (error) {
        console.error('Error deleting card:', error);
        return createErrorResponse('Failed to delete card', 'DELETE_ERROR');
      }

      return createSuccessResponse({ message: 'Card deleted successfully' });
    }

    // PUT /retro-service/cards/:id/move
    if (method === 'PUT' && path.includes('/cards/') && path.endsWith('/move')) {
      const pathParts = path.split('/');
      const cardIdIndex = pathParts.findIndex((p) => p === 'cards') + 1;
      const cardId = pathParts[cardIdIndex];
      if (!cardId) return createErrorResponse('Card ID is required', 'MISSING_CARD_ID');

      const body: { column_id: string } = await parseRequestBody(req);
      if (!body.column_id) return createErrorResponse('column_id is required', 'MISSING_FIELDS');

      // Verify access to both old and new columns
      const { data: cardData } = await db
        .from('retrospective_cards')
        .select(`
          id,
          column:retrospective_columns!inner(
            retrospective:retrospectives!inner(project_id)
          )
        `)
        .eq('id', cardId)
        .maybeSingle();

      if (!cardData) return createErrorResponse('Card not found', 'CARD_NOT_FOUND', 404);

      const projectId = (cardData.column as any).retrospective.project_id;
      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);

      const { error } = await db
        .from('retrospective_cards')
        .update({ column_id: body.column_id })
        .eq('id', cardId);

      if (error) {
        console.error('Error moving card:', error);
        return createErrorResponse('Failed to move card', 'MOVE_ERROR');
      }

      return createSuccessResponse({ message: 'Card moved successfully' });
    }

    // GET /retro-service/stats - Get global retrospective statistics
    if (method === 'GET' && path.endsWith('/stats')) {
      // Check if user is admin (only admins can see global stats)
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!adminRole) {
        return createErrorResponse('Only admins can view global statistics', 'FORBIDDEN', 403);
      }

      const [retrosRes, actionsRes] = await Promise.all([
        supabase.from('retrospectives').select('*', { count: 'exact', head: true }),
        supabase.from('retrospective_action_items').select('*', { count: 'exact', head: true }),
      ]);

      const [convertedRes] = await Promise.all([
        supabase.from('retrospective_action_items').select('*', { count: 'exact', head: true }).eq('converted_to_task', true)
      ]);

      const totalRetrospectives = retrosRes.count || 0;
      const totalActionItems = actionsRes.count || 0;
      const convertedTasks = convertedRes.count || 0;
      const conversionRate = totalActionItems > 0 ? Math.round((convertedTasks / totalActionItems) * 100) : 0;

      return createSuccessResponse({
        totalRetrospectives,
        totalActionItems,
        convertedTasks,
        conversionRate,
      });
    }

    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);
  } catch (error) {
    console.error('Retro service error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
});