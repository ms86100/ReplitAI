import React, { useState, useEffect } from 'react';
import { Edit, Trash2, User, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SimpleSelect, SimpleSelectItem } from '@/components/ui/simple-select';
import { Card, CardContent } from '@/components/ui/card';

import { useApiAuth } from '@/hooks/useApiAuth';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';

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
}

interface Stakeholder {
  id: string;
  name: string;
  email?: string;
  department?: string;
}

interface TaskCardProps {
  task: Task;
  projectId: string;
  onTaskUpdate: () => void;
}

const statusOptions = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' }
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
];

export function TaskCard({ task, projectId, onTaskUpdate }: TaskCardProps) {
  const { user } = useApiAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [stakeholder, setStakeholder] = useState<Stakeholder | null>(null);
  
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority || 'medium',
    due_date: task.due_date || '',
    owner_id: task.owner_id || ''
  });

  useEffect(() => {
    fetchStakeholders();
    if (task.owner_id) {
      fetchTaskOwner();
    }
  }, [projectId, task.owner_id]);

  const fetchStakeholders = async () => {
    try {
      const response = await apiClient.getStakeholders(projectId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch stakeholders');
      }
      
      setStakeholders(response.data?.stakeholders || []);
    } catch (error: any) {
      console.error('Error fetching stakeholders:', error);
    }
  };

  const fetchTaskOwner = async () => {
    if (!task.owner_id) return;
    
    try {
      const response = await apiClient.getStakeholders(projectId);
      
      if (response.success && response.data?.stakeholders) {
        const owner = response.data.stakeholders.find(s => s.id === task.owner_id);
        setStakeholder(owner || null);
      }
    } catch (error: any) {
      console.error('Error fetching task owner:', error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const response = await apiClient.updateTask(task.id, {
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        priority: formData.priority,
        dueDate: formData.due_date || undefined,
        ownerId: formData.owner_id || undefined
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update task');
      }
      
      toast({
        title: "Task updated",
        description: "Task has been updated successfully.",
      });
      
      setIsEditing(false);
      onTaskUpdate();
    } catch (error: any) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const response = await apiClient.deleteTask(task.id);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete task');
      }
      
      toast({
        title: "Task deleted",
        description: "Task has been removed from the project.",
      });
      
      onTaskUpdate();
    } catch (error: any) {
      toast({
        title: "Error deleting task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority || 'medium',
      due_date: task.due_date || '',
      owner_id: task.owner_id || ''
    });
    setIsEditing(false);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'on_hold': return 'outline';
      case 'todo': return 'outline';
      default: return 'outline';
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
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

  return (
    <Card className="bg-muted/50 hover:bg-muted/70 transition-colors">
      <CardContent className="p-4 mt-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {React.createElement(getStatusIcon(task.status), { 
                  className: "h-4 w-4 text-muted-foreground shrink-0" 
                })}
                <h4 className="font-medium text-foreground truncate">{task.title}</h4>
              </div>
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[650px]">
                  <DialogHeader>
                    <DialogTitle>Edit Task</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleUpdate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Task Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Enter task title"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Enter task description"
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <SimpleSelect
                          value={formData.priority}
                          onValueChange={(value) => setFormData({ ...formData, priority: value })}
                          placeholder="Select priority"
                        >
                          {priorityOptions.map(option => (
                            <SimpleSelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SimpleSelectItem>
                          ))}
                        </SimpleSelect>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="due_date">Due Date</Label>
                        <Input
                          id="due_date"
                          type="date"
                          value={formData.due_date}
                          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="owner">Task Owner</Label>
                        <SimpleSelect
                          value={formData.owner_id}
                          onValueChange={(value) => setFormData({ ...formData, owner_id: value })}
                          placeholder="Select task owner"
                        >
                          <SimpleSelectItem value="">No owner assigned</SimpleSelectItem>
                          {stakeholders.map(stakeholder => (
                            <SimpleSelectItem key={stakeholder.id} value={stakeholder.id}>
                              {stakeholder.name}
                            </SimpleSelectItem>
                          ))}
                        </SimpleSelect>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        Update Task
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Task</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{task.title}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete Task
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getStatusBadgeVariant(task.status)} className="text-xs">
              {task.status.replace('_', ' ')}
            </Badge>
            <Badge variant={getPriorityBadgeVariant(task.priority)} className="text-xs">
              {task.priority}
            </Badge>
            {task.due_date && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </div>
            )}
            {stakeholder && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                {stakeholder.name}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}