import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';

// Define custom User interface for microservice auth
interface User {
  id: string;
  email: string;
  full_name?: string;
  created_at?: string;
  updated_at?: string;
}

// Define custom Session interface for microservice auth
interface Session {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  refresh_token?: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string; message?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to clean up auth state
export const cleanupAuthState = () => {
  // Remove microservice auth tokens
  localStorage.removeItem('auth_session');
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_role');
  localStorage.removeItem('app_session');
  
  // Also clean up any Supabase auth keys for safety
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch user role from API service
  const fetchUserRole = async (userId: string) => {
    try {
      const response = await apiClient.getUserRole(userId);
      if (response.success && response.data) {
        const role = response.data.role || null;
        setUserRole(role);
        localStorage.setItem('auth_role', role || '');
      } else {
        setUserRole(null);
        localStorage.removeItem('auth_role');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole(null);
      localStorage.removeItem('auth_role');
    }
  };

  // Refresh user data from API service
  const refreshUser = async () => {
    if (!session?.access_token || !user?.id) return;
    
    try {
      const response = await apiClient.getCurrentSession();
      if (response.success && response.data) {
        setUserRole(response.data.role || null);
        localStorage.setItem('auth_role', response.data.role || '');
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  // Initialize auth state from localStorage and sync with Supabase
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedSession = localStorage.getItem('auth_session');
        const storedUser = localStorage.getItem('auth_user');
        const storedRole = localStorage.getItem('auth_role');
        
        if (storedSession && storedUser) {
          try {
            const sessionData = JSON.parse(storedSession);
            const userData = JSON.parse(storedUser);
            
            // Only sync with Supabase if we have valid tokens
            if (sessionData.access_token && sessionData.refresh_token) {
              try {
                const { supabase } = await import('@/integrations/supabase/client');
                
                // Set the session in Supabase client
                await supabase.auth.setSession({
                  access_token: sessionData.access_token,
                  refresh_token: sessionData.refresh_token
                });
              } catch (supabaseError) {
                console.warn('Failed to sync with Supabase:', supabaseError);
                // Don't block if Supabase sync fails
              }
            }
            
            setSession(sessionData);
            setUser(userData);
            setUserRole(storedRole);
            
            // Fetch fresh role if available
            if (userData.id) {
              setTimeout(() => fetchUserRole(userData.id), 100);
            }
          } catch (error) {
            console.error('Error parsing stored auth:', error);
            cleanupAuthState();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      // Clean up any existing auth state first
      cleanupAuthState();
      
      // Use API service for login
      const response = await apiClient.login(email, password);
      
      if (!response.success) {
        return { error: response.error || 'Login failed' };
      }

      // Set auth state from API response
      if (response.data?.session && response.data?.user) {
        const sessionData = response.data.session;
        const userData = response.data.user;
        
        // Sync with Supabase client if session contains Supabase tokens
        if (sessionData.access_token && sessionData.refresh_token) {
          const { supabase } = await import('@/integrations/supabase/client');
          
          // Set the session in Supabase client
          await supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token
          });
        }
        
        setSession(sessionData);
        setUser(userData);
        
        // Store session in localStorage for persistence
        localStorage.setItem('auth_session', JSON.stringify(sessionData));
        localStorage.setItem('auth_user', JSON.stringify(userData));
        
        // Fetch user role
        if (userData.id) {
          fetchUserRole(userData.id);
        }
      }

      return {};
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: 'An unexpected error occurred' };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string): Promise<{ error?: string; message?: string }> => {
    try {
      // Clean up any existing auth state first
      cleanupAuthState();
      
      // Use API service for registration
      const response = await apiClient.register(email, password, fullName);
      
      if (!response.success) {
        return { error: response.error || 'Registration failed' };
      }

      // Update local state with the response
      if (response.data?.session) {
        const sessionData = response.data.session;
        const userData = response.data.user;
        
        // Sync with Supabase client if session contains Supabase tokens
        if (sessionData.access_token && sessionData.refresh_token) {
          const { supabase } = await import('@/integrations/supabase/client');
          
          // Set the session in Supabase client
          await supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token
          });
        }
        
        setSession(sessionData);
        setUser(userData);
        
        // Store session in localStorage
        localStorage.setItem('auth_session', JSON.stringify(sessionData));
        localStorage.setItem('auth_user', JSON.stringify(userData));
        
        // Fetch user role
        if (userData?.id) {
          fetchUserRole(userData.id);
        }
      }

      return { message: response.data?.message || 'Registration successful' };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      // Use API service for logout
      try {
        await apiClient.logout();
      } catch (err) {
        console.log('API logout failed, continuing with cleanup');
      }
      
      // Sign out from Supabase client as well
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.auth.signOut();
      } catch (err) {
        console.log('Supabase logout failed, continuing with cleanup');
      }
      
      // Clean up local state
      setSession(null);
      setUser(null);
      setUserRole(null);
      
      // Clean up auth state
      cleanupAuthState();
    } catch (error) {
      console.error('Sign out error:', error);
      // Force cleanup even if there's an error
      cleanupAuthState();
    }
  };

  const value = {
    user,
    session,
    userRole,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useApiAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useApiAuth must be used within an AuthProvider');
  }
  return context;
}