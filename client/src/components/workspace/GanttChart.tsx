import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/services/api';
import { format, addDays, differenceInDays, startOfDay, endOfDay } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  milestone_id?: string;
  project_id: string;
  created_at: string;
}

interface Milestone {
  id: string;
  name: string;
  due_date: string;
  status: string;
  project_id: string;
}

interface GanttChartProps {
  projectId: string;
}

export function GanttChart({ projectId }: GanttChartProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch milestones via API
      const milestonesResponse = await apiClient.getMilestones(projectId);
      if (!milestonesResponse.success) {
        throw new Error(milestonesResponse.error || 'Failed to fetch milestones');
      }
      setMilestones(milestonesResponse.data || []);

      // Fetch tasks via API
      const tasksResponse = await apiClient.getTasks(projectId);
      if (!tasksResponse.success) {
        throw new Error(tasksResponse.error || 'Failed to fetch tasks');
      }
      const tasksData = tasksResponse.data || [];
      const milestonesData = milestonesResponse.data || [];
      
      setTasks(tasksData);

      // Calculate date range - ensure timeline includes full end dates
      const allStartDates = [
        ...tasksData.map((t: any) => new Date(t.created_at))
      ];
      
      const allEndDates = [
        ...milestonesData.map((m: any) => new Date(m.due_date)),
        ...tasksData.filter((t: any) => t.due_date).map((t: any) => new Date(t.due_date!))
      ];
      
      if (allStartDates.length > 0 || allEndDates.length > 0) {
        const minDate = allStartDates.length > 0 
          ? new Date(Math.min(...allStartDates.map(d => d.getTime())))
          : new Date();
        const maxDate = allEndDates.length > 0
          ? new Date(Math.max(...allEndDates.map(d => d.getTime())))
          : new Date();
        
        // CRITICAL FIX: Ensure timeline includes the FULL end date
        // Start timeline a week before the earliest date
        const timelineStart = new Date(minDate);
        timelineStart.setDate(timelineStart.getDate() - 7);
        timelineStart.setHours(0, 0, 0, 0); // Start of day
        
        // CRITICAL FIX: End timeline AFTER the latest end date to ensure full visibility
        const timelineEnd = new Date(maxDate);
        timelineEnd.setDate(timelineEnd.getDate() + 1); // Add one extra day
        timelineEnd.setHours(23, 59, 59, 999); // End of that day
        
        setStartDate(timelineStart);
        setEndDate(timelineEnd);
      } else {
        // Default to current month with proper extension
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
        end.setHours(23, 59, 59, 999);
        setStartDate(start);
        setEndDate(end);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTimelineHeaders = () => {
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Generate daily headers grouped by week for precision
    const days = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      days.push({
        date: new Date(current),
        day: current.getDate(),
        month: format(current, 'MMM'),
        isWeekStart: current.getDay() === 0
      });
      current.setDate(current.getDate() + 1);
    }
    
    // Group days into weeks for header display
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDays = days.slice(i, i + 7);
      const weekStart = weekDays[0];
      const weekEnd = weekDays[weekDays.length - 1];
      
      weeks.push({
        start: format(weekStart.date, 'MMM d'),
        end: format(weekEnd.date, 'd'),
        days: weekDays.length
      });
    }

    return { weeks, totalDays, days };
  };

  const calculateBarPosition = (dateStr: string) => {
    const itemDate = new Date(dateStr);
    itemDate.setHours(0, 0, 0, 0); // Normalize to start of day
    
    const totalMs = endDate.getTime() - startDate.getTime();
    const itemMs = itemDate.getTime() - startDate.getTime();
    const positionPercent = (itemMs / totalMs) * 100;
    
    return Math.max(0, Math.min(95, positionPercent));
  };

  const calculateBarWidth = (startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0); // Start of day
    
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999); // CRITICAL: End of the due date
    
    const totalMs = endDate.getTime() - startDate.getTime();
    const taskMs = end.getTime() - start.getTime();
    
    const widthPercent = (taskMs / totalMs) * 100;
    return Math.max(1, Math.min(95, widthPercent)); // Ensure visible width
  };

  const getTaskColor = (task: Task) => {
    // Color coding based on task content and priority
    const title = task.title.toLowerCase();
    
    if (title.includes('test') || title.includes('testing')) return 'hsl(var(--chart-3))'; // Orange
    if (title.includes('deploy') || title.includes('release')) return 'hsl(var(--chart-2))'; // Blue
    if (title.includes('plan') || title.includes('design')) return 'hsl(var(--chart-1))'; // Navy
    if (title.includes('develop') || title.includes('build')) return 'hsl(var(--chart-4))'; // Green
    
    // Fallback to priority colors
    switch (task.priority) {
      case 'high': return 'hsl(var(--destructive))';
      case 'medium': return 'hsl(var(--warning))';
      case 'low': return 'hsl(var(--success))';
      default: return 'hsl(var(--muted))';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'blocked': return 'bg-red-500';
      case 'planning': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { weeks, totalDays, days } = generateTimelineHeaders();

  return (
    <div className="w-full bg-background">
      {/* Clean header matching reference images */}
      <div className="border-l-4 border-l-primary bg-muted/30 px-4 py-3 mb-6">
        <h2 className="text-lg font-semibold text-foreground">Timeline View</h2>
      </div>
      
      {/* Horizontal scrollable container with improved width */}
      <div className="overflow-x-auto overflow-y-hidden border rounded-lg">
        <div style={{ minWidth: `${Math.max(1200, totalDays * 12)}px` }} className="p-4">
          {/* Timeline Header */}
          <div className="border-b border-border mb-6">
            <div className="flex bg-muted/30 border-b border-border">
              <div className="w-80 px-4 py-3 border-r border-border bg-background">
                <span className="text-sm font-medium text-muted-foreground">Task / Milestone</span>
              </div>
              
              {/* Week Headers with improved spacing */}
              <div className="flex flex-1">
                {weeks.map((week, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-center border-r border-border text-xs font-medium text-muted-foreground py-3 px-2"
                    style={{ width: `${(week.days * 7 / totalDays) * 100}%`, minWidth: '80px' }}
                  >
                    <div className="text-center">
                      <div>{week.start}</div>
                      {week.end !== week.start && <div className="text-xs text-muted-foreground/70">to {week.end}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Content rows */}
          <div className="space-y-0">
            {/* Milestones grouped with their tasks */}
            {milestones.map((milestone) => {
              const milestoneTasks = tasks.filter(task => task.milestone_id === milestone.id);
              
              return (
                <div key={milestone.id} className="border-b border-border/50">
                  {/* Milestone row */}
                  <div className="flex items-center border-b border-border/30 bg-muted/20">
                    <div className="w-80 px-4 py-3 border-r border-border bg-background">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="font-medium text-sm">{milestone.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {milestoneTasks.length} tasks
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex-1 relative py-3">
                      {/* Milestone marker */}
                      <div
                        className="absolute top-1/2 transform -translate-y-1/2 w-1 h-8 bg-primary"
                        style={{ left: `${calculateBarPosition(milestone.due_date)}%` }}
                      >
                        <div className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full border-2 border-background"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Milestone tasks */}
                  {milestoneTasks.map((task) => (
                    <div key={task.id} className="flex items-center hover:bg-muted/20 transition-colors">
                      <div className="w-80 px-4 py-3 border-r border-border bg-background">
                        <div className="text-sm font-medium truncate">{task.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Due: {task.due_date ? format(new Date(task.due_date), 'MMM d') : 'No date'}
                          <span className="ml-2 text-xs font-medium text-muted-foreground">
                            A. Sagar
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex-1 relative py-3">
                        {task.due_date && (
                          <div
                            className="absolute top-1/2 transform -translate-y-1/2 h-4 rounded"
                            style={{
                              left: `${calculateBarPosition(task.created_at)}%`,
                              width: `${calculateBarWidth(task.created_at, task.due_date)}%`,
                              backgroundColor: getTaskColor(task),
                              minWidth: '20px'
                            }}
                          ></div>
                        )}
                        
                        {/* Status indicator */}
                        <div 
                          className="absolute top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full border border-background"
                          style={{ 
                            right: '10px',
                            backgroundColor: task.status === 'completed' ? 'hsl(var(--success))' : 
                                           task.status === 'in_progress' ? 'hsl(var(--warning))' : 
                                           'hsl(var(--muted))'
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Unassigned tasks */}
            {tasks.filter(task => !task.milestone_id).length > 0 && (
              <div className="border-b border-border/50">
                <div className="flex items-center border-b border-border/30 bg-muted/20">
                  <div className="w-80 px-4 py-3 border-r border-border bg-background">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-muted"></div>
                      <span className="font-medium text-sm text-muted-foreground">Unassigned Tasks</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {tasks.filter(task => !task.milestone_id).length} tasks
                      </span>
                    </div>
                  </div>
                  <div className="flex-1"></div>
                </div>
                
                {tasks.filter(task => !task.milestone_id).map((task) => (
                  <div key={task.id} className="flex items-center hover:bg-muted/20 transition-colors">
                    <div className="w-80 px-4 py-3 border-r border-border bg-background">
                      <div className="text-sm font-medium truncate">{task.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Due: {task.due_date ? format(new Date(task.due_date), 'MMM d') : 'No date'}
                        <span className="ml-2 text-xs font-medium text-muted-foreground">
                          A. Sagar
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex-1 relative py-3">
                      {task.due_date && (
                        <div
                          className="absolute top-1/2 transform -translate-y-1/2 h-4 rounded"
                            style={{
                              left: `${calculateBarPosition(task.created_at)}%`,
                              width: `${calculateBarWidth(task.created_at, task.due_date)}%`,
                              backgroundColor: getTaskColor(task),
                              minWidth: '20px'
                            }}
                        ></div>
                      )}
                      
                      <div 
                        className="absolute top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full border border-background"
                        style={{ 
                          right: '10px',
                          backgroundColor: task.status === 'completed' ? 'hsl(var(--success))' : 
                                         task.status === 'in_progress' ? 'hsl(var(--warning))' : 
                                         'hsl(var(--muted))'
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {(milestones.length === 0 && tasks.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No milestones or tasks found for this project.</p>
                <p className="text-sm mt-2">Create some milestones and tasks to see your project timeline.</p>
              </div>
            )}
          </div>
          
          {/* Legend */}
          <div className="mt-8 p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-3">Legend</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-medium mb-2">Task Types</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--chart-1))' }}></div>
                    <span>Planning & Design</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--chart-3))' }}></div>
                    <span>Testing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--chart-2))' }}></div>
                    <span>Deployment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--chart-4))' }}></div>
                    <span>Development</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="font-medium mb-2">Status</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--success))' }}></div>
                    <span>Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--warning))' }}></div>
                    <span>In Progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--muted))' }}></div>
                    <span>Not Started</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}