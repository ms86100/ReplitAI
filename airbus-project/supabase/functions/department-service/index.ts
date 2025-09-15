import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createSuccessResponse,
  createErrorResponse,
  handleCorsOptions,
  parseRequestBody,
  validateAuthToken,
  logRequest,
} from '../shared/api-utils.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function isAdmin(userId: string) {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  return !!data;
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
    if (authError || !user) return createErrorResponse('Authentication required', 'UNAUTHORIZED', 401);

    // GET /department-service/departments
    if (method === 'GET' && path.endsWith('/departments')) {
      const { data: departments, error } = await supabase
        .from('departments')
        .select('id, name, created_at, updated_at')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching departments:', error);
        return createErrorResponse('Failed to fetch departments', 'FETCH_ERROR');
      }

      return createSuccessResponse(departments || []);
    }

    // POST /department-service/departments
    if (method === 'POST' && path.endsWith('/departments')) {
      const admin = await isAdmin(user.id);
      if (!admin) return createErrorResponse('Only admins can create departments', 'FORBIDDEN', 403);

      const body = await parseRequestBody(req);
      const { name } = body || {};
      if (!name) return createErrorResponse('name is required', 'MISSING_FIELDS');

      const { data: department, error } = await supabase
        .from('departments')
        .insert({ name })
        .select()
        .single();

      if (error) {
        console.error('Error creating department:', error);
        return createErrorResponse('Failed to create department', 'CREATE_ERROR');
      }

      return createSuccessResponse({ message: 'Department created', department });
    }

    // DELETE /department-service/departments/{id}
    if (method === 'DELETE' && path.includes('/departments/')) {
      const admin = await isAdmin(user.id);
      if (!admin) return createErrorResponse('Only admins can delete departments', 'FORBIDDEN', 403);

      const departmentId = path.split('/').pop();
      if (!departmentId) return createErrorResponse('Department ID is required', 'MISSING_FIELDS');

      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) {
        console.error('Error deleting department:', error);
        return createErrorResponse('Failed to delete department', 'DELETE_ERROR');
      }

      return createSuccessResponse({ message: 'Department deleted successfully' });
    }

    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);
  } catch (error) {
    console.error('Department service error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
});