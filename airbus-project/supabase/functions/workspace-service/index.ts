import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createSuccessResponse,
  createErrorResponse,
  handleCorsOptions,
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
    .select('id, module, access_level')
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (modulePerm && modulePerm.length > 0) return { ok: true };

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

    // GET /workspace-service/projects/:id/workspace
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/workspace')) {
      const params = extractPathParams(url, '/workspace-service/projects/:id/workspace');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      // Summary counts
      const [tasksCountRes, milestonesCountRes, risksCountRes, retrosCountRes] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('milestones').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('risk_register').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('retrospectives').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      ]);

      const summary = {
        tasks: tasksCountRes.count || 0,
        milestones: milestonesCountRes.count || 0,
        risks: risksCountRes.count || 0,
        retrospectives: retrosCountRes.count || 0,
      };

      // Recent items
      const [{ data: recentTasks }, { data: upcomingMilestones }] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, updated_at')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('milestones')
          .select('id, name, status, due_date')
          .eq('project_id', projectId)
          .order('due_date', { ascending: true })
          .limit(5),
      ]);

      return createSuccessResponse({
        projectId,
        summary,
        recentTasks: recentTasks || [],
        upcomingMilestones: upcomingMilestones || [],
      });
    }

    // GET /workspace-service/projects/:id/risks
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/risks')) {
      const params = extractPathParams(url, '/workspace-service/projects/:id/risks');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: risks, error } = await supabaseAuth
        .from('risk_register')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching risks:', error);
        return createErrorResponse('Failed to fetch risks', 'FETCH_ERROR');
      }

      return createSuccessResponse(risks || []);
    }

    // POST /workspace-service/projects/:id/risks
    if (method === 'POST' && path.includes('/projects/') && path.endsWith('/risks')) {
      const params = extractPathParams(url, '/workspace-service/projects/:id/risks');
      const projectId = params.id;
      const riskData = await req.json();

      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: risk, error } = await supabaseAuth
        .from('risk_register')
        .insert({
          ...riskData,
          project_id: projectId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating risk:', error);
        return createErrorResponse('Failed to create risk', 'CREATE_ERROR');
      }

      return createSuccessResponse({ message: 'Risk created successfully', risk });
    }

    // PUT /workspace-service/projects/:id/risks/:riskId
    if (method === 'PUT' && path.includes('/risks/') && !path.endsWith('/risks')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const riskIdIndex = pathParts.findIndex(part => part === 'risks') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const riskId = pathParts[riskIdIndex];
      const riskData = await req.json();

      if (!projectId || !riskId) return createErrorResponse('Project ID and Risk ID are required', 'MISSING_IDS');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: risk, error } = await supabaseAuth
        .from('risk_register')
        .update(riskData)
        .eq('id', riskId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) {
        console.error('Error updating risk:', error);
        return createErrorResponse('Failed to update risk', 'UPDATE_ERROR');
      }

      return createSuccessResponse({ message: 'Risk updated successfully', risk });
    }

    // DELETE /workspace-service/projects/:id/risks/:riskId
    if (method === 'DELETE' && path.includes('/risks/') && !path.endsWith('/risks')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const riskIdIndex = pathParts.findIndex(part => part === 'risks') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const riskId = pathParts[riskIdIndex];

      if (!projectId || !riskId) return createErrorResponse('Project ID and Risk ID are required', 'MISSING_IDS');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { error } = await supabaseAuth
        .from('risk_register')
        .delete()
        .eq('id', riskId)
        .eq('project_id', projectId);

      if (error) {
        console.error('Error deleting risk:', error);
        return createErrorResponse('Failed to delete risk', 'DELETE_ERROR');
      }

      return createSuccessResponse({ message: 'Risk deleted successfully' });
    }

    // GET /workspace-service/projects/:id/discussions
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/discussions')) {
      const params = extractPathParams(url, '/workspace-service/projects/:id/discussions');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: discussions, error } = await supabaseAuth
        .from('project_discussions')
        .select('*')
        .eq('project_id', projectId)
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error fetching discussions:', error);
        return createErrorResponse('Failed to fetch discussions', 'FETCH_ERROR');
      }

      return createSuccessResponse(discussions || []);
    }

    // POST /workspace-service/projects/:id/discussions
    if (method === 'POST' && path.includes('/projects/') && path.endsWith('/discussions')) {
      const params = extractPathParams(url, '/workspace-service/projects/:id/discussions');
      const projectId = params.id;
      const discussionData = await req.json();

      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: discussion, error } = await supabaseAuth
        .from('project_discussions')
        .insert({
          ...discussionData,
          project_id: projectId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating discussion:', error);
        return createErrorResponse('Failed to create discussion', 'CREATE_ERROR');
      }

      return createSuccessResponse({ message: 'Discussion created successfully', discussion });
    }

    // GET /workspace-service/projects/:id/action-items
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/action-items')) {
      const params = extractPathParams(url, '/workspace-service/projects/:id/action-items');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: actionItems, error } = await supabaseAuth
        .from('discussion_action_items')
        .select(`
          *,
          project_discussions!inner(project_id)
        `)
        .eq('project_discussions.project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching action items:', error);
        return createErrorResponse('Failed to fetch action items', 'FETCH_ERROR');
      }

      return createSuccessResponse(actionItems || []);
    }

    // GET /workspace-service/projects/:id/tasks
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/tasks')) {
      const params = extractPathParams(url, '/workspace-service/projects/:id/tasks');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        return createErrorResponse('Failed to fetch tasks', 'FETCH_ERROR');
      }

      return createSuccessResponse(tasks || []);
    }

    // POST /workspace-service/projects/:id/tasks  
    if (method === 'POST' && path.includes('/projects/') && path.endsWith('/tasks')) {
      const params = extractPathParams(url, '/workspace-service/projects/:id/tasks');
      const projectId = params.id;
      const rawTask = await req.json();
      const taskData: Record<string, any> = { ...rawTask };
      
      console.log('Creating task with raw data:', rawTask);
      
      // Normalize camelCase -> snake_case fields commonly sent by the UI
      if (taskData.milestoneId && !taskData.milestone_id) taskData.milestone_id = taskData.milestoneId;
      if (taskData.dueDate && !taskData.due_date) taskData.due_date = taskData.dueDate;
      if (taskData.ownerId && !taskData.owner_id) taskData.owner_id = taskData.ownerId;
      
      // Convert empty strings to null for nullable fields, but preserve valid milestone_id
      ['description', 'due_date', 'owner_id'].forEach((k) => {
        if (typeof taskData[k] === 'string' && taskData[k].trim() === '') taskData[k] = null;
      });
      
      // Handle milestone_id - keep valid IDs intact, only null out truly empty values
      if (!taskData.milestone_id || taskData.milestone_id === '' || taskData.milestone_id === 'null' || taskData.milestone_id === 'undefined') {
        taskData.milestone_id = null;
      }

      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }
      
      const { data: task, error } = await supabaseAuth
        .from('tasks')
        .insert({
          ...taskData,
          project_id: projectId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating task:', error);
        return createErrorResponse('Failed to create task', 'CREATE_ERROR');
      }

      return createSuccessResponse({ message: 'Task created successfully', task });
    }

    // PUT /workspace-service/tasks/:taskId
    if (method === 'PUT' && path.includes('/tasks/') && !path.includes('/projects/')) {
      const pathParts = path.split('/');
      const taskIdIndex = pathParts.findIndex(part => part === 'tasks') + 1;
      const taskId = pathParts[taskIdIndex];
      const rawData = await req.json();

      if (!taskId) return createErrorResponse('Task ID is required', 'MISSING_TASK_ID');

      // Check if user has access to the project that owns this task
      const { data: task } = await supabase
        .from('tasks')
        .select('project_id, status')
        .eq('id', taskId)
        .single();

      if (!task) return createErrorResponse('Task not found', 'TASK_NOT_FOUND', 404);

      const access = await hasProjectAccess(user.id, task.project_id);
      if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);

      // Sanitize and whitelist updatable fields (convert empty strings to null for nullable columns)
      const allowedFields = ['title', 'description', 'status', 'priority', 'due_date', 'owner_id', 'milestone_id'] as const;
      const taskData: Record<string, any> = {};
      for (const key of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(rawData, key)) {
          let value = (rawData as any)[key];
          if (typeof value === 'string' && value.trim() === '') {
            // Convert empty strings to null for date/uuid/text nullable fields
            value = null;
          }
          taskData[key] = value;
        }
      }

      const { data: updatedTask, error } = await supabaseAuth
        .from('tasks')
        .update(taskData)
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.error('Error updating task:', error);
        return createErrorResponse('Failed to update task', 'UPDATE_ERROR');
      }
      // If status changed, log it explicitly to history with the acting user
      try {
        const oldStatus = task.status;
        const newStatus = updatedTask.status;
        if (typeof taskData.status !== 'undefined' && oldStatus !== newStatus) {
          const { error: histErr } = await supabaseAuth
            .from('task_status_history')
            .insert({
              task_id: taskId,
              old_status: oldStatus,
              new_status: newStatus,
              changed_by: user.id,
            });
          if (histErr) {
            console.error('Failed to insert task_status_history:', histErr);
          }
        }
      } catch (e) {
        console.error('Unexpected error while logging status history:', e);
      }

      return createSuccessResponse({ message: 'Task updated successfully', task: updatedTask });
    }

    // DELETE /workspace-service/tasks/:taskId
    if (method === 'DELETE' && path.includes('/tasks/') && !path.includes('/projects/')) {
      const pathParts = path.split('/');
      const taskIdIndex = pathParts.findIndex(part => part === 'tasks') + 1;
      const taskId = pathParts[taskIdIndex];

      if (!taskId) return createErrorResponse('Task ID is required', 'MISSING_TASK_ID');

      const { data: task } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', taskId)
        .maybeSingle();

      if (!task) return createErrorResponse('Task not found', 'TASK_NOT_FOUND', 404);

      const access = await hasProjectAccess(user.id, task.project_id);
      if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);

      const { error } = await supabaseAuth
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Error deleting task:', error);
        return createErrorResponse('Failed to delete task', 'DELETE_ERROR');
      }

      return createSuccessResponse({ message: 'Task deleted successfully' });
    }

    // PUT /workspace-service/tasks/:taskId/move
    if (method === 'PUT' && path.includes('/tasks/') && path.endsWith('/move')) {
      const pathParts = path.split('/');
      const taskIdIndex = pathParts.findIndex(part => part === 'tasks') + 1;
      const taskId = pathParts[taskIdIndex];
      const { milestone_id } = await req.json();

      if (!taskId) return createErrorResponse('Task ID is required', 'MISSING_TASK_ID');
      if (!milestone_id) return createErrorResponse('milestone_id is required', 'MISSING_FIELDS');

      const { data: task } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', taskId)
        .maybeSingle();

      if (!task) return createErrorResponse('Task not found', 'TASK_NOT_FOUND', 404);

      const access = await hasProjectAccess(user.id, task.project_id);
      if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);

      const { error } = await supabaseAuth
        .from('tasks')
        .update({ milestone_id })
        .eq('id', taskId);

      if (error) {
        console.error('Error moving task:', error);
        return createErrorResponse('Failed to move task', 'MOVE_ERROR');
      }

      return createSuccessResponse({ message: 'Task moved successfully' });
    }

    // GET /workspace-service/tasks/:taskId/history
    if (method === 'GET' && path.includes('/tasks/') && (path.endsWith('/history') || path.endsWith('/status-history'))) {
      const pathParts = path.split('/');
      const taskIdIndex = pathParts.findIndex(part => part === 'tasks') + 1;
      const taskId = pathParts[taskIdIndex];

      if (!taskId) return createErrorResponse('Task ID is required', 'MISSING_TASK_ID');

      // Check if user has access to the project that owns this task
      const { data: task } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', taskId)
        .single();

      if (!task) return createErrorResponse('Task not found', 'TASK_NOT_FOUND', 404);

      const access = await hasProjectAccess(user.id, task.project_id);
      if (!access.ok) return createErrorResponse('Insufficient permissions', 'FORBIDDEN', 403);

      const { data: history, error } = await supabase
        .from('task_status_history')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching task history:', error);
        return createErrorResponse('Failed to fetch task history', 'FETCH_ERROR');
      }

      // Enrich with user names without requiring FK
      const entries = history || [];
      const userIds = Array.from(new Set(entries.map((e: any) => e.changed_by).filter((v: string | null) => !!v)));
      let namesById: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesList, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        if (profErr) {
          console.error('Error fetching profiles for history:', profErr);
        } else if (profilesList) {
          namesById = Object.fromEntries(profilesList.map((p: any) => [p.id, p.full_name || p.email]));
        }
      }

      const transformedHistory = entries.map((entry: any) => ({
        ...entry,
        user_name: namesById[entry.changed_by] || 'Unknown User',
      }));

      return createSuccessResponse(transformedHistory);
    }

    // GET /workspace-service/projects/:id/milestones
    if (method === 'GET' && path.includes('/projects/') && path.endsWith('/milestones')) {
      const params = extractPathParams(url, '/workspace-service/projects/:id/milestones');
      const projectId = params.id;
      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: milestones, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching milestones:', error);
        return createErrorResponse('Failed to fetch milestones', 'FETCH_ERROR');
      }

      return createSuccessResponse(milestones || []);
    }

    // PUT /workspace-service/projects/:id/discussions/:discussionId
    if (method === 'PUT' && path.includes('/discussions/') && !path.endsWith('/discussions')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const discussionIdIndex = pathParts.findIndex(part => part === 'discussions') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const discussionId = pathParts[discussionIdIndex];
      const discussionData = await req.json();

      if (!projectId || !discussionId) return createErrorResponse('Project ID and Discussion ID are required', 'MISSING_IDS');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: discussion, error } = await supabaseAuth
        .from('project_discussions')
        .update(discussionData)
        .eq('id', discussionId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) {
        console.error('Error updating discussion:', error);
        return createErrorResponse('Failed to update discussion', 'UPDATE_ERROR');
      }

      return createSuccessResponse({ message: 'Discussion updated successfully', discussion });
    }

    // DELETE /workspace-service/projects/:id/discussions/:discussionId
    if (method === 'DELETE' && path.includes('/discussions/') && !path.endsWith('/discussions')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const discussionIdIndex = pathParts.findIndex(part => part === 'discussions') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const discussionId = pathParts[discussionIdIndex];

      if (!projectId || !discussionId) return createErrorResponse('Project ID and Discussion ID are required', 'MISSING_IDS');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { error } = await supabaseAuth
        .from('project_discussions')
        .delete()
        .eq('id', discussionId)
        .eq('project_id', projectId);

      if (error) {
        console.error('Error deleting discussion:', error);
        return createErrorResponse('Failed to delete discussion', 'DELETE_ERROR');
      }

      return createSuccessResponse({ message: 'Discussion deleted successfully' });
    }

    // POST /workspace-service/projects/:id/action-items
    if (method === 'POST' && path.includes('/projects/') && path.endsWith('/action-items')) {
      const params = extractPathParams(url, '/workspace-service/projects/:id/action-items');
      const projectId = params.id;
      const actionItemData = await req.json();

      if (!projectId) return createErrorResponse('Project ID is required', 'MISSING_PROJECT_ID');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      // Need a discussion_id for action items
      if (!actionItemData.discussion_id) {
        return createErrorResponse('discussion_id is required for action items', 'MISSING_DISCUSSION_ID');
      }

      const { data: actionItem, error } = await supabaseAuth
        .from('discussion_action_items')
        .insert({
          ...actionItemData,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating action item:', error);
        return createErrorResponse('Failed to create action item', 'CREATE_ERROR');
      }

      return createSuccessResponse({ message: 'Action item created successfully', actionItem });
    }

    // PUT /workspace-service/projects/:id/action-items/:actionItemId
    if (method === 'PUT' && path.includes('/action-items/') && !path.endsWith('/action-items')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const actionItemIdIndex = pathParts.findIndex(part => part === 'action-items') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const actionItemId = pathParts[actionItemIdIndex];
      const actionItemData = await req.json();

      if (!projectId || !actionItemId) return createErrorResponse('Project ID and Action Item ID are required', 'MISSING_IDS');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { data: actionItem, error } = await supabaseAuth
        .from('discussion_action_items')
        .update(actionItemData)
        .eq('id', actionItemId)
        .select()
        .single();

      if (error) {
        console.error('Error updating action item:', error);
        return createErrorResponse('Failed to update action item', 'UPDATE_ERROR');
      }

      return createSuccessResponse({ message: 'Action item updated successfully', actionItem });
    }

    // DELETE /workspace-service/projects/:id/action-items/:actionItemId
    if (method === 'DELETE' && path.includes('/action-items/') && !path.endsWith('/action-items')) {
      const pathParts = path.split('/');
      const projectIdIndex = pathParts.findIndex(part => part === 'projects') + 1;
      const actionItemIdIndex = pathParts.findIndex(part => part === 'action-items') + 1;
      
      const projectId = pathParts[projectIdIndex];
      const actionItemId = pathParts[actionItemIdIndex];

      if (!projectId || !actionItemId) return createErrorResponse('Project ID and Action Item ID are required', 'MISSING_IDS');

      const access = await hasProjectAccess(user.id, projectId);
      if (!access.ok) {
        const status = access.reason === 'PROJECT_NOT_FOUND' ? 404 : 403;
        return createErrorResponse(access.reason === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Insufficient permissions', access.reason, status);
      }

      const { error } = await supabaseAuth
        .from('discussion_action_items')
        .delete()
        .eq('id', actionItemId);

      if (error) {
        console.error('Error deleting action item:', error);
        return createErrorResponse('Failed to delete action item', 'DELETE_ERROR');
      }

      return createSuccessResponse({ message: 'Action item deleted successfully' });
    }

    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);
  } catch (error) {
    console.error('Workspace service error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
});