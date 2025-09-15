-- Add the user as a project member so they can see project data
INSERT INTO public.project_members (
  project_id, 
  user_id, 
  role,
  joined_at
) VALUES (
  'd1a18682-04ed-45ac-88ab-c30aab9752dc',
  '57e5b843-afee-400d-8cd5-6a0b362c6d93',
  'member',
  now()
) ON CONFLICT (project_id, user_id) DO NOTHING;