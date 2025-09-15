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

type BacklogStatus = 'backlog' | 'in_progress' | 'blocked' | 'done';

async function hasProjectAccess(userId: string, projectId: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('id, created_by')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) return { ok: false, reason: 'PROJECT_NOT_FOUND' };

  const { data: adminRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (project.created_by === userId || adminRole) return { ok: true };

  const { data: membership } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membership) return { ok: true };

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

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return createErrorResponse('No authorization header', 'UNAUTHORIZED', 401);
  }

  // Create authenticated client for user context
  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  try {
    const { user, error: authError } = await validateAuthToken(req, supabase);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return createErrorResponse(authError || 'Authentication failed', 'UNAUTHORIZED', 401);
    }
    
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;

    logRequest(method, path, user);
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/backlog')) {
      const params = extractPathParams(url, '/backlog-service/projects/:id/backlog');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(
          access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions',
          access.reason,
          status
        );
      }

      const statusFilter = url.searchParams.get('status');

      let query = supabase
        .from('task_backlog')
        .select('id, project_id, title, description, status, priority, owner_id, target_date, source_type, created_at, updated_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      } else {
        // Default: only show items that are not done (exclude moved items)
        query = query.neq('status', 'done');
      }

      const { data: items, error } = await query;

      if (error) {
        console.error('Error fetching backlog:', error);
        return createErrorResponse('Failed to fetch backlog', 'FETCH_ERROR');
      }

      return createSuccessResponse({ projectId, items: items || [] });
    }

    // POST /backlog-service/projects/:id/backlog
    if (method === 'POST' && path.includes('/projects/') && path.endsWith('/backlog')) {
      const params = extractPathParams(url, '/backlog-service/projects/:id/backlog');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(
          access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions',
          access.reason,
          status
        );
      }

      const body = await parseRequestBody(req);
      if (!body?.title) {
        return createErrorResponse('title is required', 'MISSING_FIELDS');
      }

      const { data: item, error } = await supabaseAuth
        .from('task_backlog')
        .insert({
          project_id: projectId,
          title: body.title,
          description: body.description || null,
          priority: body.priority || 'medium',
          status: (body.status as BacklogStatus) || 'backlog',
          owner_id: body.ownerId || null,
          target_date: body.targetDate || null,
          source_type: body.sourceType || 'manual',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating backlog item:', error);
        return createErrorResponse('Failed to create backlog item', 'CREATE_ERROR');
      }

      return createSuccessResponse({ message: 'Backlog item created successfully', item });
    }

    // PUT /backlog-service/projects/:id/backlog/:itemId
    if (method === 'PUT' && path.includes('/backlog/') && !path.endsWith('/backlog')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const itemIdIndex = pathParts.findIndex(part => part === 'backlog') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const itemId = pathParts[itemIdIndex];
      const updateData = await parseRequestBody(req);

      if (!projectId || !itemId) return createErrorResponse('Project ID and Item ID are required', 'MISSING_IDS');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(
          access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions',
          access.reason,
          status
        );
      }

      const { data: item, error } = await supabaseAuth
        .from('task_backlog')
        .update({
          title: updateData.title,
          description: updateData.description,
          priority: updateData.priority,
          status: updateData.status as BacklogStatus,
          owner_id: updateData.ownerId,
          target_date: updateData.targetDate,
        })
        .eq('id', itemId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) {
        console.error('Error updating backlog item:', error);
        return createErrorResponse('Failed to update backlog item', 'UPDATE_ERROR');
      }

      return createSuccessResponse({ message: 'Backlog item updated successfully', item });
    }

    // DELETE /backlog-service/projects/:id/backlog/:itemId
    if (method === 'DELETE' && path.includes('/backlog/') && !path.endsWith('/backlog')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const itemIdIndex = pathParts.findIndex(part => part === 'backlog') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const itemId = pathParts[itemIdIndex];

      if (!projectId || !itemId) return createErrorResponse('Project ID and Item ID are required', 'MISSING_IDS');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(
          access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions',
          access.reason,
          status
        );
      }

      const { error } = await supabaseAuth
        .from('task_backlog')
        .delete()
        .eq('id', itemId)
        .eq('project_id', projectId);

      if (error) {
        console.error('Error deleting backlog item:', error);
        return createErrorResponse('Failed to delete backlog item', 'DELETE_ERROR');
      }

      return createSuccessResponse({ message: 'Backlog item deleted successfully' });
    }

    // POST /backlog-service/projects/:id/backlog/:itemId/move
    if (method === 'POST' && path.includes('/move')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const itemIdIndex = pathParts.findIndex(part => part === 'backlog') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const itemId = pathParts[itemIdIndex];
      const { milestoneId } = await parseRequestBody(req);

      if (!projectId || !itemId || !milestoneId) {
        return createErrorResponse('Project ID, Item ID, and Milestone ID are required', 'MISSING_IDS');
      }

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(
          access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions',
          access.reason,
          status
        );
      }

      // Get the backlog item
      const { data: backlogItem, error: fetchError } = await supabase
        .from('task_backlog')
        .select('*')
        .eq('id', itemId)
        .eq('project_id', projectId)
        .single();

      if (fetchError || !backlogItem) {
        return createErrorResponse('Backlog item not found', 'ITEM_NOT_FOUND', 404);
      }

      // Create a task from the backlog item
      const { data: task, error: createError } = await supabaseAuth
        .from('tasks')
        .insert({
          project_id: projectId,
          milestone_id: milestoneId,
          title: backlogItem.title,
          description: backlogItem.description,
          priority: backlogItem.priority,
          status: 'todo',
          due_date: backlogItem.target_date,
          owner_id: backlogItem.owner_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating task from backlog:', createError);
        return createErrorResponse('Failed to create task from backlog item', 'CREATE_TASK_ERROR');
      }

      // Update backlog item status to indicate it's been moved
      const { error: updateError } = await supabaseAuth
        .from('task_backlog')
        .update({ status: 'done' })
        .eq('id', itemId);

      if (updateError) {
        console.error('Error updating backlog status:', updateError);
        // Continue even if this fails - the task was created successfully
      }

      return createSuccessResponse({ message: 'Backlog item moved to milestone successfully', task });
    }

    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);
  } catch (error) {
    console.error('Backlog service error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
});