-- Fix UUID and add comprehensive sample analytics data
-- First ensure we have valid UUIDs for sample data
INSERT INTO projects (id, name, description, status, priority, created_by, department_id, start_date, end_date) VALUES
('a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'Airbus A350 Navigation System', 'Advanced navigation system development for A350 aircraft', 'active', 'high', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', null, '2024-01-15', '2024-12-15')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority;

-- Insert sample tasks with various statuses for analytics
INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, milestone_id, assigned_to, created_by) VALUES
('11111111-1111-4111-8111-111111111111', 'Navigation Algorithm Implementation', 'Develop core navigation algorithms', 'completed', 'high', '2024-03-15', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('22222222-2222-4222-8222-222222222222', 'GPS Integration Testing', 'Test GPS integration with navigation system', 'in_progress', 'high', '2024-04-20', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('33333333-3333-4333-8333-333333333333', 'Safety Protocol Validation', 'Validate safety protocols for navigation system', 'blocked', 'critical', '2024-05-10', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('44444444-4444-4444-8444-444444444444', 'UI Dashboard Development', 'Create pilot interface dashboard', 'todo', 'medium', '2024-06-01', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('55555555-5555-4555-8555-555555555555', 'Hardware Integration', 'Integrate with aircraft hardware systems', 'overdue', 'high', '2024-03-01', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('66666666-6666-4666-8666-666666666666', 'Performance Testing', 'Conduct performance benchmarks', 'in_progress', 'medium', '2024-04-30', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('77777777-7777-4777-8777-777777777777', 'Documentation Writing', 'Create technical documentation', 'completed', 'low', '2024-03-20', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('88888888-8888-4888-8888-888888888888', 'Code Review Process', 'Review all navigation code', 'completed', 'medium', '2024-03-25', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
ON CONFLICT (id) DO NOTHING;

-- Insert sample milestones
INSERT INTO milestones (id, name, description, due_date, status, project_id, created_by) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alpha Release', 'Initial system alpha release with core functionality', '2024-04-15', 'completed', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Beta Testing Phase', 'Comprehensive beta testing with pilot feedback', '2024-07-15', 'in_progress', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Production Ready', 'Final production-ready system', '2024-11-30', 'planning', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
ON CONFLICT (id) DO NOTHING;

-- Insert sample stakeholders
INSERT INTO stakeholders (id, name, email, role, interest_level, influence_level, project_id, created_by) VALUES
('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Captain Sarah Mitchell', 'sarah.mitchell@airbus.com', 'Pilot Representative', 'high', 'high', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Dr. Andreas Weber', 'andreas.weber@airbus.com', 'Chief Engineer', 'high', 'high', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Marie Dubois', 'marie.dubois@airbus.com', 'Safety Officer', 'high', 'medium', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('gggggggg-gggg-4ggg-8ggg-gggggggggggg', 'James Thompson', 'james.thompson@airbus.com', 'Project Sponsor', 'medium', 'high', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
ON CONFLICT (id) DO NOTHING;

-- Insert sample risks  
INSERT INTO risk_register (id, risk_title, risk_description, probability, impact, category, status, mitigation_strategy, project_id, created_by) VALUES
('hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh', 'GPS Signal Interference', 'Potential interference with GPS signals in certain flight conditions', 'medium', 'high', 'Technical', 'active', 'Implement backup navigation systems and signal filtering', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii', 'Regulatory Approval Delays', 'Aviation authorities may require additional testing', 'high', 'high', 'Regulatory', 'active', 'Early engagement with regulatory bodies and comprehensive documentation', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('jjjjjjjj-jjjj-4jjj-8jjj-jjjjjjjjjjjj', 'Hardware Component Shortage', 'Critical navigation chips may face supply chain issues', 'low', 'high', 'Supply Chain', 'mitigated', 'Secured alternative suppliers and maintained buffer inventory', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
ON CONFLICT (id) DO NOTHING;

-- Insert sample project budget
INSERT INTO project_budgets (id, project_id, total_budget_allocated, total_budget_received, currency, created_by) VALUES
('kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 5000000, 4800000, 'EUR', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
ON CONFLICT (id) DO NOTHING;

-- Insert sample budget categories
INSERT INTO budget_categories (id, project_budget_id, name, budget_type_code, budget_allocated, budget_received, amount_spent, created_by) VALUES
('llllllll-llll-4lll-8lll-llllllllllll', 'kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk', 'Research & Development', 'RD', 2000000, 1900000, 1200000, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('mmmmmmmm-mmmm-4mmm-8mmm-mmmmmmmmmmmm', 'kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk', 'Hardware Components', 'HW', 1500000, 1500000, 800000, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('nnnnnnnn-nnnn-4nnn-8nnn-nnnnnnnnnnnn', 'kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk', 'Testing & Validation', 'TV', 1000000, 900000, 400000, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('oooooooo-oooo-4ooo-8ooo-oooooooooooo', 'kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk', 'Personnel', 'PE', 500000, 500000, 300000, 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
ON CONFLICT (id) DO NOTHING;