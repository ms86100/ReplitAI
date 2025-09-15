import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiAuth } from '@/hooks/useApiAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, FolderOpen, Calendar, BarChart3, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DepartmentManagement from '@/components/DepartmentManagement';
import DepartmentSelectionDialog from '@/components/DepartmentSelectionDialog';
import { apiClient } from '@/services/api';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  start_date: string;
  end_date: string;
  created_at: string;
  created_by: string;
}

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalUsers: number;
}

const Dashboard = () => {
  const { user } = useApiAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchUserRole();
      fetchProjects();
    }
  }, [user]);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchStats();
    }
  }, [userRole]);

  useEffect(() => {
    // Check if project coordinator needs department assignment
    if (userRole === "project_coordinator" && userProfile && !userProfile.department_id) {
      setShowDepartmentDialog(true);
    }
  }, [userRole, userProfile]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      const response = await apiClient.getUserProfile(user.id);
      
      if (response.success) {
        setUserProfile(response.data);
      } else {
        console.error("Error fetching user profile:", response.error);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const fetchUserRole = async () => {
    if (!user) return;
    
    try {
      const response = await apiClient.getUserRole(user.id);
      
      if (response.success) {
        setUserRole(response.data?.role || null);
      } else {
        console.error("Error fetching user role:", response.error);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await apiClient.getProjects();
      
      if (response.success) {
        // Get first 6 projects for dashboard display
        setProjects((response.data || []).slice(0, 6));
      } else {
        console.error('Error fetching projects:', response.error);
        toast({
          title: "Error",
          description: "Failed to load projects",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.getProjectStats();
      
      if (response.success) {
        setStats(response.data);
      } else {
        console.error('Error fetching stats:', response.error);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'completed':
        return 'outline';
      case 'on_hold':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const handleCreateProject = () => {
    if (userRole === "project_coordinator" && (!userProfile?.department_id)) {
      toast({
        title: "Department Required",
        description: "You must select a department before creating projects",
        variant: "destructive",
      });
      setShowDepartmentDialog(true);
      return;
    }
    navigate('/create-project');
  };

  const handleDepartmentAssigned = () => {
    fetchUserProfile();
    setShowDepartmentDialog(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-accent rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome to Purple Cow
        </h1>
        <p className="text-white/90 mb-4">
          {userRole === 'admin' 
            ? 'Manage all projects and users across the organization' 
            : 'Coordinate and track your assigned projects'}
        </p>
        {userProfile?.departments && (
          <div className="mb-4">
            <span className="text-white/90">Department: </span>
            <Badge variant="outline" className="bg-white/20 text-white border-white/30">
              {userProfile.departments.name}
            </Badge>
          </div>
        )}
        <Button variant="hero" size="lg" onClick={handleCreateProject}>
          <Plus className="h-5 w-5 mr-2" />
          Create New Project
        </Button>
      </div>

      {/* Stats Grid */}
      {userRole === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                Across all teams
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeProjects}</div>
              <p className="text-xs text-muted-foreground">
                Currently in progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedProjects}</div>
              <p className="text-xs text-muted-foreground">
                Successfully delivered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Registered team members
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Department Management - Only for Admins */}
      {userRole === 'admin' && (
        <DepartmentManagement />
      )}

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Recent Projects
              </CardTitle>
              <CardDescription>
                Latest projects in the system
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate('/projects')}>
              View All Projects
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No projects found. Create your first project to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className="hover:shadow-md transition-shadow border border-border cursor-pointer"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                      <div className="flex gap-1">
                        <Badge variant={getStatusBadgeVariant(project.status)}>
                          {project.status}
                        </Badge>
                        <Badge variant={getPriorityBadgeVariant(project.priority)}>
                          {project.priority}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {project.description || 'No description available'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {project.start_date 
                          ? new Date(project.start_date).toLocaleDateString()
                          : 'No start date'
                        }
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Selection Dialog */}
      <DepartmentSelectionDialog
        isOpen={showDepartmentDialog}
        onClose={() => setShowDepartmentDialog(false)}
        userId={user?.id || ""}
        onDepartmentAssigned={handleDepartmentAssigned}
      />
    </div>
  );
};

export default Dashboard;