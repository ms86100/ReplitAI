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

type RaciRole = 'R' | 'A' | 'C' | 'I';

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

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return createErrorResponse('No authorization header', 'UNAUTHORIZED', 401);
    }

    // Create an authenticated client so RLS/auth.uid() are respected in DB triggers
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { user, error: authError } = await validateAuthToken(req, supabase);
    if (authError || !user) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED', 401);
    }

    logRequest(method, path, user);

    // GET /stakeholder-service/projects/:id/stakeholders
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/stakeholders')) {
      const params = extractPathParams(url, '/stakeholder-service/projects/:id/stakeholders');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: stakeholders, error } = await supabaseAuth
        .from('stakeholders')
        .select('id, project_id, name, email, department, raci, influence_level, notes, created_at, updated_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching stakeholders:', error);
        return createErrorResponse('Failed to fetch stakeholders', 'FETCH_ERROR');
      }

      return createSuccessResponse({ projectId, stakeholders: stakeholders || [] });
    }

    // POST /stakeholder-service/projects/:id/stakeholders
    if (method === 'POST' && path.includes('/projects/') && path.endsWith('/stakeholders')) {
      const params = extractPathParams(url, '/stakeholder-service/projects/:id/stakeholders');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const body = await parseRequestBody(req);
      if (!body?.name) return createErrorResponse('name is required', 'MISSING_FIELDS');

      const { data: stakeholder, error } = await supabaseAuth
        .from('stakeholders')
        .insert({
          project_id: projectId,
          name: body.name,
          email: body.email || null,
          department: body.department || null,
          raci: body.raci as string | null,
          influence_level: body.influence_level || null,
          notes: body.notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating stakeholder:', error);
        return createErrorResponse('Failed to create stakeholder', 'CREATE_ERROR');
      }

      return createSuccessResponse({ message: 'Stakeholder created successfully', stakeholder });
    }

    // PUT /stakeholder-service/projects/:id/stakeholders/:stakeholderId
    if (method === 'PUT' && path.includes('/stakeholders/') && !path.endsWith('/stakeholders')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const stakeholderIdIndex = pathParts.findIndex(part => part === 'stakeholders') + 1;

      const projectId = pathParts[projectIdIndex];
      const stakeholderId = pathParts[stakeholderIdIndex];
      const body = await parseRequestBody(req);

      if (!projectId || !stakeholderId) {
        return createErrorResponse('Project ID and Stakeholder ID are required', 'MISSING_IDS');
      }

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: stakeholder, error } = await supabaseAuth
        .from('stakeholders')
        .update({
          name: body.name,
          email: body.email,
          department: body.department,
          raci: body.raci,
          influence_level: body.influence_level,
          notes: body.notes,
        })
        .eq('id', stakeholderId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) {
        console.error('Error updating stakeholder:', error);
        return createErrorResponse('Failed to update stakeholder', 'UPDATE_ERROR');
      }

      return createSuccessResponse({ message: 'Stakeholder updated successfully', stakeholder });
    }

    // DELETE /stakeholder-service/projects/:id/stakeholders/:stakeholderId
    if (method === 'DELETE' && path.includes('/stakeholders/') && !path.endsWith('/stakeholders')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const stakeholderIdIndex = pathParts.findIndex(part => part === 'stakeholders') + 1;

      const projectId = pathParts[projectIdIndex];
      const stakeholderId = pathParts[stakeholderIdIndex];

      if (!projectId || !stakeholderId) {
        return createErrorResponse('Project ID and Stakeholder ID are required', 'MISSING_IDS');
      }

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { error } = await supabaseAuth
        .from('stakeholders')
        .delete()
        .eq('id', stakeholderId)
        .eq('project_id', projectId);

      if (error) {
        console.error('Error deleting stakeholder:', error);
        return createErrorResponse('Failed to delete stakeholder', 'DELETE_ERROR');
      }

      return createSuccessResponse({ message: 'Stakeholder deleted successfully' });
    }

    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);
  } catch (error) {
    console.error('Stakeholder service error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
});