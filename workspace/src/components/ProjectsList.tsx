import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiAuth } from '@/hooks/useApiAuth';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect, SimpleSelectItem } from '@/components/ui/simple-select';
import { Plus, Edit, Trash2, Calendar, User, FolderOpen } from 'lucide-react';

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

interface ProjectFormData {
  name: string;
  description: string;
  status: string;
  priority: string;
  start_date: string;
  end_date: string;
}

const ProjectsList = () => {
  const navigate = useNavigate();
  const { user } = useApiAuth();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    status: 'planning',
    priority: 'medium',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProjects();

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch projects');
      }
      
      setProjects(response.data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error",
        description: "Failed to fetch projects. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!user) return;

    try {
      const response = await apiClient.createProject({
        name: formData.name,
        description: formData.description,
        startDate: formData.start_date,
        endDate: formData.end_date,
        priority: formData.priority,
        status: formData.status,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to create project');
      }

      setProjects([response.data, ...projects]);
      setShowCreateDialog(false);
      resetForm();
      
      toast({
        title: "Success",
        description: "Project created successfully!",
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;

    try {
      const response = await apiClient.updateProject(editingProject.id, {
        name: formData.name,
        description: formData.description,
        startDate: formData.start_date,
        endDate: formData.end_date,
        priority: formData.priority,
        status: formData.status,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update project');
      }

      setProjects(projects.map(p => p.id === editingProject.id ? response.data : p));
      setShowEditDialog(false);
      setEditingProject(null);
      resetForm();
      
      toast({
        title: "Success",
        description: "Project updated successfully!",
      });
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await apiClient.deleteProject(projectId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete project');
      }

      setProjects(projects.filter(p => p.id !== projectId));
      
      toast({
        title: "Success",
        description: "Project deleted successfully!",
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'planning',
      priority: 'medium',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      status: project.status || 'planning',
      priority: project.priority || 'medium',
      start_date: project.start_date || '',
      end_date: project.end_date || ''
    });
    setShowEditDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blue Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome to Purple Cow</h1>
        <p className="text-blue-50 mb-6">Coordinate and track your assigned projects</p>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm mr-3">
              <Plus className="h-4 w-4 mr-2" />
              Create New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter project description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <SimpleSelect value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SimpleSelectItem value="planning">Planning</SimpleSelectItem>
                      <SimpleSelectItem value="active">Active</SimpleSelectItem>
                      <SimpleSelectItem value="completed">Completed</SimpleSelectItem>
                      <SimpleSelectItem value="cancelled">Cancelled</SimpleSelectItem>
                  </SimpleSelect>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <SimpleSelect value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SimpleSelectItem value="low">Low</SimpleSelectItem>
                      <SimpleSelectItem value="medium">Medium</SimpleSelectItem>
                      <SimpleSelectItem value="high">High</SimpleSelectItem>
                  </SimpleSelect>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateProject}
                  disabled={!formData.name.trim()}
                  className="bg-brand-primary hover:bg-brand-primary/90 text-brand-on-primary"
                >
                  Create Project
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recent Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Recent Projects</h2>
          </div>
          <div className="text-sm text-muted-foreground">
            Latest projects in the system
          </div>
          <Button variant="outline" onClick={() => navigate('/projects')}>
            View All Projects
          </Button>
        </div>
      </div>

      {/* Projects Grid */}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by creating your first project
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-brand-primary hover:bg-brand-primary/90 text-brand-on-primary">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle 
                    className="text-lg font-semibold truncate cursor-pointer hover:text-brand-primary"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    {project.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(project)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Project</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{project.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteProject(project.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge className={getStatusColor(project.status)}>
                    {project.status || 'planning'}
                  </Badge>
                  <Badge className={getPriorityColor(project.priority)}>
                    {project.priority || 'medium'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {project.description || 'No description provided'}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                  {project.start_date && (
                    <div className="flex items-center gap-1">
                      <span>Start:</span>
                      <span>{new Date(project.start_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter project name"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter project description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <SimpleSelect value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SimpleSelectItem value="planning">Planning</SimpleSelectItem>
                    <SimpleSelectItem value="active">Active</SimpleSelectItem>
                    <SimpleSelectItem value="completed">Completed</SimpleSelectItem>
                    <SimpleSelectItem value="cancelled">Cancelled</SimpleSelectItem>
                </SimpleSelect>
              </div>
              <div>
                <Label htmlFor="edit-priority">Priority</Label>
                <SimpleSelect value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                    <SimpleSelectItem value="low">Low</SimpleSelectItem>
                    <SimpleSelectItem value="medium">Medium</SimpleSelectItem>
                    <SimpleSelectItem value="high">High</SimpleSelectItem>
                </SimpleSelect>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start_date">Start Date</Label>
                <Input
                  id="edit-start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-end_date">End Date</Label>
                <Input
                  id="edit-end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateProject}
                disabled={!formData.name.trim()}
                className="bg-brand-primary hover:bg-brand-primary/90 text-brand-on-primary"
              >
                Update Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsList;