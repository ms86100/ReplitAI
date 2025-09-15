import React, { useEffect } from 'react';
import { useApiAuth } from '@/hooks/useApiAuth';
import DashboardLayout from '@/components/DashboardLayout';
import Dashboard from '@/components/Dashboard';

const Index = () => {
  const { user, loading } = useApiAuth();

  useEffect(() => {
    console.log('🏠 Index page loaded');
    console.log('👤 Current user:', user?.email || 'No user');
    console.log('⏳ Loading state:', loading);
    
    // Add a small delay to prevent race conditions with auth state
    const timer = setTimeout(() => {
      // Only redirect if not already on auth page and no user found after loading
      if (!loading && !user && window.location.pathname !== '/auth') {
        console.log('🔄 No user detected after delay, redirecting to auth');
        // Use window.location to avoid Router context issues during auth state
        window.location.href = '/auth';
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <Dashboard />
    </DashboardLayout>
  );
};

export default Index;
