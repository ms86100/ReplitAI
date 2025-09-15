import React, { useState, useEffect } from 'react';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { TeamCapacityModule } from '@/components/workspace/TeamCapacityModule';

const TeamCapacity = () => {
  const { user, loading } = useApiAuth();
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Get project ID from URL params or default to a project
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');
    if (projectId) {
      setSelectedProjectId(projectId);
    } else {
      // Redirect to projects page to select a project
      navigate('/projects');
    }
  }, [navigate]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user || !selectedProjectId) {
    return null;
  }

  return (
    <DashboardLayout>
      {/* Remove ModuleAccessWrapper to bypass permissions temporarily */}
      <TeamCapacityModule projectId={selectedProjectId} />
    </DashboardLayout>
  );
};

export default TeamCapacity;