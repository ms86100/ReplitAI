import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Utility to pause between operations if needed
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/functions\/v1\/seed-demo/, '').replace(/^\/seed-demo/, '') || '/';

    // Create clients
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or missing auth token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const ownerId = userData.user.id;

    if (req.method !== 'POST' || path !== '/') {
      return new Response(
        JSON.stringify({ success: false, error: 'Use POST /seed-demo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const keepTeams = body.keepTeams ?? true; // default true, per user request

    console.log(`🔧 Seeding demo data by user ${ownerId}. keepTeams=${keepTeams}`);

    // 1) Purge data (keep users/profiles; keep departments & teams if requested)
    const deleteOrder = [
      // Retrospectives
      'retrospective_card_votes',
      'retrospective_cards',
      'retrospective_columns',
      'retrospective_action_items',
      'retrospectives',
      // Capacity
      'member_weekly_availability',
      'iteration_weeks',
      'iterations',
      // Budgets
      'budget_spending',
      'budget_comments',
      'budget_categories',
      'budget_receipts',
      'project_budgets',
      // Tasks & backlog & milestones
      'task_backlog',
      'tasks',
      'milestones',
      // Stakeholders & risks & discussions
      'stakeholders',
      'risk_register',
      'project_discussions',
      // Permissions & audit
      'module_permissions',
      'module_access_audit',
      'audit_log',
      // Memberships
      'project_members',
    ];

    for (const table of deleteOrder) {
      const { error } = await serviceClient.from(table).delete().neq('id', '');
      if (error) console.log(`⚠️ Delete from ${table} error:`, error.message);
    }

    // Projects last (may be referenced by teams). If keepTeams is true, we still try deleting projects;
    // if FK prevents deletion, we'll skip and continue.
    const { error: delProjectsErr } = await serviceClient.from('projects').delete().neq('id', '');
    if (delProjectsErr) {
      console.log('⚠️ Deleting projects failed (likely due to existing teams FK). Skipping:', delProjectsErr.message);
    }

    // 2) Optionally create teams for new projects (we will ALWAYS create new teams for seeded projects)

    // Helper to add days
    const addDays = (d: Date, days: number) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + days);
      return nd;
    };

    // Seed scenarios
    const projectsSeed = [
      {
        name: 'A320neo Avionics Upgrade',
        description: 'Next-gen avionics suite integration for Airbus A320neo fleet with EFB enhancements.',
      },
      {
        name: 'A350 Cabin IoT & Analytics',
        description: 'Smart cabin sensors and predictive analytics for comfort and efficiency on A350.',
      },
      {
        name: 'Skywise Predictive Maintenance 2.0',
        description: 'Enhanced ML models for engine/landing gear predictive maintenance on Airbus fleet.',
      },
      {
        name: 'HAPS UAV Communications Relay',
        description: 'High-altitude pseudo-satellite UAV for emergency comms relay and SAR support.',
      },
      {
        name: 'Space Systems Thermal Control Upgrade',
        description: 'Advanced thermal management for LEO satellite bus with new heat pipe design.',
      },
    ];

    const seeded = [] as any[];

    for (let i = 0; i < projectsSeed.length; i++) {
      const p = projectsSeed[i];
      const start = addDays(new Date(), -60 - i * 7);
      const end = addDays(start, 120);

      const { data: project, error: projErr } = await serviceClient
        .from('projects')
        .insert({
          name: p.name,
          description: p.description,
          status: 'active',
          priority: ['low', 'medium', 'high'][i % 3],
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          created_by: ownerId,
        })
        .select('*')
        .single();

      if (projErr || !project) {
        console.log('❌ Project insert failed:', projErr?.message);
        continue;
      }

      // Add project membership for owner
      await serviceClient.from('project_members').insert({ project_id: project.id, user_id: ownerId, role: 'owner' }).catch(() => {});

      // Create a dedicated team for this project (we keep existing teams but also add new ones)
      const { data: team, error: teamErr } = await serviceClient
        .from('teams')
        .insert({
          project_id: project.id,
          name: `${p.name.split(' ')[0]} Core Team`,
          description: 'Core engineering team',
        })
        .select('*')
        .single();

      if (teamErr) console.log('⚠️ Team insert error:', teamErr.message);

      // Team members
      const teamMembers = team
        ? [
            { team_id: team.id, member_name: 'Alice Martin', role: 'Lead Avionics', email: 'alice.martin@airbus.com', display_name: 'Alice Martin' },
            { team_id: team.id, member_name: 'Jules Lefevre', role: 'Systems Engineer', email: 'jules.lefevre@airbus.com', display_name: 'Jules Lefevre' },
            { team_id: team.id, member_name: 'Priya Nair', role: 'QA/Test', email: 'priya.nair@airbus.com', display_name: 'Priya Nair' },
          ]
        : [];

      if (teamMembers.length) await serviceClient.from('team_members').insert(teamMembers);

      // Milestones
      const milestones = [
        { name: 'Requirements Freeze', dueOffset: 30 },
        { name: 'Subsystem Integration', dueOffset: 60 },
        { name: 'Flight Test Campaign', dueOffset: 100 },
      ].map((m) => ({
        project_id: project.id,
        name: m.name,
        due_date: addDays(start, m.dueOffset).toISOString().slice(0, 10),
        created_by: ownerId,
        status: 'planning',
      }));
      await serviceClient.from('milestones').insert(milestones);

      // Tasks
      const tasks = Array.from({ length: 10 }).map((_, idx) => ({
        project_id: project.id,
        title: `${p.name.split(' ')[0]} Task #${idx + 1}`,
        description: 'Detailed task for subsystem work package',
        status: ['todo', 'in_progress', 'completed'][idx % 3],
        priority: ['low', 'medium', 'high'][idx % 3],
        due_date: addDays(start, 14 + idx * 3).toISOString().slice(0, 10),
        created_by: ownerId,
      }));
      await serviceClient.from('tasks').insert(tasks);

      // Backlog
      const backlog = Array.from({ length: 5 }).map((_, idx) => ({
        project_id: project.id,
        title: `Backlog: ${p.name.split(' ')[0]} feature ${idx + 1}`,
        description: 'Candidate feature for next iteration',
        status: 'Open',
        priority: ['low', 'medium', 'high'][idx % 3],
        created_by: ownerId,
      }));
      await serviceClient.from('task_backlog').insert(backlog);

      // Stakeholders
      const stakeholders = [
        { name: 'Airbus Flight Ops', email: 'flight.ops@airbus.com' },
        { name: 'Airbus Engineering', email: 'eng@airbus.com' },
      ].map((s) => ({ ...s, project_id: project.id, created_by: ownerId }));
      await serviceClient.from('stakeholders').insert(stakeholders);

      // Risks
      const risks = [
        { what_task: 'Supply chain delay for avionics components', who_responsible: 'Procurement', backlog_status: 'Open' },
        { what_task: 'Certification test window constraints', who_responsible: 'Flight Test', backlog_status: 'Open' },
      ].map((r) => ({ ...r, project_id: project.id, created_by: ownerId }));
      await serviceClient.from('risk_register').insert(risks as any);

      // Discussions
      const discussions = [
        { meeting_title: 'Kickoff Review', meeting_date: start.toISOString().slice(0, 10) },
        { meeting_title: 'Mid-phase Sync', meeting_date: addDays(start, 45).toISOString().slice(0, 10) },
      ].map((d) => ({ ...d, project_id: project.id, created_by: ownerId }));
      await serviceClient.from('project_discussions').insert(discussions);

      // Budget
      const { data: budget, error: budErr } = await serviceClient
        .from('project_budgets')
        .insert({ project_id: project.id, currency: 'EUR', created_by: ownerId })
        .select('*')
        .single();
      if (!budErr && budget) {
        const categories = [
          { name: 'Engineering', budget_allocated: 200000, project_budget_id: budget.id, created_by: ownerId },
          { name: 'Testing & Certification', budget_allocated: 120000, project_budget_id: budget.id, created_by: ownerId },
          { name: 'Procurement', budget_allocated: 180000, project_budget_id: budget.id, created_by: ownerId },
        ];
        const { data: cats } = await serviceClient.from('budget_categories').insert(categories).select('id');

        // Spending entries
        const catIds = cats?.map((c: any) => c.id) || [];
        const spend = catIds.slice(0, 3).map((cid: string, idx: number) => ({
          budget_category_id: cid,
          amount: 10000 + idx * 2500,
          description: 'Initial procurement & testing spend',
          vendor: ['Thales', 'Honeywell', 'Safran'][idx % 3],
          status: 'approved',
          date: addDays(start, 20 + idx * 5).toISOString().slice(0, 10),
          created_by: ownerId,
        }));
        if (spend.length) await serviceClient.from('budget_spending').insert(spend);
      }

      // Retrospective (lightweight to appear in analytics)
      await serviceClient.from('retrospectives').insert({ project_id: project.id, created_by: ownerId, framework: 'Classic', status: 'active' });

      // Capacity: iteration with weeks & basic availability
      if (team) {
        const iterStart = addDays(new Date(), -14);
        const iterEnd = addDays(iterStart, 21);
        const { data: iteration } = await serviceClient
          .from('iterations')
          .insert({
            project_id: project.id,
            team_id: team.id,
            name: `${p.name.split(' ')[0]} Iteration 1`,
            type: 'iteration',
            start_date: iterStart.toISOString().slice(0, 10),
            end_date: iterEnd.toISOString().slice(0, 10),
            weeks_count: 3,
            created_by: ownerId,
          })
          .select('*')
          .single();

        if (iteration) {
          const weeks = [0, 1, 2].map((w) => {
            const ws = addDays(iterStart, w * 7);
            const we = addDays(ws, 6);
            return {
              iteration_id: iteration.id,
              week_index: w + 1,
              week_start: ws.toISOString().slice(0, 10),
              week_end: we.toISOString().slice(0, 10),
            };
          });
          const { data: weekRows } = await serviceClient.from('iteration_weeks').insert(weeks).select('*');

          // Availability 100% for each member/week
          if (weekRows?.length && teamMembers.length) {
            const availability = [] as any[];
            for (const m of teamMembers) {
              for (const w of weekRows) {
                availability.push({
                  iteration_week_id: w.id,
                  team_member_id: (m as any).id || undefined, // if not returned, we need to refetch
                  availability_percent: 100,
                });
              }
            }
            // Ensure we have member IDs (refetch if needed)
            if (availability.some((a) => !a.team_member_id)) {
              const { data: refMembers } = await serviceClient
                .from('team_members')
                .select('id')
                .eq('team_id', team.id);
              if (refMembers?.length) {
                const memberIds = refMembers.map((r: any) => r.id);
                const rebuilt = [] as any[];
                for (const mid of memberIds) {
                  for (const w of weekRows) rebuilt.push({ iteration_week_id: w.id, team_member_id: mid, availability_percent: 100 });
                }
                await serviceClient.from('member_weekly_availability').insert(rebuilt);
              }
            } else {
              await serviceClient.from('member_weekly_availability').insert(availability);
            }
          }
        }
      }

      seeded.push({ projectId: project.id, name: project.name });
    }

    console.log(`✅ Seeded ${seeded.length} projects`);

    return new Response(
      JSON.stringify({ success: true, data: { projects: seeded }, message: 'Database reset and demo data seeded.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('❌ Seed error:', e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
