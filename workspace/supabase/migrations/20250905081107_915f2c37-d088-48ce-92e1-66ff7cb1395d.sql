-- Test data for project budget
INSERT INTO project_budgets (project_id, currency, total_budget_allocated, total_budget_received, created_by)
VALUES ('2d4540b1-25cd-4424-84fe-ba343a042eeb', 'INR', 2200, 0, '6dc39f1e-2af3-4b78-8488-317d90f4f538');

-- Get the project budget ID for categories
INSERT INTO budget_categories (project_budget_id, budget_type_code, name, budget_allocated, budget_received, amount_spent, created_by)
SELECT 
  pb.id,
  'development',
  'AAAAWWW',
  200,
  0,
  0,
  '6dc39f1e-2af3-4b78-8488-317d90f4f538'
FROM project_budgets pb 
WHERE pb.project_id = '2d4540b1-25cd-4424-84fe-ba343a042eeb';

INSERT INTO budget_categories (project_budget_id, budget_type_code, name, budget_allocated, budget_received, amount_spent, created_by)
SELECT 
  pb.id,
  'perfective_maintenance',
  'pp title',
  2000,
  0,
  0,
  '6dc39f1e-2af3-4b78-8488-317d90f4f538'
FROM project_budgets pb 
WHERE pb.project_id = '2d4540b1-25cd-4424-84fe-ba343a042eeb';