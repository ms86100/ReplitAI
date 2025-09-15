import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get user from auth header
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const url = new URL(req.url);
    const normalizedPath = url.pathname
      .replace(/^\/functions\/v1\/capacity-service/, '')
      .replace(/^\/capacity-service/, '') || '/';
    const pathParts = normalizedPath.split('/').filter(Boolean);
    console.log(`[${req.method}] ${normalizedPath} - User: ${user.id}`);

    if (req.method === 'GET') {
      // GET /projects/:projectId/teams
      if (pathParts[0] === 'projects' && pathParts[2] === 'teams') {
        const projectId = pathParts[1];
        
        const { data: teams, error } = await supabase
          .from('teams')
          .select(`
            id,
            name,
            description,
            project_id,
            created_at
          `)
          .eq('project_id', projectId);

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Get member counts for each team
        const teamsWithCounts = [];
        for (const team of teams || []) {
          const { count } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id);
            
          teamsWithCounts.push({
            ...team,
            member_count: count || 0
          });
        }

        return new Response(
          JSON.stringify({ success: true, data: teamsWithCounts }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /projects/:projectId/capacity
      if (pathParts[0] === 'projects' && pathParts[2] === 'capacity' && pathParts.length === 3) {
        const projectId = pathParts[1];

        const { data: iterations, error } = await supabase
          .from('iterations')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const summary = {
          totalIterations: iterations?.length || 0,
          totalCapacity: (iterations || []).reduce((acc: number, it: any) => acc + (it.weeks_count || 0), 0)
        };

        return new Response(
          JSON.stringify({ success: true, data: { projectId, iterations: iterations || [], summary } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /teams/:teamId/members
      if (pathParts[0] === 'teams' && pathParts[2] === 'members') {
        const teamId = pathParts[1];
        
        const { data: members, error } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', teamId);

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: members || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /projects/:projectId/iterations
      if (pathParts[0] === 'projects' && pathParts[2] === 'iterations') {
        const projectId = pathParts[1];
        
        const { data: iterations, error } = await supabase
          .from('iterations')
          .select(`
            id,
            name,
            type,
            project_id,
            team_id,
            start_date,
            end_date,
            weeks_count,
            created_at
          `)
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Get team names
        const iterationsWithTeamNames = [];
        for (const iteration of iterations || []) {
          const { data: team } = await supabase
            .from('teams')
            .select('name')
            .eq('id', iteration.team_id)
            .single();
            
          iterationsWithTeamNames.push({
            ...iteration,
            team_name: team?.name || 'Unknown Team'
          });
        }

        return new Response(
          JSON.stringify({ success: true, data: iterationsWithTeamNames }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /iterations/:iterationId/availability
      if (pathParts[0] === 'iterations' && pathParts[2] === 'availability') {
        const iterationId = pathParts[1];
        console.log(`[GET] /iterations/${iterationId}/availability - User: ${user.id}`);
        
        // Get iteration with weeks
        const { data: iteration, error: iterationError } = await supabase
          .from('iterations')
          .select(`
            *,
            iteration_weeks (
              id,
              week_index,
              week_start,
              week_end
            )
          `)
          .eq('id', iterationId)
          .single();

        if (iterationError) {
          return new Response(
            JSON.stringify({ success: false, error: iterationError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Get team members with proper name handling
        const { data: teamMembers, error: membersError } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', iteration.team_id);

        if (membersError) {
          return new Response(
            JSON.stringify({ success: false, error: membersError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Get team name
        const { data: team } = await supabase
          .from('teams')
          .select('name')
          .eq('id', iteration.team_id)
          .single();

        // Get availability data for each member and week
        const availability = [];
        for (const member of teamMembers || []) {
          // Use display_name with fallback to other name fields
          const memberName = member.display_name || member.member_name || member.name || 'Unknown Member';
          
          for (const week of iteration.iteration_weeks || []) {
            const { data: weekAvailability } = await supabase
              .from('member_weekly_availability')
              .select('*')
              .eq('team_member_id', member.id)
              .eq('iteration_week_id', week.id)
              .single();

            availability.push({
              team_member_id: member.id,
              member_name: memberName,
              iteration_week_id: week.id,
              week_index: week.week_index,
              week_start: week.week_start,
              week_end: week.week_end,
              availability_percent: weekAvailability?.availability_percent || 100,
              leaves: weekAvailability?.leaves || 0,
              effective_capacity: weekAvailability?.effective_capacity || 0
            });
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              iteration: {
                ...iteration,
                team_name: team?.name || 'Unknown Team'
              },
              team_members: (teamMembers || []).map(member => ({
                ...member,
                display_name: member.display_name || member.member_name || member.name || 'Unknown Member'
              })),
              availability
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /iterations/:iterationId/weeks
      if (pathParts[0] === 'iterations' && pathParts[2] === 'weeks') {
        const iterationId = pathParts[1];
        console.log(`[GET] /iterations/${iterationId}/weeks - User: ${user.id}`);
        
        const { data, error } = await supabase
          .from('iteration_weeks')
          .select('*')
          .eq('iteration_id', iterationId)
          .order('week_index');
        
        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true, data: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /iterations/:iterationId
      if (pathParts[0] === 'iterations' && pathParts.length === 2) {
        const iterationId = pathParts[1];
        
        // Get iteration details
        const { data: iteration, error: iterationError } = await supabase
          .from('iterations')
          .select('*')
          .eq('id', iterationId)
          .single();

        if (iterationError) {
          return new Response(
            JSON.stringify({ success: false, error: iterationError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Get iteration weeks
        const { data: weeks, error: weeksError } = await supabase
          .from('iteration_weeks')
          .select('*')
          .eq('iteration_id', iterationId)
          .order('week_index');

        // Get weekly availability
        const { data: availability, error: availabilityError } = await supabase
          .from('member_weekly_availability')
          .select('*')
          .in('iteration_week_id', weeks?.map(w => w.id) || []);

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: {
              iteration,
              weeks: weeks || [],
              availability: availability || []
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (req.method === 'POST') {
      const body = await req.json();

      // POST /projects/:projectId/capacity (create iteration/member)
      if (pathParts[0] === 'projects' && pathParts[2] === 'capacity' && pathParts.length === 3) {
        const projectId = pathParts[1];
        const opType = (body.type || '').toLowerCase();

        if (opType === 'iteration') {
          const name: string = body.iterationName || body.name || 'Iteration';
          const startDateStr: string = body.startDate;
          const endDateStr: string = body.endDate;
          const teamId: string | null = body.teamId || null;

          if (!startDateStr || !endDateStr) {
            return new Response(
              JSON.stringify({ success: false, error: 'startDate and endDate are required' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }

          const startDate = new Date(startDateStr);
          const endDate = new Date(endDateStr);
          const msInDay = 24 * 60 * 60 * 1000;
          const days = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / msInDay) + 1);
          const weeksCount = Math.ceil(days / 7);

          const { data: iteration, error: iterationError } = await supabase
            .from('iterations')
            .insert({
              project_id: projectId,
              team_id: teamId,
              name,
              type: 'iteration',
              start_date: startDateStr,
              end_date: endDateStr,
              weeks_count: weeksCount,
              created_by: user.id,
            })
            .select('*')
            .single();

          if (iterationError) {
            return new Response(
              JSON.stringify({ success: false, error: iterationError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }

          // Generate iteration weeks
          const weeks: any[] = [];
          for (let i = 0; i < weeksCount; i++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(weekStart.getDate() + i * 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            if (weekEnd > endDate) weekEnd.setTime(endDate.getTime());

            weeks.push({
              iteration_id: iteration.id,
              week_index: i + 1,
              week_start: weekStart.toISOString().split('T')[0],
              week_end: weekEnd.toISOString().split('T')[0],
            });
          }
          if (weeks.length) {
            await supabase.from('iteration_weeks').insert(weeks);
          }

          return new Response(
            JSON.stringify({ success: true, data: { message: 'Iteration created', iteration } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (opType === 'member') {
          // Minimal support: create a team member on provided teamId
          const teamId: string | undefined = body.teamId;
          const memberName: string = body.memberName || body.name || body.displayName;
          if (!teamId || !memberName) {
            return new Response(
              JSON.stringify({ success: false, error: 'teamId and memberName are required for member creation' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }

          const { data: member, error } = await supabase
            .from('team_members')
            .insert({ team_id: teamId, member_name: memberName, role: body.role || null, email: body.email || null })
            .select('*')
            .maybeSingle();

          if (error || !member) {
            return new Response(
              JSON.stringify({ success: false, error: error?.message || 'Failed to create member' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }

          return new Response(
            JSON.stringify({ success: true, data: { message: 'Member created', member } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: 'Unsupported capacity type' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // POST /projects/:projectId/teams
      if (pathParts[0] === 'projects' && pathParts[2] === 'teams') {
        const projectId = pathParts[1];
        
        const { data: team, error } = await supabase
          .from('teams')
          .insert({
            project_id: projectId,
            name: body.name,
            description: body.description,
            created_by: user.id
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: team }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /teams/:teamId/members
      if (pathParts[0] === 'teams' && pathParts[2] === 'members') {
        const teamId = pathParts[1];
        
        let member = null;
        let lastError: any = null;

        const nameValue = body.member_name ?? body.display_name ?? body.name;
        const payloads = [
          { team_id: teamId, member_name: nameValue, role: body.role ?? null, email: body.email ?? null },
          { team_id: teamId, display_name: nameValue, role: body.role ?? null, email: body.email ?? null },
          { team_id: teamId, name: nameValue, role: body.role ?? null, email: body.email ?? null },
        ];

        for (const payload of payloads) {
          const { data, error } = await supabase
            .from('team_members')
            .insert(payload)
            .select()
            .maybeSingle();
          if (!error && data) {
            member = data;
            break;
          }
          lastError = error;
        }

        if (!member) {
          return new Response(
            JSON.stringify({ success: false, error: lastError?.message || 'Failed to create member' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: member }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /projects/:projectId/iterations
      if (pathParts[0] === 'projects' && pathParts[2] === 'iterations') {
        const projectId = pathParts[1];
        
        // Create iteration
        const { data: iteration, error: iterationError } = await supabase
          .from('iterations')
          .insert({
            project_id: projectId,
            team_id: body.team_id,
            name: body.name,
            type: body.type,
            start_date: body.start_date,
            end_date: body.end_date,
            weeks_count: body.weeks_count,
            created_by: user.id
          })
          .select()
          .single();

        if (iterationError) {
          return new Response(
            JSON.stringify({ success: false, error: iterationError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Generate iteration weeks
        const weeks = [];
        const startDate = new Date(body.start_date);
        
        for (let i = 0; i < body.weeks_count; i++) {
          const weekStart = new Date(startDate);
          weekStart.setDate(weekStart.getDate() + (i * 7));
          
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          // Don't let week end go beyond iteration end date
          const iterationEnd = new Date(body.end_date);
          if (weekEnd > iterationEnd) {
            weekEnd.setTime(iterationEnd.getTime());
          }
          
          weeks.push({
            iteration_id: iteration.id,
            week_index: i + 1,
            week_start: weekStart.toISOString().split('T')[0],
            week_end: weekEnd.toISOString().split('T')[0]
          });
        }

        // Insert weeks
        if (weeks.length > 0) {
          await supabase
            .from('iteration_weeks')
            .insert(weeks);
        }

        return new Response(
          JSON.stringify({ success: true, data: iteration }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /iterations/:iterationId/availability
      if (pathParts[0] === 'iterations' && pathParts[2] === 'availability') {
        const iterationId = pathParts[1];
        
        // Validate that availability data exists
        if (!body.availability || !Array.isArray(body.availability)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Availability data is required and must be an array' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        
        // Clean and validate availability data
        const availabilityData = body.availability.map((avail: any) => {
          const cleanedData: any = {
            iteration_week_id: avail.iteration_week_id,
            team_member_id: avail.team_member_id,
            availability_percent: Number(avail.availability_percent) || 100,
            leaves: Number(avail.leaves) || 0,
            effective_capacity: Number(avail.effective_capacity) || 0,
            calculated_days_present: Number(avail.calculated_days_present) || Math.max(0, 5 - (Number(avail.leaves) || 0)),
            calculated_days_total: Number(avail.calculated_days_total) || 5,
            updated_at: new Date().toISOString()
          };
          
          // Only include notes if it exists and is not empty
          if (avail.notes && avail.notes.trim()) {
            cleanedData.notes = avail.notes.trim();
          }
          
          return cleanedData;
        }).filter(avail => avail.iteration_week_id && avail.team_member_id);

        if (availabilityData.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'No valid availability data provided' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const { error } = await supabase
          .from('member_weekly_availability')
          .upsert(availabilityData, {
            onConflict: 'iteration_week_id,team_member_id'
          });

        if (error) {
          console.error('Availability save error:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Availability saved successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (req.method === 'PUT') {
      // PUT /projects/:projectId/capacity/:itemId (update iteration)
      if (pathParts[0] === 'projects' && pathParts[2] === 'capacity' && pathParts.length === 4) {
        const projectId = pathParts[1];
        const itemId = pathParts[3];
        const body = await req.json();

        const name: string | undefined = body.iterationName || body.name;
        const startDateStr: string | undefined = body.startDate;
        const endDateStr: string | undefined = body.endDate;

        // Recompute weeks if dates provided
        let weeksCount: number | undefined;
        if (startDateStr && endDateStr) {
          const startDate = new Date(startDateStr);
          const endDate = new Date(endDateStr);
          const msInDay = 24 * 60 * 60 * 1000;
          const days = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / msInDay) + 1);
          weeksCount = Math.ceil(days / 7);
        }

        const { data: iteration, error } = await supabase
          .from('iterations')
          .update({
            name,
            start_date: startDateStr,
            end_date: endDateStr,
            weeks_count: weeksCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)
          .eq('project_id', projectId)
          .select('*')
          .maybeSingle();

        if (error || !iteration) {
          return new Response(
            JSON.stringify({ success: false, error: error?.message || 'Failed to update iteration' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: { message: 'Iteration updated', iteration } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (req.method === 'DELETE') {
      // DELETE /projects/:projectId/capacity/:itemId?type=iteration
      if (pathParts[0] === 'projects' && pathParts[2] === 'capacity' && pathParts.length === 4) {
        const projectId = pathParts[1];
        const itemId = pathParts[3];
        const type = (new URL(req.url).searchParams.get('type') || '').toLowerCase();

        if (type === 'iteration') {
          await supabase.from('iteration_weeks').delete().eq('iteration_id', itemId);
          const { error } = await supabase.from('iterations').delete().eq('id', itemId).eq('project_id', projectId);
          if (error) {
            return new Response(
              JSON.stringify({ success: false, error: error.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
          return new Response(
            JSON.stringify({ success: true, data: { message: 'Iteration deleted' } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: 'Unsupported delete type' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Endpoint not found' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});