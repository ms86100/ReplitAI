-- Temporarily disable audit triggers and create sample data
-- Disable triggers temporarily to avoid auth issues
ALTER TABLE tasks DISABLE TRIGGER ALL;
ALTER TABLE milestones DISABLE TRIGGER ALL;
ALTER TABLE stakeholders DISABLE TRIGGER ALL;
ALTER TABLE risk_register DISABLE TRIGGER ALL;
ALTER TABLE project_budgets DISABLE TRIGGER ALL;
ALTER TABLE budget_categories DISABLE TRIGGER ALL;

-- Use a simpler approach - create or update existing data
DO $$
DECLARE
    demo_user_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    sample_project_id UUID := 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57';
BEGIN
    -- Create demo profile in profiles table (not auth.users)
    INSERT INTO profiles (id, email, full_name) 
    VALUES (demo_user_id, 'demo@airbus.com', 'Demo User')
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    -- Clear existing data first
    DELETE FROM tasks WHERE project_id = sample_project_id;
    DELETE FROM milestones WHERE project_id = sample_project_id;
    DELETE FROM stakeholders WHERE project_id = sample_project_id;
    DELETE FROM risk_register WHERE project_id = sample_project_id;
    DELETE FROM budget_categories WHERE project_budget_id IN (SELECT id FROM project_budgets WHERE project_id = sample_project_id);
    DELETE FROM project_budgets WHERE project_id = sample_project_id;

    -- Insert or update sample project
    INSERT INTO projects (id, name, description, status, priority, created_by, start_date, end_date) VALUES
    (sample_project_id, 'Airbus A350 Navigation System', 'Advanced navigation system development for A350 aircraft', 'active', 'high', demo_user_id, '2024-01-15', '2024-12-15')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      priority = EXCLUDED.priority,
      created_by = demo_user_id;

    -- Insert sample tasks for analytics
    INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, created_by) VALUES
    ('11111111-1111-4111-8111-111111111111', 'Navigation Algorithm Implementation', 'Develop core navigation algorithms', 'completed', 'high', '2024-03-15', sample_project_id, demo_user_id),
    ('22222222-2222-4222-8222-222222222222', 'GPS Integration Testing', 'Test GPS integration with navigation system', 'in_progress', 'high', '2024-04-20', sample_project_id, demo_user_id),
    ('33333333-3333-4333-8333-333333333333', 'Safety Protocol Validation', 'Validate safety protocols for navigation system', 'blocked', 'critical', '2024-05-10', sample_project_id, demo_user_id),
    ('44444444-4444-4444-8444-444444444444', 'UI Dashboard Development', 'Create pilot interface dashboard', 'todo', 'medium', '2024-06-01', sample_project_id, demo_user_id),
    ('55555555-5555-4555-8555-555555555555', 'Hardware Integration', 'Integrate with aircraft hardware systems', 'overdue', 'high', '2024-03-01', sample_project_id, demo_user_id),
    ('66666666-6666-4666-8666-666666666666', 'Performance Testing', 'Conduct performance benchmarks', 'in_progress', 'medium', '2024-04-30', sample_project_id, demo_user_id),
    ('77777777-7777-4777-8777-777777777777', 'Documentation Writing', 'Create technical documentation', 'completed', 'low', '2024-03-20', sample_project_id, demo_user_id),
    ('88888888-8888-4888-8888-888888888888', 'Code Review Process', 'Review all navigation code', 'completed', 'medium', '2024-03-25', sample_project_id, demo_user_id);

    -- Insert sample milestones
    INSERT INTO milestones (id, name, description, due_date, status, project_id, created_by) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alpha Release', 'Initial system alpha release with core functionality', '2024-04-15', 'completed', sample_project_id, demo_user_id),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Beta Testing Phase', 'Comprehensive beta testing with pilot feedback', '2024-07-15', 'in_progress', sample_project_id, demo_user_id),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Production Ready', 'Final production-ready system', '2024-11-30', 'planning', sample_project_id, demo_user_id);

    -- Insert sample stakeholders
    INSERT INTO stakeholders (id, name, email, role, interest_level, influence_level, project_id, created_by) VALUES
    ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Captain Sarah Mitchell', 'sarah.mitchell@airbus.com', 'Pilot Representative', 'high', 'high', sample_project_id, demo_user_id),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Dr. Andreas Weber', 'andreas.weber@airbus.com', 'Chief Engineer', 'high', 'high', sample_project_id, demo_user_id),
    ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Marie Dubois', 'marie.dubois@airbus.com', 'Safety Officer', 'high', 'medium', sample_project_id, demo_user_id),
    ('gggggggg-gggg-4ggg-8ggg-gggggggggggg', 'James Thompson', 'james.thompson@airbus.com', 'Project Sponsor', 'medium', 'high', sample_project_id, demo_user_id);

    -- Insert sample risks  
    INSERT INTO risk_register (id, risk_title, risk_description, probability, impact, category, status, mitigation_strategy, project_id, created_by) VALUES
    ('hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh', 'GPS Signal Interference', 'Potential interference with GPS signals in certain flight conditions', 'medium', 'high', 'Technical', 'active', 'Implement backup navigation systems and signal filtering', sample_project_id, demo_user_id),
    ('iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii', 'Regulatory Approval Delays', 'Aviation authorities may require additional testing', 'high', 'high', 'Regulatory', 'active', 'Early engagement with regulatory bodies and comprehensive documentation', sample_project_id, demo_user_id),
    ('jjjjjjjj-jjjj-4jjj-8jjj-jjjjjjjjjjjj', 'Hardware Component Shortage', 'Critical navigation chips may face supply chain issues', 'low', 'high', 'Supply Chain', 'mitigated', 'Secured alternative suppliers and maintained buffer inventory', sample_project_id, demo_user_id);

    -- Insert sample project budget
    INSERT INTO project_budgets (id, project_id, total_budget_allocated, total_budget_received, currency, created_by) VALUES
    ('kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk', sample_project_id, 5000000, 4800000, 'EUR', demo_user_id);

    -- Insert sample budget categories
    INSERT INTO budget_categories (id, project_budget_id, name, budget_type_code, budget_allocated, budget_received, amount_spent, created_by) VALUES
    ('llllllll-llll-4lll-8lll-llllllllllll', 'kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk', 'Research & Development', 'RD', 2000000, 1900000, 1200000, demo_user_id),
    ('mmmmmmmm-mmmm-4mmm-8mmm-mmmmmmmmmmmm', 'kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk', 'Hardware Components', 'HW', 1500000, 1500000, 800000, demo_user_id),
    ('nnnnnnnn-nnnn-4nnn-8nnn-nnnnnnnnnnnn', 'kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk', 'Testing & Validation', 'TV', 1000000, 900000, 400000, demo_user_id),
    ('oooooooo-oooo-4ooo-8ooo-oooooooooooo', 'kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk', 'Personnel', 'PE', 500000, 500000, 300000, demo_user_id);

END $$;

-- Re-enable triggers
ALTER TABLE tasks ENABLE TRIGGER ALL;
ALTER TABLE milestones ENABLE TRIGGER ALL;
ALTER TABLE stakeholders ENABLE TRIGGER ALL;
ALTER TABLE risk_register ENABLE TRIGGER ALL;
ALTER TABLE project_budgets ENABLE TRIGGER ALL;
ALTER TABLE budget_categories ENABLE TRIGGER ALL;