import React, { useState, useEffect } from 'react';
import { Plus, Calendar, CheckCircle, Clock, AlertCircle, Target, Edit, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect, SimpleSelectItem } from '@/components/ui/simple-select';
import { AddTaskDialog } from '@/components/workspace/AddTaskDialog';
import { AddTaskFromBacklogDialog } from '@/components/workspace/AddTaskFromBacklogDialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { format } from 'date-fns';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface StatusManagementViewProps {
  projectId: string;
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
  updated_at: string;
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  due_date: string;
  status: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Stakeholder {
  id: string;
  name: string;
  email?: string;
}

// Draggable Task Component
function DraggableTask({ task, stakeholders, onEdit, onDelete }: {
  task: Task;
  stakeholders: Stakeholder[];
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'planning': return 'outline';
      case 'todo': return 'outline';
      case 'blocked': return 'destructive';
      default: return 'outline';
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const getOwnerName = (ownerId: string) => {
    const stakeholder = stakeholders.find(s => s.id === ownerId);
    return stakeholder ? stakeholder.name : 'Unassigned';
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className="mb-3 transition-shadow hover:shadow-md"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-muted"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <h4 className="font-medium line-clamp-1">{task.title}</h4>
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getStatusBadgeVariant(task.status)}>
                {task.status.replace('_', ' ')}
              </Badge>
              <Badge variant={getPriorityBadgeVariant(task.priority)}>
                {task.priority}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Due: {formatDate(task.due_date)}
              </span>
              <span className="text-xs text-muted-foreground">
                Owner: {getOwnerName(task.owner_id)}
              </span>
            </div>
          </div>
          <div className="flex gap-1 ml-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(task)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(task)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Droppable Milestone Zone
function DroppableMilestone({ milestone, tasks, stakeholders, onTaskUpdate, onEdit, onDelete }: {
  milestone: Milestone;
  tasks: Task[];
  stakeholders: Stakeholder[];
  onTaskUpdate: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'in_progress': return Clock;
      case 'blocked': return AlertCircle;
      default: return Calendar;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'planning': return 'outline';
      case 'todo': return 'outline';
      case 'blocked': return 'destructive';
      default: return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const StatusIcon = getStatusIcon(milestone.status);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">{milestone.name}</CardTitle>
              {milestone.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {milestone.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <Badge variant={getStatusBadgeVariant(milestone.status)}>
                {milestone.status.replace('_', ' ')}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">
                Due: {formatDate(milestone.due_date)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <AddTaskDialog 
            milestoneId={milestone.id} 
            projectId={milestone.project_id} 
            onTaskAdded={onTaskUpdate} 
          />
          <AddTaskFromBacklogDialog 
            milestoneId={milestone.id} 
            projectId={milestone.project_id} 
            onTaskAdded={onTaskUpdate} 
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-sm text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </div>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tasks in this milestone</p>
                <p className="text-xs mt-1">Add tasks or drag them here</p>
              </div>
            ) : (
              tasks.map((task) => (
                <DraggableTask
                  key={task.id}
                  task={task}
                  stakeholders={stakeholders}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}

export function StatusManagementView({ projectId }: StatusManagementViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    status: '',
    priority: '',
    due_date: '',
    owner_id: ''
  });
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [tasksResponse, milestonesResponse, stakeholdersResponse] = await Promise.all([
        apiClient.getTasks(projectId),
        apiClient.getMilestones(projectId),
        apiClient.getStakeholders(projectId)
      ]);
      
      if (tasksResponse.success) {
        const taskData = Array.isArray(tasksResponse.data) 
          ? tasksResponse.data 
          : (tasksResponse.data && typeof tasksResponse.data === 'object' && 'tasks' in tasksResponse.data)
            ? (tasksResponse.data as any).tasks || []
            : [];
        setTasks(taskData);
      }
      
      if (milestonesResponse.success) {
        const milestoneData = Array.isArray(milestonesResponse.data) 
          ? milestonesResponse.data 
          : (milestonesResponse.data && typeof milestonesResponse.data === 'object' && 'milestones' in milestonesResponse.data)
            ? (milestonesResponse.data as any).milestones || []
            : [];
        setMilestones(milestoneData);
      }

      if (stakeholdersResponse.success) {
        const stakeholderData = Array.isArray(stakeholdersResponse.data) 
          ? stakeholdersResponse.data 
          : (stakeholdersResponse.data?.stakeholders && Array.isArray(stakeholdersResponse.data.stakeholders))
            ? stakeholdersResponse.data.stakeholders
            : [];
        setStakeholders(stakeholderData);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading data",
        description: "Failed to load tasks and milestones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const taskId = active.id as string;
    const newMilestoneId = over.id as string;
    
    try {
      const response = await apiClient.updateTask(taskId, { milestoneId: newMilestoneId });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to move task');
      }

      toast({
        title: "Success",
        description: "Task moved successfully",
      });

      fetchData();
    } catch (error) {
      console.error('Error moving task:', error);
      toast({
        title: "Error",
        description: "Failed to move task",
        variant: "destructive",
      });
    }
  };

  const handleEditTask = (task: Task) => {
    console.log('Edit task clicked:', task);
    setEditingTask(task);
    
    // Format date for HTML date input (YYYY-MM-DD)
    let formattedDate = '';
    if (task.due_date) {
      try {
        const date = new Date(task.due_date);
        formattedDate = date.toISOString().split('T')[0];
      } catch (e) {
        console.log('Date formatting error:', e);
        formattedDate = '';
      }
    }
    
    setEditFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: formattedDate,
      owner_id: task.owner_id || ''
    });
    console.log('Edit form data set:', {
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: formattedDate,
      owner_id: task.owner_id || '',
      originalDate: task.due_date
    });
  };

  const handleUpdateTask = async () => {
    console.log('Update task called with:', editFormData);
    if (!editingTask) {
      console.log('No editing task found');
      return;
    }

    try {
      const payload = {
        title: editFormData.title,
        description: editFormData.description?.trim() || undefined,
        status: editFormData.status,
        priority: editFormData.priority,
        dueDate: editFormData.due_date || undefined,
        ownerId: editFormData.owner_id || undefined,
      };
      console.log('Sending update payload:', payload);
      const response = await apiClient.updateTask(editingTask.id, payload);
      console.log('Update response:', response);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update task');
      }

      toast({
        title: "Success",
        description: "Task updated successfully",
      });

      setEditingTask(null);
      fetchData();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTask) return;

    try {
      const response = await apiClient.deleteTask(deletingTask.id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete task');
      }

      toast({
        title: "Success",
        description: "Task deleted successfully",
      });

      setDeletingTask(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  // Group tasks by milestone
  const groupedTasks = milestones.map(milestone => ({
    milestone,
    tasks: tasks.filter(task => task.milestone_id === milestone.id)
  }));

  // Add unassigned tasks
  const unassignedTasks = tasks.filter(task => !task.milestone_id);
  if (unassignedTasks.length > 0) {
    groupedTasks.push({
      milestone: {
        id: 'unassigned',
        name: 'Unassigned Tasks',
        description: 'Tasks not assigned to any milestone',
        status: 'planning',
        due_date: '',
        project_id: projectId,
        created_by: '',
        created_at: '',
        updated_at: ''
      },
      tasks: unassignedTasks
    });
  }

  // Calculate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const totalMilestones = milestones.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Tasks & Milestones</h2>
        <p className="text-muted-foreground">Manage project tasks organized by milestones</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{totalTasks}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completedTasks}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{inProgressTasks}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Milestones</p>
                <p className="text-2xl font-bold">{totalMilestones}</p>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestones with Tasks */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-6">
          {groupedTasks.map((group) => (
            <DroppableMilestone
              key={group.milestone.id}
              milestone={group.milestone}
              tasks={group.tasks}
              stakeholders={stakeholders}
              onTaskUpdate={fetchData}
              onEdit={handleEditTask}
              onDelete={setDeletingTask}
            />
          ))}
        </div>
      </DndContext>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Task Title</Label>
              <Input
                id="edit-title"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <SimpleSelect
                  value={editFormData.status || ""}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                  placeholder="Select status"
                >
                  <SimpleSelectItem value="todo">To Do</SimpleSelectItem>
                  <SimpleSelectItem value="in_progress">In Progress</SimpleSelectItem>
                  <SimpleSelectItem value="completed">Completed</SimpleSelectItem>
                  <SimpleSelectItem value="blocked">Blocked</SimpleSelectItem>
                </SimpleSelect>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <SimpleSelect
                  value={editFormData.priority || ""}
                  onValueChange={(value) => setEditFormData({ ...editFormData, priority: value })}
                  placeholder="Select priority"
                >
                  <SimpleSelectItem value="low">Low</SimpleSelectItem>
                  <SimpleSelectItem value="medium">Medium</SimpleSelectItem>
                  <SimpleSelectItem value="high">High</SimpleSelectItem>
                  <SimpleSelectItem value="critical">Critical</SimpleSelectItem>
                </SimpleSelect>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={editFormData.due_date || ""}
                  onChange={(e) => {
                    console.log('Date changed to:', e.target.value);
                    setEditFormData({ ...editFormData, due_date: e.target.value });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <SimpleSelect
                  value={editFormData.owner_id || ""}
                  onValueChange={(value) => {
                    console.log('Owner changed to:', value);
                    setEditFormData({ ...editFormData, owner_id: value === "" ? "" : value });
                  }}
                  placeholder="Select owner"
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
              <Button variant="outline" onClick={() => setEditingTask(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTask}>
                Update Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Task Dialog */}
      <AlertDialog open={!!deletingTask} onOpenChange={() => setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTask?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}