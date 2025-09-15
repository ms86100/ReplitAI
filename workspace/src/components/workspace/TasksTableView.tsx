import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Search, Filter, Eye, Edit, Trash2, Clock, CheckCircle, AlertCircle, Target, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

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

interface TasksTableViewProps {
  tasks: Task[];
  milestones: Milestone[];
  onTaskUpdate?: () => void;
  onMilestoneUpdate?: () => void;
}

type ItemType = 'task' | 'milestone';
type TableItem = (Task | Milestone) & { type: ItemType; milestone_name?: string };

export function TasksTableView({ tasks, milestones, onTaskUpdate, onMilestoneUpdate }: TasksTableViewProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set(milestones.map(m => m.id)));
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group tasks by milestone
  const groupedData = useMemo(() => {
    const groups = milestones.map(milestone => {
      const milestoneTasks = tasks.filter(task => task.milestone_id === milestone.id);
      return {
        milestone,
        tasks: milestoneTasks.filter(task => {
          const matchesSearch = task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                               task.description?.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
          const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
          return matchesSearch && matchesStatus && matchesPriority;
        })
      };
    });

    // Add unassigned tasks group
    const unassignedTasks = tasks.filter(task => !task.milestone_id).filter(task => {
      const matchesSearch = task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });

    if (unassignedTasks.length > 0) {
      groups.push({
        milestone: {
          id: 'unassigned',
          name: 'Unassigned Tasks',
          description: 'Tasks not assigned to any milestone',
          status: 'planning',
          due_date: '',
          project_id: '',
          created_by: '',
          created_at: ''
        },
        tasks: unassignedTasks
      });
    }

    return groups;
  }, [tasks, milestones, searchTerm, statusFilter, priorityFilter]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const taskId = active.id as string;
    const newMilestoneId = over.id === 'unassigned' ? null : over.id as string;
    
    try {
      const response = await apiClient.moveTask(taskId, newMilestoneId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to move task');
      }

      toast({
        title: "Success",
        description: "Task moved successfully",
      });

      onTaskUpdate?.();
    } catch (error) {
      console.error('Error moving task:', error);
      toast({
        title: "Error",
        description: "Failed to move task",
        variant: "destructive",
      });
    }
  }, [onTaskUpdate]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      const response = await apiClient.deleteTask(taskId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete task');
      }

      toast({
        title: "Success",
        description: "Task deleted successfully",
      });

      setDeletingTask(null);
      onTaskUpdate?.();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  }, [onTaskUpdate]);

  const handleEditTask = useCallback(async (task: Task, updatedData: Partial<Task>) => {
    try {
      const response = await apiClient.updateTask(task.id, updatedData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update task');
      }

      toast({
        title: "Success",
        description: "Task updated successfully",
      });

      setEditingTask(null);
      onTaskUpdate?.();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  }, [onTaskUpdate]);

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) {
        newSet.delete(milestoneId);
      } else {
        newSet.add(milestoneId);
      }
      return newSet;
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'planning': return 'outline';
      case 'todo': return 'outline';
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

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{totalTasks}</p>
              </div>
              <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-primary" />
              </div>
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
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
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
              <div className="h-8 w-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Milestones</p>
                <p className="text-2xl font-bold">{milestones.length}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-[9999]">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-[9999]">
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grouped Table */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {groupedData.map((group) => (
            <Card key={group.milestone.id} className="overflow-hidden">
              <Collapsible 
                open={expandedMilestones.has(group.milestone.id)}
                onOpenChange={() => toggleMilestone(group.milestone.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedMilestones.has(group.milestone.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <div className="flex items-center gap-2">
                          <Target className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-semibold">{group.milestone.name}</h3>
                          <Badge variant="outline" className="ml-2">
                            {group.tasks.length} tasks
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {group.milestone.due_date && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(group.milestone.due_date)}
                          </div>
                        )}
                        <Badge variant={getStatusBadgeVariant(group.milestone.status)}>
                          {group.milestone.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    {group.milestone.description && (
                      <p className="text-sm text-muted-foreground mt-2 ml-7">
                        {group.milestone.description}
                      </p>
                    )}
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <MilestoneDropZone milestoneId={group.milestone.id}>
                    <CardContent className="p-0">
                      {group.tasks.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="w-[40px]"></TableHead>
                              <TableHead className="min-w-[200px]">Task</TableHead>
                              <TableHead className="min-w-[300px]">Description</TableHead>
                              <TableHead className="w-[120px]">Status</TableHead>
                              <TableHead className="w-[100px]">Priority</TableHead>
                              <TableHead className="w-[130px]">Due Date</TableHead>
                              <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.tasks.map((task) => (
                              <DraggableTaskRow 
                                key={task.id} 
                                task={task} 
                                getStatusIcon={getStatusIcon}
                                getStatusBadgeVariant={getStatusBadgeVariant}
                                getPriorityBadgeVariant={getPriorityBadgeVariant}
                                formatDate={formatDate}
                                onView={() => setViewingTask(task)}
                                onEdit={() => setEditingTask(task)}
                                onDelete={() => setDeletingTask(task)}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="text-sm">No tasks in this milestone</p>
                          <p className="text-xs">Drag tasks here to assign them</p>
                        </div>
                      )}
                    </CardContent>
                  </MilestoneDropZone>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
          
          {groupedData.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No items found</h3>
                <p className="text-muted-foreground text-center">
                  Try adjusting your search criteria
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DndContext>

      {/* View Task Modal */}
      <Dialog open={!!viewingTask} onOpenChange={() => setViewingTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Task Details
            </DialogTitle>
          </DialogHeader>
          {viewingTask && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Title</Label>
                <p className="text-sm text-muted-foreground mt-1">{viewingTask.title}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-sm text-muted-foreground mt-1">{viewingTask.description || 'No description'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(viewingTask.status)}>
                      {viewingTask.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Priority</Label>
                  <div className="mt-1">
                    <Badge variant={getPriorityBadgeVariant(viewingTask.priority)}>
                      {viewingTask.priority}
                    </Badge>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Due Date</Label>
                <p className="text-sm text-muted-foreground mt-1">{formatDate(viewingTask.due_date)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Task Modal */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Task
            </DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-4">
              <EditTaskForm 
                task={editingTask} 
                onSave={(updatedData) => handleEditTask(editingTask, updatedData)}
                onCancel={() => setEditingTask(null)}
                milestones={milestones}
                getStatusBadgeVariant={getStatusBadgeVariant}
                getPriorityBadgeVariant={getPriorityBadgeVariant}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation */}
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
            <AlertDialogAction 
              onClick={() => deletingTask && handleDeleteTask(deletingTask.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Draggable task row component
interface DraggableTaskRowProps {
  task: Task;
  getStatusIcon: (status: string) => any;
  getStatusBadgeVariant: (status: string) => any;
  getPriorityBadgeVariant: (priority: string) => any;
  formatDate: (date: string) => string;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function DraggableTaskRow({ 
  task, 
  getStatusIcon, 
  getStatusBadgeVariant, 
  getPriorityBadgeVariant, 
  formatDate,
  onView,
  onEdit,
  onDelete
}: DraggableTaskRowProps) {
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

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style}
      className={`hover:bg-muted/30 transition-colors ${isDragging ? 'z-50' : ''}`}
    >
      <TableCell>
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {React.createElement(getStatusIcon(task.status), { 
            className: "h-4 w-4 text-muted-foreground" 
          })}
          <span className="truncate">{task.title}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-[300px] truncate text-muted-foreground">
          {task.description || 'No description'}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={getStatusBadgeVariant(task.status)}>
          {task.status.replace('_', ' ')}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={getPriorityBadgeVariant(task.priority)}>
          {task.priority}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="h-3 w-3" />
          {formatDate(task.due_date)}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onView}>
            <Eye className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onEdit}>
            <Edit className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Milestone drop zone component
interface MilestoneDropZoneProps {
  children: React.ReactNode;
  milestoneId: string;
}

function MilestoneDropZone({ children, milestoneId }: MilestoneDropZoneProps) {
  const { isOver, setNodeRef } = useSortable({ id: milestoneId });

  return (
    <div 
      ref={setNodeRef}
      className={`${isOver ? 'bg-primary/10 border-2 border-primary border-dashed' : ''} transition-colors`}
    >
      {children}
    </div>
  );
}

// Edit Task Form Component
interface EditTaskFormProps {
  task: Task;
  onSave: (updatedData: Partial<Task>) => void;
  onCancel: () => void;
  milestones: Milestone[];
  getStatusBadgeVariant: (status: string) => any;
  getPriorityBadgeVariant: (priority: string) => any;
}

function EditTaskForm({ task, onSave, onCancel, milestones }: EditTaskFormProps) {
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    due_date: task.due_date || '',
    milestone_id: task.milestone_id || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border shadow-lg z-[9999]">
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border shadow-lg z-[9999]">
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="due_date">Due Date</Label>
          <Input
            id="due_date"
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="milestone">Milestone</Label>
          <Select value={formData.milestone_id} onValueChange={(value) => setFormData({ ...formData, milestone_id: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select milestone" />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border shadow-lg z-[9999]">
              <SelectItem value="">Unassigned</SelectItem>
              {milestones.map((milestone) => (
                <SelectItem key={milestone.id} value={milestone.id}>
                  {milestone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Changes
        </Button>
      </div>
    </form>
  );
}