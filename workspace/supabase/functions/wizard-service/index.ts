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
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  logRequest(method, path);

  try {
    // Create user-authenticated client for proper audit logging
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authHeader}` } }
    });

    const { user, error: authError } = await validateAuthToken(req, userSupabase);
    if (authError || !user) return createErrorResponse('Authentication required', 'UNAUTHORIZED', 401);

    // POST /wizard-service/projects/wizard/start
    if (method === 'POST' && path.endsWith('/projects/wizard/start')) {
      const body = await parseRequestBody(req);
      const sessionId = crypto.randomUUID();

      return createSuccessResponse({
        message: 'Wizard started',
        sessionId,
        seed: body || {},
      });
    }

    // POST /wizard-service/projects/wizard/complete
    if (method === 'POST' && path.endsWith('/projects/wizard/complete')) {
      const body = await parseRequestBody(req);
      const { name, description, startDate, endDate, priority, status, departmentId } = body || {};

      if (!name) return createErrorResponse('name is required', 'MISSING_FIELDS');

      const { data: project, error } = await userSupabase
        .from('projects')
        .insert({
          name,
          description: description || null,
          start_date: startDate || null,
          end_date: endDate || null,
          priority: priority || 'medium',
          status: status || 'planning',
          department_id: departmentId || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating project from wizard:', error);
        return createErrorResponse('Failed to create project', 'CREATE_ERROR');
      }

      return createSuccessResponse({ message: 'Project created', project });
    }

    // POST /wizard-service/projects/create - Create project with wizard data
    if (method === 'POST' && path.endsWith('/projects/create')) {
      const body = await parseRequestBody(req);
      const {
        name,
        projectName,
        objective,
        startDate,
        endDate,
        tasks,
        milestones,
        inviteEmails
      } = body;

      const finalProjectName = projectName || name;
      if (!finalProjectName || !objective) {
        return createErrorResponse('Project name and objective are required', 'MISSING_DATA');
      }

      const { data: project, error: projectError } = await userSupabase
        .from('projects')
        .insert({
          name: finalProjectName,
          description: objective,
          start_date: startDate,
          end_date: endDate,
          created_by: user.id,
          status: 'planning'
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create milestones
      if (milestones && milestones.length > 0) {
        const milestonesWithProjectId = milestones.map(milestone => ({
          name: milestone.name,
          due_date: milestone.dueDate,
          status: milestone.status || 'planning',
          project_id: project.id,
          created_by: user.id
        }));

        const { data: createdMilestones, error: milestoneError } = await userSupabase
          .from('milestones')
          .insert(milestonesWithProjectId)
          .select();

        if (milestoneError) throw milestoneError;

        // Create tasks with milestone assignments
        if (tasks && tasks.length > 0) {
          const tasksToCreate = [];
          for (const milestone of milestones) {
            const createdMilestone = createdMilestones.find(m => m.name === milestone.name);
            if (createdMilestone) {
              for (const task of milestone.tasks) {
                tasksToCreate.push({
                  title: task.title,
                  description: task.description,
                  due_date: task.dueDate,
                  status: task.status || 'todo',
                  priority: task.priority || 'medium',
                  milestone_id: createdMilestone.id,
                  project_id: project.id,
                  created_by: user.id
                });
              }
            }
          }

          if (tasksToCreate.length > 0) {
            const { error: taskError } = await userSupabase
              .from('tasks')
              .insert(tasksToCreate);

            if (taskError) throw taskError;
          }
        }
      }

      return createSuccessResponse({
        project,
        message: `${finalProjectName} has been created with ${tasks?.length || 0} tasks across ${milestones?.length || 0} milestones.`
      });
    }

    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);
  } catch (error) {
    console.error('Wizard service error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
});