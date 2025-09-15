-- Sample analytics data to showcase dashboard functionality
-- Insert sample projects
INSERT INTO projects (id, name, description, status, priority, created_by, department_id, start_date, end_date) VALUES
('a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'Airbus A350 Navigation System', 'Advanced navigation system development for A350 aircraft', 'active', 'high', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', null, '2024-01-15', '2024-12-15'),
('b7c7d686-7818-5e99-c9g9-2251gc2ddf68', 'Boeing 787 Communication Hub', 'Next-generation communication system for 787 Dreamliner', 'active', 'medium', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', null, '2024-02-01', '2024-11-30');

-- Insert sample tasks with various statuses
INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, milestone_id, assigned_to, created_by) VALUES
('t1', 'Navigation Algorithm Implementation', 'Develop core navigation algorithms', 'completed', 'high', '2024-03-15', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('t2', 'GPS Integration Testing', 'Test GPS integration with navigation system', 'in_progress', 'high', '2024-04-20', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('t3', 'Safety Protocol Validation', 'Validate safety protocols for navigation system', 'blocked', 'critical', '2024-05-10', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('t4', 'UI Dashboard Development', 'Create pilot interface dashboard', 'todo', 'medium', '2024-06-01', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('t5', 'Hardware Integration', 'Integrate with aircraft hardware systems', 'overdue', 'high', '2024-03-01', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('t6', 'Performance Testing', 'Conduct performance benchmarks', 'in_progress', 'medium', '2024-04-30', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', null, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Insert sample milestones
INSERT INTO milestones (id, name, description, due_date, status, project_id, created_by) VALUES
('m1', 'Alpha Release', 'Initial system alpha release with core functionality', '2024-04-15', 'completed', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('m2', 'Beta Testing Phase', 'Comprehensive beta testing with pilot feedback', '2024-07-15', 'in_progress', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('m3', 'Production Ready', 'Final production-ready system', '2024-11-30', 'planning', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Insert sample stakeholders
INSERT INTO stakeholders (id, name, email, role, interest_level, influence_level, project_id, created_by) VALUES
('s1', 'Captain Sarah Mitchell', 'sarah.mitchell@airbus.com', 'Pilot Representative', 'high', 'high', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('s2', 'Dr. Andreas Weber', 'andreas.weber@airbus.com', 'Chief Engineer', 'high', 'high', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('s3', 'Marie Dubois', 'marie.dubois@airbus.com', 'Safety Officer', 'high', 'medium', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('s4', 'James Thompson', 'james.thompson@airbus.com', 'Project Sponsor', 'medium', 'high', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Insert sample risks
INSERT INTO risk_register (id, risk_title, risk_description, probability, impact, category, status, mitigation_strategy, project_id, created_by) VALUES
('r1', 'GPS Signal Interference', 'Potential interference with GPS signals in certain flight conditions', 'medium', 'high', 'Technical', 'active', 'Implement backup navigation systems and signal filtering', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('r2', 'Regulatory Approval Delays', 'Aviation authorities may require additional testing', 'high', 'high', 'Regulatory', 'active', 'Early engagement with regulatory bodies and comprehensive documentation', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('r3', 'Hardware Component Shortage', 'Critical navigation chips may face supply chain issues', 'low', 'high', 'Supply Chain', 'mitigated', 'Secured alternative suppliers and maintained buffer inventory', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Insert sample project budget
INSERT INTO project_budgets (id, project_id, total_budget_allocated, total_budget_received, currency, created_by) VALUES
('pb1', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 5000000, 4800000, 'EUR', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Insert sample budget categories
INSERT INTO budget_categories (id, project_budget_id, name, budget_type_code, budget_allocated, budget_received, amount_spent, created_by) VALUES
('bc1', 'pb1', 'Research & Development', 'RD', 2000000, 1900000, 1200000, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('bc2', 'pb1', 'Hardware Components', 'HW', 1500000, 1500000, 800000, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('bc3', 'pb1', 'Testing & Validation', 'TV', 1000000, 900000, 400000, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('bc4', 'pb1', 'Personnel', 'PE', 500000, 500000, 300000, 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Insert sample budget spending
INSERT INTO budget_spending (id, budget_category_id, description, amount, date, vendor, status, created_by) VALUES
('bs1', 'bc1', 'Algorithm development tools and licenses', 50000, '2024-02-15', 'TechSoft Solutions', 'approved', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('bs2', 'bc2', 'High-precision GPS modules', 120000, '2024-03-01', 'NavTech Industries', 'approved', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('bs3', 'bc3', 'Flight simulator testing sessions', 80000, '2024-03-15', 'AeroSim Labs', 'approved', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('bs4', 'bc4', 'Senior engineer consulting', 45000, '2024-02-28', 'Expert Consulting Ltd', 'approved', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Insert sample retrospectives
INSERT INTO retrospectives (id, project_id, framework, status, created_by) VALUES
('ret1', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'Start-Stop-Continue', 'completed', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('ret2', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'What Went Well', 'active', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Insert sample team capacity data
INSERT INTO teams (id, name, project_id, created_by) VALUES
('team1', 'Navigation Development Team', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

INSERT INTO team_members (id, team_id, user_id, role, capacity_hours_per_week) VALUES
('tm1', 'team1', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Lead Developer', 40),
('tm2', 'team1', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Navigation Engineer', 40),
('tm3', 'team1', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Test Engineer', 35);

INSERT INTO iterations (id, name, type, start_date, end_date, weeks_count, team_id, project_id, created_by) VALUES
('iter1', 'Q1 2024 Sprint', 'development', '2024-01-15', '2024-03-31', 11, 'team1', 'a6b6e575-6807-4e99-b9f9-1140fb1ccf57', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');