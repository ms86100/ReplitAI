import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  createSuccessResponse,
  createErrorResponse,
  handleCorsOptions,
  parseRequestBody,
  logRequest,
} from '../shared/api-utils.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  fullName?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  logRequest(method, path);

  try {
    // POST /auth/login
    if (method === 'POST' && path.endsWith('/login')) {
      const { email, password }: LoginRequest = await parseRequestBody(req);

      if (!email || !password) {
        return createErrorResponse('Email and password are required', 'MISSING_CREDENTIALS');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        return createErrorResponse(error.message, 'LOGIN_FAILED', 401);
      }

      return createSuccessResponse({
        user: data.user,
        session: data.session,
      });
    }

    // POST /auth/register
    if (method === 'POST' && path.endsWith('/register')) {
      const { email, password, fullName }: RegisterRequest = await parseRequestBody(req);

      if (!email || !password) {
        return createErrorResponse('Email and password are required', 'MISSING_CREDENTIALS');
      }

      const redirectUrl = `${url.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName || email,
          },
        },
      });

      if (error) {
        console.error('Register error:', error);
        return createErrorResponse(error.message, 'REGISTRATION_FAILED');
      }

      return createSuccessResponse({
        user: data.user,
        session: data.session,
        message: data.user?.email_confirmed_at ? 'Registration successful' : 'Please check your email to confirm registration',
      });
    }

    // POST /auth/logout
    if (method === 'POST' && path.endsWith('/logout')) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return createErrorResponse('No authorization header', 'MISSING_TOKEN', 401);
      }

      const token = authHeader.replace('Bearer ', '');
      const { error } = await supabase.auth.admin.signOut(token);

      if (error) {
        console.error('Logout error:', error);
        return createErrorResponse(error.message, 'LOGOUT_FAILED');
      }

      return createSuccessResponse({ message: 'Logged out successfully' });
    }

    // GET /auth/user
    if (method === 'GET' && path.endsWith('/user')) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return createErrorResponse('No authorization header', 'MISSING_TOKEN', 401);
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return createErrorResponse('Invalid token', 'INVALID_TOKEN', 401);
      }

      return createSuccessResponse({ user });
    }

    // POST /auth/refresh
    if (method === 'POST' && path.endsWith('/refresh')) {
      const { refresh_token } = await parseRequestBody(req);

      if (!refresh_token) {
        return createErrorResponse('Refresh token is required', 'MISSING_REFRESH_TOKEN');
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token,
      });

      if (error) {
        console.error('Refresh error:', error);
        return createErrorResponse(error.message, 'REFRESH_FAILED', 401);
      }

      return createSuccessResponse({
        user: data.user,
        session: data.session,
      });
    }

    // GET /auth-service/users/:id/profile - Get user profile
    if (method === 'GET' && path.includes('/users/') && path.endsWith('/profile')) {
      const pathParts = path.split('/');
      const userIdIndex = pathParts.findIndex(part => part === 'users') + 1;
      const userId = pathParts[userIdIndex];

      if (!userId) {
        return createErrorResponse('User ID is required', 'MISSING_USER_ID');
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(`
            *,
            departments(name)
          `)
          .eq('id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user profile:', error);
          return createErrorResponse('Failed to fetch user profile', 'FETCH_ERROR');
        }

        return createSuccessResponse(profile);
      } catch (error) {
        console.error('Error in profile endpoint:', error);
        return createErrorResponse('Internal server error', 'INTERNAL_ERROR', 500);
      }
    }

    // GET /auth-service/users/:id/role - Get user role
    if (method === 'GET' && path.includes('/users/') && path.endsWith('/role')) {
      const pathParts = path.split('/');
      const userIdIndex = pathParts.findIndex(part => part === 'users') + 1;
      const userId = pathParts[userIdIndex];

      if (!userId) {
        return createErrorResponse('User ID is required', 'MISSING_USER_ID');
      }

      try {
        const { data: userRole, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user role:', error);
          return createErrorResponse('Failed to fetch user role', 'FETCH_ERROR');
        }

        return createSuccessResponse({ role: userRole?.role || null });
      } catch (error) {
        console.error('Error in role endpoint:', error);
        return createErrorResponse('Internal server error', 'INTERNAL_ERROR', 500);
      }
    }

    // GET /auth-service/session - Get current session info
    if (method === 'GET' && path.endsWith('/session')) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return createErrorResponse('No authorization header', 'MISSING_TOKEN', 401);
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return createErrorResponse('Invalid token', 'INVALID_TOKEN', 401);
      }

      // Also fetch user role
      try {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        return createSuccessResponse({ 
          user, 
          role: userRole?.role || null 
        });
      } catch (error) {
        return createSuccessResponse({ 
          user, 
          role: null 
        });
      }
    }

    return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404);

  } catch (error) {
    console.error('Auth service error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
});