import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApiAuth } from '@/hooks/useApiAuth';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Edit3, Trash2, Calendar, Users, CheckCircle, Clock, AlertCircle, Plus, ChevronDown, Table } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DashboardLayout from '@/components/DashboardLayout';
import { RoadmapView } from '@/components/workspace/RoadmapView';
import { KanbanView } from '@/components/workspace/KanbanView';
import { StakeholdersManagement } from '@/components/workspace/StakeholdersManagement';
import { RiskRegisterView } from '@/components/workspace/RiskRegisterView';
import { StatusManagementView } from '@/components/workspace/StatusManagementView';
import { TaskCard } from '@/components/workspace/TaskManagement';
import { TasksTableView } from '@/components/workspace/TasksTableView';
import { AddTaskDialog } from '@/components/workspace/AddTaskDialog';
import { AddTaskFromBacklogDialog } from '@/components/workspace/AddTaskFromBacklogDialog';
import { DiscussionLog } from '@/components/workspace/DiscussionLog';
import { TaskBacklog } from '@/components/workspace/TaskBacklog';
import { TeamCapacityTracker } from '@/components/workspace/TeamCapacityTracker';
import { RetrospectiveView } from '@/components/workspace/RetrospectiveView';
import { ProjectBudgetManagement } from '@/components/workspace/ProjectBudgetManagement';
import { ProjectAnalyticsDashboard } from '@/components/analytics/ProjectAnalyticsDashboard';
import { useModulePermissions, ModuleName } from '@/hooks/useModulePermissions';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  start_date: string;
  end_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Milestone {
  id: string;
  name: string;
  due_date: string;
  status: string;
  description: string;
  project_id: string;
  created_by: string;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  owner_id: string;
  milestone_id: string;
  project_id: string;
  created_by: string;
  created_at: string;
}

const ProjectOverview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useApiAuth();
  const { toast } = useToast();
  const { canRead } = useModulePermissions(id || '');

  const [project, setProject] = useState<Project | null>(null);
  const [workspaceData, setWorkspaceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Define module tabs with their permissions - only show Overview/Analytics
  const moduleTabsConfig = [
    { value: 'overview', label: 'Overview', module: 'overview' as ModuleName },
  ];

  // Filter tabs based on permissions
  const allowedTabs = moduleTabsConfig.filter(tab => canRead(tab.module));

  console.log('ProjectOverview - allowedTabs:', allowedTabs.map(t => t.label));

  useEffect(() => {
    if (id) {
      fetchProjectData();
    }
  }, [id]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      
      // Fetch project details
      const projectResponse = await apiClient.getProject(id!);
      if (!projectResponse.success) {
        throw new Error(projectResponse.error || 'Failed to fetch project');
      }
      setProject(projectResponse.data);

      // Fetch workspace data (summary, recent tasks, milestones)
      const workspaceResponse = await apiClient.getWorkspace(id!);
      if (!workspaceResponse.success) {
        throw new Error(workspaceResponse.error || 'Failed to fetch workspace data');
      }
      setWorkspaceData(workspaceResponse.data);

    } catch (error) {
      console.error('Error fetching project data:', error);
      toast({
        title: "Error",
        description: "Failed to load project data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async () => {
    if (!project || !user || deleteConfirmText !== project.name) return;

    try {
      const response = await apiClient.deleteProject(project.id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete project');
      }

      toast({
        title: "Project Deleted",
        description: "The project has been permanently deleted.",
      });
      navigate('/');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Error",
        description: "Failed to delete project.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'planning': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'in_progress': return Clock;
      default: return AlertCircle;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading project...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Project not found</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6" style={{ width: '100%' }}>
          {/* Header */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/projects')} className="shrink-0">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Button
                  onClick={() => navigate(`/project/${id}/roadmap`)}
                  className="w-full sm:w-auto"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Open Workspace
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/project/${id}/edit`)}
                  className="w-full sm:w-auto"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Project
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto text-status-error border-status-error hover:bg-status-error hover:text-white">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Project
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. Type the project name "{project.name}" to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type project name"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={deleteProject}
                        disabled={deleteConfirmText !== project.name}
                        className="bg-status-error hover:bg-status-error/90"
                      >
                        Delete Project
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="p-6">
              <div className="border-l-4 border-airbus-primary pl-4">
                <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
                <p className="text-muted-foreground mt-2 text-lg">{project.description}</p>
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  <Badge variant={getStatusBadgeVariant(project.status)} className="text-sm">
                    {React.createElement(getStatusIcon(project.status), { className: "h-3 w-3 mr-1" })}
                    {project.status.replace('_', ' ')}
                  </Badge>
                  {project.start_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(project.start_date).toLocaleDateString()} - {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'Ongoing'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs with permission-based visibility */}
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <Tabs defaultValue={allowedTabs.length > 0 ? allowedTabs[0].value : 'overview'} className="w-full">
              {/* Show tabs only when there's more than one allowed tab */}
              {allowedTabs.length > 1 ? (
                <div className="border-b border-border bg-muted/5">
                  <TabsList className="w-full h-auto p-0 bg-transparent">
                    {allowedTabs.map((tab) => (
                      <TabsTrigger 
                        key={tab.value}
                        value={tab.value} 
                        className="flex-1 data-[state=active]:bg-airbus-primary data-[state=active]:text-white"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              ) : null}

              {/* Only render tab content for modules the user has access to */}
              {canRead('overview') && (
                <TabsContent value="overview" className="p-6">
                  <ProjectAnalyticsDashboard projectId={id!} />
                </TabsContent>
              )}

            </Tabs>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProjectOverview;