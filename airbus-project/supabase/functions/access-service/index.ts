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

interface ModulePermissionRequest {
  userId: string;
  module: string;
  accessLevel: 'read' | 'write';
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
    // Validate authentication for all endpoints
    const { user, error: authError } = await validateAuthToken(req, supabase);
    if (authError || !user) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED', 401);
    }

    // GET /access-service/projects/:id/access - Get module permissions for a project
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/access')) {
      const params = extractPathParams(url, '/access-service/projects/:id/access');
      const projectId = params.id;

      if (!projectId) {
        return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');
      }

      // Check if user has access to this project
      const { data: project } = await supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', projectId)
        .single();

      if (!project) {
        return createErrorResponse('Project not found', 'PROJECT_NOT_FOUND', 404);
      }

      // Get all module permissions for this project
      const { data: permissions, error } = await supabase
        .from('module_permissions')
        .select(`
          id,
          user_id,
          module,
          access_level,
          granted_by,
          created_at,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .eq('project_id', projectId);

      if (error) {
        console.error('Error fetching permissions:', error);
        return createErrorResponse('Failed to fetch permissions', 'FETCH_ERROR');
      }

      return createSuccessResponse({
        projectId,
        permissions: permissions || [],
      });
    }

    // GET /access-service/projects/:id/permissions - Alternative endpoint for compatibility
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/permissions')) {
      const params = extractPathParams(url, '/access-service/projects/:id/permissions');
      const projectId = params.id;

      if (!projectId) {
        return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');
      }

      // Check if user has access to this project
      const { data: project } = await supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', projectId)
        .single();

      if (!project) {
        return createErrorResponse('Project not found', 'PROJECT_NOT_FOUND', 404);
      }

      // Get all module permissions for this project
      const { data: permissions, error } = await supabase
        .from('module_permissions')
        .select(`
          id,
          user_id,
          module,
          access_level,
          granted_by,
          created_at,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .eq('project_id', projectId);

      if (error) {
        console.error('Error fetching permissions:', error);
        return createErrorResponse('Failed to fetch permissions', 'FETCH_ERROR');
      }

      return createSuccessResponse(permissions || []);
    }

    // POST /access-service/projects/:id/access - Grant module permission
    if (method === 'POST' && path.includes('/projects/') && path.endsWith('/access')) {
      const params = extractPathParams(url, '/access-service/projects/:id/access');
      const projectId = params.id;
      const { userId, module, accessLevel }: ModulePermissionRequest = await parseRequestBody(req);

      if (!projectId || !userId || !module || !accessLevel) {
        return createErrorResponse('Missing required fields', 'MISSING_FIELDS');
      }

      // Check if user has permission to manage access for this project
      const { data: project } = await supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', projectId)
        .single();

      if (!project) {
        return createErrorResponse('Project not found', 'PROJECT_NOT_FOUND', 404);
      }

      // Check if the requesting user is project owner or admin
      const { data: isAdmin } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (project.created_by !== user.id && !isAdmin) {
        return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);
      }

      // Check if target user exists
      const { data: targetUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!targetUser) {
        return createErrorResponse('User not found', 'USER_NOT_FOUND', 404);
      }

      // Insert or update permission
      const { data: permission, error } = await supabase
        .from('module_permissions')
        .upsert({
          project_id: projectId,
          user_id: userId,
          module,
          access_level: accessLevel,
          granted_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error granting permission:', error);
        return createErrorResponse('Failed to grant permission', 'GRANT_ERROR');
      }

      return createSuccessResponse({
        message: 'Permission granted successfully',
        permission,
      });
    }

    // PUT /access-service/projects/:id/access/:userId - Update user's module permission
    if (method === 'PUT' && path.includes('/projects/') && path.includes('/access/')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const userIdIndex = pathParts.findIndex(part => part === 'access') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const targetUserId = pathParts[userIdIndex];
      const { module, accessLevel }: { module: string; accessLevel: 'read' | 'write' } = await parseRequestBody(req);

      if (!projectId || !targetUserId || !module || !accessLevel) {
        return createErrorResponse('Missing required fields', 'MISSING_FIELDS');
      }

      // Check if user has permission to manage access for this project
      const { data: project } = await supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', projectId)
        .single();

      if (!project) {
        return createErrorResponse('Project not found', 'PROJECT_NOT_FOUND', 404);
      }

      // Check if the requesting user is project owner or admin
      const { data: isAdmin } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (project.created_by !== user.id && !isAdmin) {
        return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);
      }

      // Update permission
      const { data: permission, error } = await supabase
        .from('module_permissions')
        .update({
          access_level: accessLevel,
          granted_by: user.id,
        })
        .eq('project_id', projectId)
        .eq('user_id', targetUserId)
        .eq('module', module)
        .select()
        .single();

      if (error) {
        console.error('Error updating permission:', error);
        return createErrorResponse('Failed to update permission', 'UPDATE_ERROR');
      }

      return createSuccessResponse({
        message: 'Permission updated successfully',
        permission,
      });
    }

    // DELETE /access-service/projects/:id/access/:userId - Revoke user's module permission
    if (method === 'DELETE' && path.includes('/projects/') && path.includes('/access/')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const userIdIndex = pathParts.findIndex(part => part === 'access') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const targetUserId = pathParts[userIdIndex];
      const module = url.searchParams.get('module');

      if (!projectId || !targetUserId || !module) {
        return createErrorResponse('Missing required fields', 'MISSING_FIELDS');
      }

      // Check if user has permission to manage access for this project
      const { data: project } = await supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', projectId)
        .single();

      if (!project) {
        return createErrorResponse('Project not found', 'PROJECT_NOT_FOUND', 404);
      }

      // Check if the requesting user is project owner or admin
      const { data: isAdmin } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (project.created_by !== user.id && !isAdmin) {
        return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);
      }

      // Delete permission
      const { error } = await supabase
        .from('module_permissions')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', targetUserId)
        .eq('module', module);

      if (error) {
        console.error('Error revoking permission:', error);
        return createErrorResponse('Failed to revoke permission', 'REVOKE_ERROR');
      }

      return createSuccessResponse({
        message: 'Permission revoked successfully',
      });
    }

    // POST /access-service/permissions/grant - Grant permission by email (ApiClient compatible)
    if (method === 'POST' && path.endsWith('/permissions/grant')) {
      const { projectId, userEmail, module, accessLevel } = await parseRequestBody(req);

      if (!projectId || !userEmail || !module || !accessLevel) {
        return createErrorResponse('Missing required fields', 'MISSING_FIELDS');
      }

      // Check if user has permission to manage access for this project
      const { data: project } = await supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', projectId)
        .single();

      if (!project) {
        return createErrorResponse('Project not found', 'PROJECT_NOT_FOUND', 404);
      }

      // Check if the requesting user is project owner or admin
      const { data: isAdmin } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (project.created_by !== user.id && !isAdmin) {
        return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);
      }

      // Find user by email
      const { data: targetUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (!targetUser) {
        return createErrorResponse('User not found', 'USER_NOT_FOUND', 404);
      }

      // Insert or update permission
      const { data: permission, error } = await supabase
        .from('module_permissions')
        .upsert({
          project_id: projectId,
          user_id: targetUser.id,
          module,
          access_level: accessLevel,
          granted_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error granting permission:', error);
        return createErrorResponse('Failed to grant permission', 'GRANT_ERROR');
      }

      return createSuccessResponse({
        message: 'Permission granted successfully',
        permission,
      });
    }

    // DELETE /access-service/permissions/:permissionId/revoke - Revoke permission by ID (ApiClient compatible)
    if (method === 'DELETE' && path.includes('/permissions/') && path.endsWith('/revoke')) {
      const pathParts = path.split('/');
      const permissionIdIndex = pathParts.findIndex(part => part === 'permissions') + 1;
      const permissionId = pathParts[permissionIdIndex];

      if (!permissionId) {
        return createErrorResponse('Permission ID is required', 'MISSING_PERMISSION_ID');
      }

      // Get permission details
      const { data: permission } = await supabase
        .from('module_permissions')
        .select('project_id')
        .eq('id', permissionId)
        .single();

      if (!permission) {
        return createErrorResponse('Permission not found', 'PERMISSION_NOT_FOUND', 404);
      }

      // Check if user has permission to manage access for this project
      const { data: project } = await supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', permission.project_id)
        .single();

      if (!project) {
        return createErrorResponse('Project not found', 'PROJECT_NOT_FOUND', 404);
      }

      // Check if the requesting user is project owner or admin
      const { data: isAdmin } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (project.created_by !== user.id && !isAdmin) {
        return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);
      }

      // Delete permission
      const { error } = await supabase
        .from('module_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) {
        console.error('Error revoking permission:', error);
        return createErrorResponse('Failed to revoke permission', 'REVOKE_ERROR');
      }

      return createSuccessResponse({
        message: 'Permission revoked successfully',
      });
    }

    // POST /log-access - Log module access
    if (method === 'POST' && path.endsWith('/log-access')) {
      const {
        userId,
        projectId,
        module,
        accessType,
        accessLevel
      } = await parseRequestBody(req);

      try {
        await supabase.rpc('log_module_access', {
          _user_id: userId,
          _project_id: projectId,
          _module: module,
          _access_type: accessType,
          _access_level: accessLevel
        });

        return createSuccessResponse({ message: 'Access logged successfully' });
      } catch (error) {
        console.error('Error logging module access:', error);
        return createErrorResponse('Failed to log access', 'LOG_FAILED');
      }
    }

    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);

  } catch (error) {
    console.error('Access service error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
});