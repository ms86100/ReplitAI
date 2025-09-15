-- Create budget management tables

-- Admin-configurable budget types
CREATE TABLE public.budget_type_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  default_allocation_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  dropdown_display_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project budgets
CREATE TABLE public.project_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  total_budget_allocated NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_budget_received NUMERIC(15,2) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  created_by UUID NOT NULL,
  department_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Budget categories linked to budget types
CREATE TABLE public.budget_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_budget_id UUID NOT NULL,
  budget_type_code TEXT NOT NULL,
  name TEXT NOT NULL,
  budget_allocated NUMERIC(15,2) NOT NULL DEFAULT 0,
  budget_received NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_spent NUMERIC(15,2) NOT NULL DEFAULT 0,
  comments TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Spending transactions
CREATE TABLE public.budget_spending (
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Budget receipts and income
CREATE TABLE public.budget_receipts (
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Budget comments and notes
CREATE TABLE public.budget_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_budget_id UUID NOT NULL,
  author UUID NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Budget alert rules
CREATE TABLE public.budget_alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_budget_id UUID NOT NULL,
  condition_type TEXT NOT NULL,
  threshold_value NUMERIC(10,2),
  severity TEXT NOT NULL DEFAULT 'medium',
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.budget_type_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_spending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_alert_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budget_type_config (admin only for modifications)
CREATE POLICY "Everyone can view budget types" 
ON public.budget_type_config 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage budget types" 
ON public.budget_type_config 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for project_budgets
CREATE POLICY "Users can view budgets in their projects" 
ON public.project_budgets 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = project_budgets.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can create budgets in their projects" 
ON public.project_budgets 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = project_budgets.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
) AND created_by = auth.uid());

CREATE POLICY "Users can update budgets in their projects" 
ON public.project_budgets 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = project_budgets.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can delete budgets in their projects" 
ON public.project_budgets 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = project_budgets.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

-- RLS Policies for budget_categories
CREATE POLICY "Users can view budget categories in their projects" 
ON public.budget_categories 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM project_budgets pb JOIN projects p ON p.id = pb.project_id
  WHERE pb.id = budget_categories.project_budget_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can manage budget categories in their projects" 
ON public.budget_categories 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM project_budgets pb JOIN projects p ON p.id = pb.project_id
  WHERE pb.id = budget_categories.project_budget_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM project_budgets pb JOIN projects p ON p.id = pb.project_id
  WHERE pb.id = budget_categories.project_budget_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
) AND created_by = auth.uid());

-- Similar policies for spending, receipts, comments, and alert rules
CREATE POLICY "Users can view budget spending in their projects" 
ON public.budget_spending 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM budget_categories bc 
  JOIN project_budgets pb ON pb.id = bc.project_budget_id
  JOIN projects p ON p.id = pb.project_id
  WHERE bc.id = budget_spending.budget_category_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can manage budget spending in their projects" 
ON public.budget_spending 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM budget_categories bc 
  JOIN project_budgets pb ON pb.id = bc.project_budget_id
  JOIN projects p ON p.id = pb.project_id
  WHERE bc.id = budget_spending.budget_category_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
))
WITH CHECK (created_by = auth.uid());

-- Apply similar patterns for receipts, comments, and alert rules
CREATE POLICY "Users can view budget receipts in their projects" 
ON public.budget_receipts 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM project_budgets pb JOIN projects p ON p.id = pb.project_id
  WHERE pb.id = budget_receipts.project_budget_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can manage budget receipts in their projects" 
ON public.budget_receipts 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM project_budgets pb JOIN projects p ON p.id = pb.project_id
  WHERE pb.id = budget_receipts.project_budget_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
))
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view budget comments in their projects" 
ON public.budget_comments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM project_budgets pb JOIN projects p ON p.id = pb.project_id
  WHERE pb.id = budget_comments.project_budget_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can manage budget comments in their projects" 
ON public.budget_comments 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM project_budgets pb JOIN projects p ON p.id = pb.project_id
  WHERE pb.id = budget_comments.project_budget_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
))
WITH CHECK (author = auth.uid());

CREATE POLICY "Users can view budget alert rules in their projects" 
ON public.budget_alert_rules 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM project_budgets pb JOIN projects p ON p.id = pb.project_id
  WHERE pb.id = budget_alert_rules.project_budget_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can manage budget alert rules in their projects" 
ON public.budget_alert_rules 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM project_budgets pb JOIN projects p ON p.id = pb.project_id
  WHERE pb.id = budget_alert_rules.project_budget_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
))
WITH CHECK (created_by = auth.uid());

-- Add triggers for updated_at
CREATE TRIGGER update_budget_type_config_updated_at
BEFORE UPDATE ON public.budget_type_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_budgets_updated_at
BEFORE UPDATE ON public.project_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_categories_updated_at
BEFORE UPDATE ON public.budget_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_spending_updated_at
BEFORE UPDATE ON public.budget_spending
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_receipts_updated_at
BEFORE UPDATE ON public.budget_receipts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_alert_rules_updated_at
BEFORE UPDATE ON public.budget_alert_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default budget types
INSERT INTO public.budget_type_config (code, label, enabled, default_allocation_percent, dropdown_display_order, notes) VALUES
('obsolescence', 'Obsolescence & Decommissioning', true, 2.0, 1, 'Budget for safe retirement, data migration and disposal.'),
('preventive_maintenance', 'Preventive Maintenance', true, 3.0, 2, 'Routine maintenance to prevent failures (tests, cleanup).'),
('perfective_maintenance', 'Perfective Maintenance', true, 4.0, 3, 'Improvements to performance/usability based on feedback.'),
('development', 'Development', true, 40.0, 4, 'Core development work and feature implementation.'),
('bug_fixing', 'Bug Fixing & Defect Resolution', true, 5.0, 5, 'Bug fixes and defect resolution activities.'),
('security', 'Security & Vulnerability Management', true, 6.0, 6, 'Security audits, vulnerability fixes, and compliance.'),
('export_control', 'Export Control & Compliance', true, 2.0, 7, 'Legal compliance and export control requirements.'),
('adaptive_maintenance', 'Adaptive Maintenance', true, 10.0, 8, 'Adaptation to changing environments and requirements.'),
('infrastructure', 'Infrastructure & Hosting', true, 20.0, 9, 'Hosting, cloud services, and infrastructure costs.'),
('licensing', 'Licenses & Subscriptions', true, 3.0, 10, 'Third-party licenses and subscription services.'),
('contingency', 'Contingency / Risk Reserve', true, 5.0, 11, 'Emergency budget for unexpected costs and risks.');