import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateAuthToken, corsHeaders, createSuccessResponse, createErrorResponse, handleCorsOptions } from '../shared/api-utils.ts';


Deno.serve(async (req) => {
  console.log('🏷️ Budget service request:', req.method, req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate authentication
    console.log('🔐 Validating auth for budget service...');
    const { user, error: authError } = await validateAuthToken(req, supabase);
    console.log('🔐 Auth validation result:', { user: !!user, error: authError });
    if (!user) {
      console.error('❌ Auth failed:', authError);
      return createErrorResponse(authError || 'Unauthorized', 'UNAUTHORIZED', 401);
    }
    console.log('✅ User authenticated:', user.id);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const bsIndex = pathParts.indexOf('budget-service');
    console.log('🧭 Parsed path:', { pathname: url.pathname, pathParts, bsIndex });
    // Route: /budget-service/projects/{projectId}/budget
    if (pathParts.length >= 4 && pathParts[0] === 'budget-service' && pathParts[1] === 'projects' && pathParts[3] === 'budget') {
      const projectId = pathParts[2];
      console.log('🏷️ Budget route matched, projectId:', projectId);
      
      if (req.method === 'GET') {
        // Get project budget with categories, spending, receipts
        console.log('📊 Getting budget for project:', projectId);
        
        const { data: budget, error: budgetError } = await supabase
          .from('project_budgets')
          .select(`
            *,
            budget_categories (
              *,
              budget_spending (*)
            ),
            budget_receipts (*),
            budget_comments (*),
            budget_alert_rules (*)
          `)
          .eq('project_id', projectId)
          .maybeSingle();

        if (budgetError) {
          console.error('❌ Detailed budget error:', {
            error: budgetError,
            code: budgetError.code,
            message: budgetError.message,
            details: budgetError.details,
            hint: budgetError.hint
          });
          return createErrorResponse(`Budget fetch error: ${budgetError.message}`, 'FETCH_ERROR', 500);
        }

        // Get budget types for reference
        const { data: budgetTypes, error: typesError } = await supabase
          .from('budget_type_config')
          .select('*')
          .eq('enabled', true)
          .order('dropdown_display_order');

        if (typesError) {
          console.error('❌ Detailed budget types error:', {
            error: typesError,
            code: typesError.code,
            message: typesError.message,
            details: typesError.details,
            hint: typesError.hint
          });
          return createErrorResponse(`Budget types fetch error: ${typesError.message}`, 'FETCH_ERROR', 500);
        }

        const result = {
          budget,
          budgetTypes,
          analytics: budget ? calculateBudgetAnalytics(budget) : null
        };

        return createSuccessResponse(result);
      }

      if (req.method === 'POST') {
        // Create or update project budget
        const body = await req.json();
        console.log('💰 Creating/updating budget for project:', projectId, body);

        const { data: existingBudget } = await supabase
          .from('project_budgets')
          .select('id')
          .eq('project_id', projectId)
          .maybeSingle();

        let budgetResult;
        
        if (existingBudget) {
          // Update existing budget
          const { data, error } = await supabase
            .from('project_budgets')
            .update({
              currency: body.currency || 'INR',
              total_budget_allocated: body.total_budget_allocated || 0,
              total_budget_received: body.total_budget_received || 0,
              start_date: body.start_date,
              end_date: body.end_date,
            })
            .eq('id', existingBudget.id)
            .select()
            .single();

          budgetResult = { data, error };
        } else {
          // Create new budget
          const { data, error } = await supabase
            .from('project_budgets')
            .insert({
              project_id: projectId,
              currency: body.currency || 'INR',
              total_budget_allocated: body.total_budget_allocated || 0,
              total_budget_received: body.total_budget_received || 0,
              start_date: body.start_date,
              end_date: body.end_date,
              created_by: user.id,
            })
            .select()
            .single();

          budgetResult = { data, error };
        }

        if (budgetResult.error) {
          console.error('❌ Error saving budget:', budgetResult.error);
          return createErrorResponse('Failed to save budget', 'SAVE_ERROR', 500);
        }

        return createSuccessResponse(budgetResult.data);
      }
    }

    // Route: /budget-service/projects/{projectId}/categories
    if (pathParts.length >= 4 && pathParts[0] === 'budget-service' && pathParts[1] === 'projects' && pathParts[3] === 'categories') {
      const projectId = pathParts[2];

      if (req.method === 'POST') {
        // Create budget category
        const body = await req.json();
        console.log('📂 Creating budget category for project:', projectId, body);

        // Get the project budget first
        const { data: projectBudget } = await supabase
          .from('project_budgets')
          .select('id')
          .eq('project_id', projectId)
          .single();

        if (!projectBudget) {
          return createErrorResponse('Project budget not found', 'NOT_FOUND', 404);
        }

        const { data, error } = await supabase
          .from('budget_categories')
          .insert({
            project_budget_id: projectBudget.id,
            budget_type_code: body.budget_type_code,
            name: body.name,
            budget_allocated: body.budget_allocated || 0,
            budget_received: body.budget_received || 0,
            comments: body.comments,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error creating category:', error);
          return createErrorResponse('Failed to create category', 'CREATE_ERROR', 500);
        }

        return createSuccessResponse(data);
      }
    }

    // Route: /budget-service/categories/{categoryId}/spending
    if (pathParts.length >= 4 && pathParts[0] === 'budget-service' && pathParts[1] === 'categories' && pathParts[3] === 'spending') {
      const categoryId = pathParts[2];

      if (req.method === 'POST') {
        // Create spending entry
        const body = await req.json();
        console.log('💸 Creating spending entry for category:', categoryId, body);

        const { data, error } = await supabase
          .from('budget_spending')
          .insert({
            budget_category_id: categoryId,
            date: body.date,
            vendor: body.vendor,
            description: body.description,
            invoice_id: body.invoice_id,
            amount: body.amount,
            payment_method: body.payment_method,
            status: body.status || 'pending',
            created_by: user.id,
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error creating spending:', error);
          return createErrorResponse('Failed to create spending', 'CREATE_ERROR', 500);
        }

        // Update category amount_spent
        await updateCategorySpentAmount(supabase, categoryId);

        return createSuccessResponse(data);
      }
    }

    // Route: /budget-service/budget-types
    if (pathParts.length >= 2 && pathParts[0] === 'budget-service' && pathParts[1] === 'budget-types') {
      if (req.method === 'GET') {
        // Get all budget types
        const { data, error } = await supabase
          .from('budget_type_config')
          .select('*')
          .eq('enabled', true)
          .order('dropdown_display_order');

        if (error) {
          console.error('❌ Error fetching budget types:', error);
          return createErrorResponse('Failed to fetch budget types', 'FETCH_ERROR', 500);
        }

        return createSuccessResponse(data);
      }
    }

    // Route: DELETE /budget-service/categories/{categoryId}
    if (((pathParts.length >= 3 && pathParts[0] === 'budget-service' && pathParts[1] === 'categories')
        || (bsIndex !== -1 && pathParts[bsIndex + 1] === 'categories'))){
      const categoryId = (bsIndex !== -1 && pathParts[bsIndex + 2]) || pathParts[2];
      if (req.method === 'DELETE') {
        console.log('🗑️ Deleting budget category:', categoryId);

        // Delete dependent spending first to avoid FK violations
        const { error: spendingDelError } = await supabase
          .from('budget_spending')
          .delete()
          .eq('budget_category_id', categoryId);

        if (spendingDelError) {
          console.error('❌ Error deleting related spending:', spendingDelError);
          return createErrorResponse('Failed to delete related spending entries', 'DELETE_ERROR', 500);
        }

        const { error: categoryDelError } = await supabase
          .from('budget_categories')
          .delete()
          .eq('id', categoryId);

        if (categoryDelError) {
          console.error('❌ Error deleting category:', categoryDelError);
          return createErrorResponse('Failed to delete category', 'DELETE_ERROR', 500);
        }

        return createSuccessResponse({ success: true });
      }
    }

    // Route: DELETE /budget-service/spending/{spendingId}
    if (((pathParts.length >= 3 && pathParts[0] === 'budget-service' && pathParts[1] === 'spending')
        || (bsIndex !== -1 && pathParts[bsIndex + 1] === 'spending'))){
      const spendingId = (bsIndex !== -1 && pathParts[bsIndex + 2]) || pathParts[2];
      if (req.method === 'DELETE') {
        console.log('🗑️ Deleting spending entry:', spendingId);

        // Fetch to know category for recalculation
        const { data: spending, error: fetchErr } = await supabase
          .from('budget_spending')
          .select('id, budget_category_id')
          .eq('id', spendingId)
          .maybeSingle();

        if (fetchErr) {
          console.error('❌ Error fetching spending before delete:', fetchErr);
          return createErrorResponse('Failed to fetch spending entry', 'FETCH_ERROR', 500);
        }

        const { error: delErr } = await supabase
          .from('budget_spending')
          .delete()
          .eq('id', spendingId);

        if (delErr) {
          console.error('❌ Error deleting spending:', delErr);
          return createErrorResponse('Failed to delete spending entry', 'DELETE_ERROR', 500);
        }

        if (spending?.budget_category_id) {
          await updateCategorySpentAmount(supabase, spending.budget_category_id);
        }

        return createSuccessResponse({ success: true });
      }
    }
    console.error('🛑 Endpoint not found for request', { method: req.method, url: url.toString(), pathParts });
    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);

  } catch (error) {
    console.error('❌ Budget service error:', error);
    return createErrorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
});

// Helper function to calculate budget analytics
function calculateBudgetAnalytics(budget: any) {
  const categories = budget.budget_categories || [];
  
  let totalAllocated = 0;
  let totalReceived = 0;
  let totalSpent = 0;
  
  categories.forEach((category: any) => {
    totalAllocated += Number(category.budget_allocated || 0);
    totalReceived += Number(category.budget_received || 0);
    totalSpent += Number(category.amount_spent || 0);
  });

  const remainingTotal = totalReceived - totalSpent;
  const overallVarianceAmount = remainingTotal;
  const overallVariancePercent = totalReceived > 0 ? (overallVarianceAmount / totalReceived) * 100 : 0;

  return {
    totals: {
      allocated_total: totalAllocated,
      received_total: totalReceived,
      spent_total: totalSpent,
      remaining_total: remainingTotal,
    },
    variance_summary: {
      overall_variance_amount: overallVarianceAmount,
      overall_variance_percent: Math.round(overallVariancePercent * 100) / 100,
    },
    category_breakdown: categories.map((category: any) => ({
      code: category.budget_type_code,
      name: category.name,
      allocated: Number(category.budget_allocated || 0),
      received: Number(category.budget_received || 0),
      spent: Number(category.amount_spent || 0),
      variance: Number(category.budget_received || 0) - Number(category.amount_spent || 0),
      percent_spent: Number(category.budget_received || 0) > 0 ? 
        Math.round((Number(category.amount_spent || 0) / Number(category.budget_received || 0)) * 10000) / 100 : 0,
    })),
  };
}

// Helper function to update category spent amount
async function updateCategorySpentAmount(supabase: any, categoryId: string) {
  const { data: spending } = await supabase
    .from('budget_spending')
    .select('amount')
    .eq('budget_category_id', categoryId)
    .eq('status', 'paid');

  const totalSpent = spending?.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0) || 0;

  await supabase
    .from('budget_categories')
    .update({ amount_spent: totalSpent })
    .eq('id', categoryId);
}