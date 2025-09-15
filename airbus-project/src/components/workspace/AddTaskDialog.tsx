import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SimpleSelect, SimpleSelectItem } from '@/components/ui/simple-select';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';

interface AddTaskDialogProps {
  milestoneId: string;
  projectId: string;
  onTaskAdded: () => void;
}

interface Stakeholder {
  id: string;
  name: string;
  email?: string;
  department?: string;
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

export function AddTaskDialog({ milestoneId, projectId, onTaskAdded }: AddTaskDialogProps) {
  const { user } = useApiAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: '',
    owner_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchStakeholders();
    }
  }, [isOpen, projectId]);

  const fetchStakeholders = async () => {
    try {
      const response = await apiClient.getStakeholders(projectId);
      
      if (!response.success) {
        console.error('Error fetching stakeholders:', response.error);
        return;
      }
      
      // Handle different response formats from stakeholder service
      let stakeholdersList: Stakeholder[] = [];
      if (Array.isArray(response.data)) {
        stakeholdersList = response.data;
      } else if (response.data?.stakeholders && Array.isArray(response.data.stakeholders)) {
        stakeholdersList = response.data.stakeholders;
      }
      
      setStakeholders(stakeholdersList);
    } catch (error: any) {
      console.error('Error fetching stakeholders:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title.trim()) return;

    try {
      const taskData = {
        title: formData.title,
        description: formData.description || null,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.due_date || null,
        owner_id: formData.owner_id || null,
        milestone_id: milestoneId,
      };

      const response = await apiClient.createTaskForMilestone(projectId, taskData);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create task');
      }
      
      toast({
        title: "Task created",
        description: "New task has been added to the milestone.",
      });
      
      resetForm();
      onTaskAdded();
    } catch (error: any) {
      toast({
        title: "Error creating task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      due_date: '',
      owner_id: ''
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              Add Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}