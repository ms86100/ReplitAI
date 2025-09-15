import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SimpleSelect, SimpleSelectItem } from '@/components/ui/simple-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { format } from 'date-fns';

interface MilestoneManagementDialogProps {
  projectId: string;
  onMilestoneChange: () => void;
  triggerButton?: React.ReactNode;
}

interface Milestone {
  id: string;
  name: string;
  description?: string;
  due_date: string;
  status: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface MilestoneFormData {
  name: string;
  description: string;
  dueDate: string;
  status: string;
}

const statusOptions = [
  { value: 'planning', label: 'Planning', color: 'bg-blue-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-500' },
  { value: 'completed', label: 'Completed', color: 'bg-green-500' },
  { value: 'blocked', label: 'Blocked', color: 'bg-red-500' }
];

export function MilestoneManagementDialog({ projectId, onMilestoneChange, triggerButton }: MilestoneManagementDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState<MilestoneFormData>({
    name: '',
    description: '',
    dueDate: '',
    status: 'planning'
  });

  useEffect(() => {
    if (isOpen) {
      fetchMilestones();
    }
  }, [isOpen, projectId]);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRoadmap(projectId);
      if (response.success && response.data?.milestones) {
        setMilestones(response.data.milestones);
      }
    } catch (error) {
      console.error('Error fetching milestones:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch milestones',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      dueDate: '',
      status: 'planning'
    });
    setEditingMilestone(null);
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.dueDate) {
      toast({
        title: 'Validation Error',
        description: 'Name and due date are required',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await apiClient.createMilestone(projectId, {
        name: formData.name,
        description: formData.description || undefined,
        dueDate: formData.dueDate,
        status: formData.status as 'planning' | 'in_progress' | 'completed' | 'blocked'
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to create milestone');
      }

      toast({
        title: 'Success',
        description: 'Milestone created successfully'
      });

      resetForm();
      setIsCreateDialogOpen(false);
      await fetchMilestones();
      onMilestoneChange();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingMilestone || !formData.name.trim() || !formData.dueDate) {
      toast({
        title: 'Validation Error',
        description: 'Name and due date are required',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await apiClient.updateMilestone(projectId, editingMilestone.id, {
        name: formData.name,
        description: formData.description || undefined,
        dueDate: formData.dueDate,
        status: formData.status as 'planning' | 'in_progress' | 'completed' | 'blocked'
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update milestone');
      }

      toast({
        title: 'Success',
        description: 'Milestone updated successfully'
      });

      resetForm();
      await fetchMilestones();
      onMilestoneChange();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (milestone: Milestone) => {
    try {
      const response = await apiClient.deleteMilestone(projectId, milestone.id);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete milestone');
      }

      toast({
        title: 'Success',
        description: 'Milestone deleted successfully'
      });

      await fetchMilestones();
      onMilestoneChange();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const startEdit = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setFormData({
      name: milestone.name,
      description: milestone.description || '',
      dueDate: milestone.due_date,
      status: milestone.status
    });
    setIsCreateDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.color || 'bg-gray-500';
  };

  const getStatusLabel = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.label || status;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {triggerButton || (
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Manage Milestones
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Milestone Management</span>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Milestone
              </Button>
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading milestones...</div>
            </div>
          ) : milestones.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">No milestones found</div>
              <Button 
                className="mt-4" 
                onClick={() => setIsCreateDialogOpen(true)}
              >
                Create Your First Milestone
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {milestones.map((milestone) => (
                <Card key={milestone.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <CardTitle className="text-lg">{milestone.name}</CardTitle>
                        {milestone.description && (
                          <p className="text-sm text-muted-foreground">
                            {milestone.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Due: {format(new Date(milestone.due_date), 'MMM dd, yyyy')}</span>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={`${getStatusColor(milestone.status)} text-white`}
                          >
                            {getStatusLabel(milestone.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(milestone)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{milestone.name}"? This action cannot be undone.
                                All tasks associated with this milestone will become unassigned.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(milestone)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Milestone Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingMilestone ? 'Edit Milestone' : 'Create New Milestone'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Milestone Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter milestone name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter milestone description"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <SimpleSelect
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                  placeholder="Select status"
                >
                  {statusOptions.map(option => (
                    <SimpleSelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SimpleSelectItem>
                  ))}
                </SimpleSelect>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={editingMilestone ? handleUpdate : handleCreate}
              >
                {editingMilestone ? 'Update' : 'Create'} Milestone
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}