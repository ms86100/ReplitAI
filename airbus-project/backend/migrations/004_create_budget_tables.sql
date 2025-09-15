-- Budget management tables for local backend
-- Mirrors the Supabase schema used by the frontend so both envs behave the same

-- Admin-configurable budget types
CREATE TABLE IF NOT EXISTS public.budget_type_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  default_allocation_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  dropdown_display_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project budgets
CREATE TABLE IF NOT EXISTS public.project_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  total_budget_allocated NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_budget_received NUMERIC(15,2) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  created_by UUID NOT NULL,
  department_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful index for lookups by project
CREATE INDEX IF NOT EXISTS idx_project_budgets_project_id ON public.project_budgets(project_id);

-- Budget categories linked to budget types
CREATE TABLE IF NOT EXISTS public.budget_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_budget_id UUID NOT NULL,
  budget_type_code TEXT NOT NULL,
  name TEXT NOT NULL,
  budget_allocated NUMERIC(15,2) NOT NULL DEFAULT 0,
  budget_received NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_spent NUMERIC(15,2) NOT NULL DEFAULT 0,
  comments TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_categories_project_budget_id ON public.budget_categories(project_budget_id);

-- Spending transactions
CREATE TABLE IF NOT EXISTS public.budget_spending (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_category_id UUID NOT NULL,
  date DATE NOT NULL,
  vendor TEXT,
  description TEXT NOT NULL,
  invoice_id TEXT,
  amount NUMERIC(15,2) NOT NULL,
  payment_method TEXT,
  approved_by UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_spending_category_id ON public.budget_spending(budget_category_id);

-- Budget receipts and income
CREATE TABLE IF NOT EXISTS public.budget_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_budget_id UUID NOT NULL,
  date DATE NOT NULL,
  source TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  received_by UUID,
  notes TEXT,
  is_restricted BOOLEAN DEFAULT false,
  restricted_to_category UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget comments and notes
CREATE TABLE IF NOT EXISTS public.budget_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_budget_id UUID NOT NULL,
  author UUID NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget alert rules
CREATE TABLE IF NOT EXISTS public.budget_alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_budget_id UUID NOT NULL,
  condition_type TEXT NOT NULL,
  threshold_value NUMERIC(10,2),
  severity TEXT NOT NULL DEFAULT 'medium',
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed a couple of budget types if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.budget_type_config) THEN
    INSERT INTO public.budget_type_config (code, label, dropdown_display_order)
    VALUES
      ('CAPEX', 'Capital Expenditure', 1),
      ('OPEX', 'Operational Expenditure', 2);
  END IF;
END $$;

-- Note: We intentionally do not add foreign keys to keep this migration simple and resilient across local setups.
