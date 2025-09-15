import React from 'react';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import ProjectsList from '@/components/ProjectsList';

const Projects = () => {
  const { user, loading } = useApiAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <DashboardLayout>
      <ProjectsList />
    </DashboardLayout>
  );
};

export default Projects;