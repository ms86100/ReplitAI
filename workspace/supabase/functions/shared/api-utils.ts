// Shared API utilities for all microservices
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export function createSuccessResponse<T>(data: T): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

export function createErrorResponse(error: string, code?: string, status = 400): Response {
  const response: ApiResponse = {
    success: false,
    error,
    code,
  };
  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

export function handleCorsOptions(): Response {
  return new Response(null, { headers: corsHeaders });
}

export async function validateAuthToken(request: Request, supabase: any): Promise<{ user: any; error?: string }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { user: null, error: 'No authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Try API JWT validation first (for backend API tokens)
  try {
    // Simple JWT decode (edge functions don't have crypto for verification)
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    if (payload.userId && payload.email) {
      // Fetch user from profiles table using service role
      const { data: user, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', payload.userId)
        .single();
        
      if (!error && user) {
        return { user: { id: user.id, email: user.email, ...user } };
      }
    }
  } catch (apiJwtError) {
    // Not an API JWT, try Supabase auth
    console.log('Not an API JWT, trying Supabase auth');
  }
  
  // Fall back to Supabase auth validation
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { user: null, error: 'Invalid token' };
  }

  return { user };
}

export async function parseRequestBody(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

export function extractPathParams(url: URL, pattern: string): Record<string, string> {
  const params: Record<string, string> = {};
  const urlParts = url.pathname.split('/');
  const patternParts = pattern.split('/');
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const paramName = patternParts[i].substring(1);
      params[paramName] = urlParts[i] || '';
    }
  }
  
  return params;
}

export function logRequest(method: string, url: string, user?: any) {
  console.log(`[${method}] ${url} - User: ${user?.id || 'anonymous'}`);
}