import React, { useState, useEffect } from 'react';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { RetrospectiveView } from '@/components/workspace/RetrospectiveView';
import { apiClient } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Calendar, Target, TrendingUp } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: string;
}

const Retrospectives = () => {
  const { user, loading } = useApiAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [retrospectiveStats, setRetrospectiveStats] = useState({
    totalRetrospectives: 0,
    totalActionItems: 0,
    convertedTasks: 0,
    conversionRate: 0
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchRetrospectiveStats();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      const response = await apiClient.getProjects();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch projects');
      }
      
      setProjects(response.data || []);
      
      // Auto-select first project if available
      if (response.data && response.data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchRetrospectiveStats = async () => {
    try {
      const response = await apiClient.getRetrospectiveStats();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch retrospective stats');
      }
      
      setRetrospectiveStats(response.data);
    } catch (error) {
      console.error('Error fetching retrospective stats:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Retrospectives</h1>
            <p className="text-muted-foreground">
              Reflect and improve with structured retrospectives across all projects
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RotateCcw className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Retrospectives</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{retrospectiveStats.totalRetrospectives}</div>
              <p className="text-xs text-muted-foreground">
                Across all projects
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Action Items</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{retrospectiveStats.totalActionItems}</div>
              <p className="text-xs text-muted-foreground">
                Total created
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasks Created</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{retrospectiveStats.convertedTasks}</div>
              <p className="text-xs text-muted-foreground">
                From action items
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{retrospectiveStats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">
                Action items to tasks
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Project Selector */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Project</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Choose a project to view and manage its retrospectives
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {projects.length} project{projects.length !== 1 ? 's' : ''} available
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a project to view retrospectives" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <span>{project.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {project.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProjectId && (
                <Button 
                  variant="outline" 
                  onClick={() => navigate(`/project/${selectedProjectId}`)}
                >
                  View Project
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Retrospective Content */}
        {selectedProjectId ? (
          <RetrospectiveView projectId={selectedProjectId} />
        ) : (
          <Card className="p-8">
            <div className="text-center">
              <RotateCcw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a Project</h3>
              <p className="text-muted-foreground mb-4">
                Choose a project from the dropdown above to view and manage its retrospectives
              </p>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Retrospectives;