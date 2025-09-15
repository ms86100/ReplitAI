import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
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

  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  logRequest(method, path);

  try {
    const { user, error: authError } = await validateAuthToken(req, supabase);
    if (authError || !user) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED', 401);
    }

    // GET /audit-service/projects/:id/history
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/history')) {
      const params = extractPathParams(url, '/audit-service/projects/:id/history');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: history, error } = await supabase
        .from('audit_log')
        .select('id, project_id, user_id, module, action, entity_type, entity_id, old_values, new_values, description, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching history:', error);
        return createErrorResponse('Failed to fetch history', 'FETCH_ERROR');
      }

      return createSuccessResponse(history || []);
    }

    // POST /audit-service/audit/log
    if (method === 'POST' && path.endsWith('/audit/log')) {
      const body = await parseRequestBody(req);
      const { projectId, module, action, entity_type, entity_id, old_values, new_values, description } = body || {};

      if (!projectId || !module || !action) {
        return createErrorResponse('projectId, module and action are required', 'MISSING_FIELDS');
      }

      // Require access to the project before logging
      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);

      const { data: entry, error } = await supabase
        .from('audit_log')
        .insert({
          project_id: projectId,
          user_id: user.id,
          module,
          action,
          entity_type: entity_type || null,
          entity_id: entity_id || null,
          old_values: old_values || null,
          new_values: new_values || null,
          description: description || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error writing audit log:', error);
        return createErrorResponse('Failed to write audit log', 'CREATE_ERROR');
      }

      return createSuccessResponse({ message: 'Audit log created', entry });
    }

    // GET /audit-service/projects/:id/logs - Alternative endpoint for logs (ApiClient compatible)
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/logs')) {
      const params = extractPathParams(url, '/audit-service/projects/:id/logs');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: logs, error } = await supabase
        .from('audit_log')
        .select('id, project_id, user_id, module, action, entity_type, entity_id, old_values, new_values, description, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching audit logs:', error);
        return createErrorResponse('Failed to fetch audit logs', 'FETCH_ERROR');
      }

      return createSuccessResponse(logs || []);
    }

    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);
  } catch (error) {
    console.error('Audit service error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
});