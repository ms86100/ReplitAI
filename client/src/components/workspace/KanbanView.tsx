import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, MoreHorizontal, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';

interface KanbanViewProps {
  projectId: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  due_date?: string;
  milestone_id?: string;
  owner_id?: string;
  source?: 'task' | 'retrospective';
  retrospective_id?: string;
}

interface Milestone {
  id: string;
  name: string;
  due_date: string;
}

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  created_at?: string;
  changed_by: string;
  notes?: string;
  user_name?: string;
}

const statusColumns = [
  { key: 'todo', label: 'To Do', color: 'bg-gray-100' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-100' },
  { key: 'blocked', label: 'Blocked', color: 'bg-red-100' },
  { key: 'completed', label: 'Completed', color: 'bg-green-100' },
];

export function KanbanView({ projectId }: KanbanViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start dragging
      },
    })
  );

  // Memoize tasks by status to prevent unnecessary re-renders
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    statusColumns.forEach(column => {
      grouped[column.key] = tasks.filter(task => task.status === column.key);
    });
    return grouped;
  }, [tasks]);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch regular tasks
      const tasksResponse = await apiClient.getTasks(projectId);
      if (!tasksResponse.success) {
        throw new Error(tasksResponse.error || 'Failed to fetch tasks');
      }

      // Fetch retrospective action items that haven't been converted to tasks yet
      const retroResponse = await apiClient.getRetrospectives(projectId);
      let retrospectiveTasks: Task[] = [];
      
      if (retroResponse.success && retroResponse.data) {
        // Convert retrospective items to task-like objects
        const actionItems = retroResponse.data.flatMap((retro: any) => 
          (retro.action_items || []).filter((item: any) => !item.task_id)
        );
        
        retrospectiveTasks = actionItems.map((item: any) => ({
          id: `retro-${item.id}`,
          title: item.what_task || 'Untitled Action Item',
          description: item.how_approach || '',
          status: 'todo', // Default status for retrospective items
          priority: 'medium', // Default priority
          owner_id: item.who_responsible,
          source: 'retrospective' as const,
          retrospective_id: item.retrospective_id,
        }));
      }

      // Fetch milestones for grouping
      const milestonesResponse = await apiClient.getMilestones(projectId);
      if (!milestonesResponse.success) {
        throw new Error(milestonesResponse.error || 'Failed to fetch milestones');
      }

      // Combine regular tasks with retrospective items
      const regularTasks: Task[] = (tasksResponse.data || []).map((task: any) => ({
        ...task,
        source: 'task' as const,
      }));

      setTasks([...regularTasks, ...retrospectiveTasks]);
      setMilestones(milestonesResponse.data || []);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskStatusHistory = async (taskId: string) => {
    try {
      setHistoryLoading(true);
      
      // Get the task status history via API
      const response = await apiClient.getTaskStatusHistory(taskId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch task history');
      }
      
      setStatusHistory(Array.isArray(response.data) ? response.data : response.data?.history || []);
    } catch (error: any) {
      toast({
        title: "Error loading history",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    fetchTaskStatusHistory(task.id);
  };

  const formatStatus = (status: string) => {
    if (!status) return 'Unknown';
    // Handle any remaining corrupted statuses
    if (status.includes('-') && status.length > 10) return 'Invalid Status';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const updateTaskStatus = useCallback(async (taskId: string, newStatus: string) => {
    try {
      // Find the task to get its current details
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        console.error('Task not found:', taskId);
        return;
      }

      const oldStatus = task.status;

      // Handle retrospective items differently
      if (task.source === 'retrospective') {
        // For retrospective items, we just update the local state
        // since they don't exist as actual tasks in the database yet
        setTasks(prevTasks => 
          prevTasks.map(t => 
            t.id === taskId 
              ? { ...t, status: newStatus }
              : t
          )
        );

        toast({
          title: "Retrospective Item Updated",
          description: `"${task.title}" moved to ${newStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
        });
        return;
      }

      // Update regular tasks via API
      const response = await apiClient.updateTask(taskId, { status: newStatus });
      
      if (!response.success) {
        console.error('API update error:', response.error);
        throw new Error(response.error || 'Failed to update task');
      }

      // Update local state immediately for optimistic UI
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === taskId 
            ? { ...t, status: newStatus }
            : t
        )
      );

      // Format status names for display
      const formatStatusForToast = (status: string) => {
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      };

      // Show success toast with proper task name and status
      toast({
        title: "Task Updated",
        description: `"${task.title}" moved to ${formatStatusForToast(newStatus)}`,
      });

    } catch (error: any) {
      console.error('Error updating task status:', error);
      toast({
        title: "Error updating task",
        description: error.message || "Failed to update task status",
        variant: "destructive",
      });
      
      // Refresh data to ensure consistency
      fetchData();
    }
  }, [tasks, toast]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      return;
    }

    const taskId = active.id as string;
    const dropTargetId = over.id as string;

    // Ensure we only accept valid status column IDs as drop targets
    const validStatuses = statusColumns.map(col => col.key);
    const newStatus = validStatuses.includes(dropTargetId) ? dropTargetId : null;

    if (!newStatus) {
      console.error('Invalid drop target:', dropTargetId, 'Valid targets:', validStatuses);
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      console.error('Task not found for drag operation:', taskId);
      return;
    }

    if (task.status === newStatus) {
      return;
    }

    updateTaskStatus(taskId, newStatus);
  };

  const getTasksForStatus = useCallback((status: string) => {
    return tasksByStatus[status] || [];
  }, [tasksByStatus]);

  const getMilestoneName = (milestoneId?: string) => {
    if (!milestoneId) return 'No Milestone';
    const milestone = milestones.find(m => m.id === milestoneId);
    return milestone?.name || 'Unknown Milestone';
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  // Draggable Task Card Component - Memoized for performance
  const DraggableTaskCard = React.memo(({ task }: { task: Task }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useDraggable({ 
      id: task.id,
      data: {
        type: 'task',
        task,
      },
    });

    const style = {
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <Card 
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all border-l-4 ${getPriorityColor(task.priority)} ${isDragging ? 'shadow-lg scale-105' : ''}`}
        onClick={(e) => {
          // Only trigger click if not dragging
          if (!isDragging) {
            e.stopPropagation();
            handleTaskClick(task);
          }
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm font-medium leading-tight">
              {task.title}
              {task.source === 'retrospective' && (
                <Badge variant="outline" className="ml-2 text-xs">
                  From Retrospective
                </Badge>
              )}
            </CardTitle>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {task.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {task.description}
            </p>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {getMilestoneName(task.milestone_id)}
              </span>
              {task.priority && (
                <Badge variant="outline" className="text-xs">
                  {task.priority}
                </Badge>
              )}
            </div>
            
            {task.due_date && (
              <div className="text-xs text-muted-foreground">
                Due: {format(new Date(task.due_date), 'MMM dd')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  });

  // Droppable Column Component - Memoized for performance
  const DroppableColumn = React.memo(({ column, tasks: columnTasks }: { column: typeof statusColumns[0], tasks: Task[] }) => {
    const { isOver, setNodeRef } = useDroppable({
      id: column.key,
      data: {
        type: 'column',
        status: column.key,
      },
    });

    return (
      <div className="flex flex-col h-full">
        <div className={`${column.color} rounded-lg p-4 mb-4`}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{column.label}</h3>
            <Badge variant="secondary" className="text-xs">
              {columnTasks.length}
            </Badge>
          </div>
        </div>
        
        <div 
          ref={setNodeRef}
          className={`flex-1 space-y-3 overflow-y-auto min-h-24 p-2 rounded-lg transition-all duration-200 ${
            isOver
              ? 'bg-primary/10 border-2 border-dashed border-primary/50' 
              : activeTask && activeTask.status !== column.key 
              ? 'bg-primary/5 border-2 border-dashed border-primary/30' 
              : 'border-2 border-transparent'
          }`}
          style={{
            minHeight: '200px',
          }}
        >
          {columnTasks.map((task) => (
            <DraggableTaskCard key={task.id} task={task} />
          ))}
          
          {columnTasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No tasks</p>
              {(isOver || (activeTask && activeTask.status !== column.key)) && (
                <p className="text-xs mt-1 text-primary font-medium">Drop here to move to {column.label}</p>
              )}
              {(!activeTask || activeTask.status === column.key) && !isOver && (
                <p className="text-xs mt-1">Drop tasks here</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between p-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Kanban</h1>
              <p className="text-sm text-muted-foreground">Drag and drop tasks between status columns</p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-4 gap-6 h-full">
            {statusColumns.map((column) => {
              const columnTasks = getTasksForStatus(column.key);
              return (
                <DroppableColumn 
                  key={column.key} 
                  column={column} 
                  tasks={columnTasks} 
                />
              );
            })}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? (
            <Card className={`cursor-grabbing shadow-2xl rotate-3 border-l-4 ${getPriorityColor(activeTask.priority)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium leading-tight">
                  {activeTask.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {activeTask.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {activeTask.description}
                  </p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {getMilestoneName(activeTask.milestone_id)}
                    </span>
                    {activeTask.priority && (
                      <Badge variant="outline" className="text-xs">
                        {activeTask.priority}
                      </Badge>
                    )}
                  </div>
                  {activeTask.due_date && (
                    <div className="text-xs text-muted-foreground">
                      Due: {format(new Date(activeTask.due_date), 'MMM dd')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>

        {/* Task Status History Dialog */}
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Status History: {selectedTask?.title}
              </DialogTitle>
            </DialogHeader>
            
            <div className="mt-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : statusHistory.length > 0 ? (
                <div className="space-y-4">
                  {statusHistory.map((entry, index) => (
                    <div key={entry.id} className="flex items-start gap-3 pb-4 border-b border-border last:border-b-0">
                      <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {entry.old_status ? (
                            <>
                              <Badge variant="outline" className="text-xs">
                                {formatStatus(entry.old_status)}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge variant="default" className="text-xs">
                                {formatStatus(entry.new_status)}
                              </Badge>
                            </>
                          ) : (
                            <>
                              <span className="text-muted-foreground">Created with status:</span>
                              <Badge variant="default" className="text-xs">
                                {formatStatus(entry.new_status)}
                              </Badge>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {format(new Date((entry.changed_at || entry.created_at) as string), 'PPp')}
                          <User className="h-3 w-3 ml-2" />
                          <span>{entry.user_name || 'Unknown User'}</span>
                        </div>
                        {entry.notes && (
                          <div className="text-sm text-muted-foreground mt-2 italic">
                            {entry.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No status changes recorded yet</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  );
}