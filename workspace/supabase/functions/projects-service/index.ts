import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  createSuccessResponse,
  createErrorResponse,
  handleCorsOptions,
  validateAuthToken,
  parseRequestBody,
  extractPathParams,
  logRequest,
} from '../shared/api-utils.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CreateProjectRequest {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  status?: string;
  departmentId?: string;
}

interface UpdateProjectRequest {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  status?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const normalizedPath = path
    .replace(/^\/functions\/v1\/projects-service/, '')
    .replace(/^\/projects-service/, '') || '/';
  const normUrl = new URL(url.origin + normalizedPath);

  logRequest(method, normalizedPath);

  try {
    // Validate authentication for all endpoints
    const { user, error: authError } = await validateAuthToken(req, supabase);
    if (authError || !user) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED', 401);
    }

    // Create a user-scoped Supabase client so RLS applies correctly
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const db = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') || '',
        },
      },
    });

    // GET /projects
    if (method === 'GET' && (normalizedPath === '/projects' || normalizedPath === '/projects/')) {
      const { data: projects, error } = await db
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch projects error:', error);
        return createErrorResponse('Failed to fetch projects', 'FETCH_FAILED');
      }

      return createSuccessResponse(projects);
    }

    // POST /projects
    if (method === 'POST' && (normalizedPath === '/projects' || normalizedPath === '/projects/')) {
      const projectData: CreateProjectRequest = await parseRequestBody(req);

      if (!projectData.name) {
        return createErrorResponse('Project name is required', 'MISSING_NAME');
      }

      const { data: project, error } = await db
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          start_date: projectData.startDate,
          end_date: projectData.endDate,
          priority: projectData.priority || 'medium',
          status: projectData.status || 'planning',
          created_by: user.id,
          department_id: projectData.departmentId,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Create project error:', error);
        return createErrorResponse('Failed to create project', 'CREATE_FAILED');
      }

      return createSuccessResponse(project);
    }

    // GET /projects/:id
    if (method === 'GET' && normalizedPath.match(/^\/projects\/[^\/]+$/)) {
      const params = extractPathParams(normUrl, '/projects/:id');
      const projectId = params.id;

      const { data: project, error } = await db
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        console.error('Fetch project error:', error);
        if (error.code === 'PGRST116') {
          return createErrorResponse('Project not found', 'NOT_FOUND', 404);
        }
        return createErrorResponse('Failed to fetch project', 'FETCH_FAILED');
      }

      return createSuccessResponse(project);
    }

    // PUT /projects/:id
    if (method === 'PUT' && normalizedPath.match(/^\/projects\/[^\/]+$/)) {
      const params = extractPathParams(normUrl, '/projects/:id');
      const projectId = params.id;
      const updateData: UpdateProjectRequest = await parseRequestBody(req);

      // Check if user has permission to update this project
      const { data: existingProject, error: fetchError } = await db
        .from('projects')
        .select('created_by')
        .eq('id', projectId)
        .single();

      if (fetchError) {
        return createErrorResponse('Project not found', 'NOT_FOUND', 404);
      }

      // Check if user is the creator or has admin role
      const { data: userRoles } = await db
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = userRoles?.some(r => r.role === 'admin');
      const isCreator = existingProject.created_by === user.id;

      if (!isAdmin && !isCreator) {
        return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);
      }

      const { data: project, error } = await db
        .from('projects')
        .update({
          name: updateData.name,
          description: updateData.description,
          start_date: updateData.startDate,
          end_date: updateData.endDate,
          priority: updateData.priority,
          status: updateData.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .select('*')
        .single();

      if (error) {
        console.error('Update project error:', error);
        return createErrorResponse('Failed to update project', 'UPDATE_FAILED');
      }

      return createSuccessResponse(project);
    }

    // DELETE /projects/:id
    if (method === 'DELETE' && normalizedPath.match(/^\/projects\/[^\/]+$/)) {
      const params = extractPathParams(normUrl, '/projects/:id');
      const projectId = params.id;

      // Check if user has admin role for deletion
      const { data: userRoles } = await db
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = userRoles?.some(r => r.role === 'admin');

      if (!isAdmin) {
        return createErrorResponse('Admin access required for deletion', 'FORBIDDEN', 403);
      }

      const { error } = await db
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        console.error('Delete project error:', error);
        return createErrorResponse('Failed to delete project', 'DELETE_FAILED');
      }

      return createSuccessResponse({ message: 'Project deleted successfully' });
    }

    // GET /stats - Get project statistics (admin only)
    if (method === 'GET' && normalizedPath.endsWith('/stats')) {
      try {
        // Check if user is admin
        const { data: isAdmin } = await db
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single();

        if (!isAdmin) {
          return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);
        }

        // Fetch project stats
        const { data: projectData, error: projectError } = await db
          .from('projects')
          .select('status');

        if (projectError) {
          console.error('Error fetching project stats:', projectError);
          return createErrorResponse('Failed to fetch project stats', 'FETCH_ERROR');
        }

        const totalProjects = projectData?.length || 0;
        const activeProjects = projectData?.filter(p => p.status === 'active').length || 0;
        const completedProjects = projectData?.filter(p => p.status === 'completed').length || 0;

        // Fetch user count
        const { count: userCount, error: userError } = await db
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (userError) {
          console.error('Error fetching user count:', userError);
          return createErrorResponse('Failed to fetch user count', 'FETCH_ERROR');
        }

        return createSuccessResponse({
          totalProjects,
          activeProjects,
          completedProjects,
          totalUsers: userCount || 0
        });
      } catch (error) {
        console.error('Error in stats endpoint:', error);
        return createErrorResponse('Internal server error', 'INTERNAL_ERROR', 500);
      }
    }

    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);

  } catch (error) {
    console.error('Projects service error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
});