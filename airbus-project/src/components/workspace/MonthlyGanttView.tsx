import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isSameDay, isWithinInterval } from 'date-fns';
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
}

interface MonthlyGanttViewProps {
  projectId: string;
}

export function MonthlyGanttView({ projectId }: MonthlyGanttViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const currentMonthDate = new Date(selectedYear, selectedMonth, 1);
  const monthStart = startOfMonth(currentMonthDate);
  const monthEnd = endOfMonth(currentMonthDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Task status colors following Airbus design system
  const statusColors = {
    'not_started': 'hsl(var(--muted))',
    'in_progress': 'hsl(var(--primary))', 
    'completed': 'hsl(var(--success))',
    'on_hold': 'hsl(var(--warning))',
    'blocked': 'hsl(var(--destructive))'
  };

  // Airbus color codes (repeat after 4)
  const airbusColors = [
    'hsl(210, 100%, 50%)', // Airbus Blue
    'hsl(120, 60%, 45%)',  // Airbus Green  
    'hsl(35, 100%, 50%)',  // Airbus Orange
    'hsl(340, 80%, 50%)',  // Airbus Red
  ];

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch milestones
      const milestonesResponse = await apiClient.getMilestones(projectId);
      if (milestonesResponse.success) {
        setMilestones(milestonesResponse.data || []);
      }
      
      // Fetch tasks
      const tasksResponse = await apiClient.getTasks(projectId);
      if (tasksResponse.success) {
        setTasks(tasksResponse.data || []);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks for the selected month (based on created_at to due_date range)
  const monthlyTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.created_at) return false;
      
      const taskStartDate = parseISO(task.created_at);
      const taskEndDate = task.due_date ? parseISO(task.due_date) : taskStartDate;
      
      // Show task if it overlaps with the current month
      return (taskStartDate <= monthEnd && taskEndDate >= monthStart);
    });
  }, [tasks, monthStart, monthEnd]);

  // Group tasks by milestone for the selected month
  const groupedMonthlyTasks = useMemo(() => {
    const grouped = milestones.map(milestone => {
      const milestoneTasks = monthlyTasks.filter(task => task.milestone_id === milestone.id);
      return {
        milestone,
        tasks: milestoneTasks
      };
    });
    
    // Add tasks without milestones
    const tasksWithoutMilestone = monthlyTasks.filter(task => !task.milestone_id);
    
    if (tasksWithoutMilestone.length > 0) {
      grouped.push({
        milestone: { 
          id: 'unassigned', 
          name: 'Unassigned Tasks', 
          due_date: '', 
          status: '', 
          description: '', 
          project_id: '', 
          created_by: '' 
        },
        tasks: tasksWithoutMilestone
      });
    }
    
    return grouped.filter(group => group.tasks.length > 0);
  }, [milestones, monthlyTasks]);

  const getTaskBarPosition = (task: Task) => {
    if (!task.created_at) return null;
    
    const taskStartDate = parseISO(task.created_at);
    const taskEndDate = task.due_date ? parseISO(task.due_date) : taskStartDate;
    
    // Calculate start position within the month
    const startOfMonthTime = monthStart.getTime();
    const endOfMonthTime = monthEnd.getTime();
    const monthDuration = endOfMonthTime - startOfMonthTime;
    
    // Clamp dates to month boundaries
    const clampedStartDate = new Date(Math.max(taskStartDate.getTime(), startOfMonthTime));
    const clampedEndDate = new Date(Math.min(taskEndDate.getTime(), endOfMonthTime));
    
    if (clampedStartDate > clampedEndDate) return null;
    
    // Calculate position and width as percentage of month
    const startOffset = clampedStartDate.getTime() - startOfMonthTime;
    const duration = clampedEndDate.getTime() - clampedStartDate.getTime();
    
    const leftPercentage = (startOffset / monthDuration) * 100;
    const widthPercentage = Math.max((duration / monthDuration) * 100, 1); // Minimum 1% width
    
    return {
      left: `${leftPercentage}%`,
      width: `${widthPercentage}%`
    };
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'next') {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    } else {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading monthly view...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-foreground">Monthly Gantt View</h2>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {format(currentMonthDate, 'MMMM yyyy')}
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Month/Year Selectors */}
          <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {format(new Date(2024, i, 1), 'MMMM')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          {/* Navigation Buttons */}
          <div className="flex items-center gap-1 border rounded-lg">
            <Button variant="ghost" size="sm" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              setSelectedMonth(new Date().getMonth());
              setSelectedYear(new Date().getFullYear());
            }}>
              <Calendar className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <div className="h-1 w-8 bg-gradient-to-r from-primary to-primary/60 rounded-full" />
            Task Timeline - {format(currentMonthDate, 'MMMM yyyy')}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* Calendar Header */}
          <div className="sticky top-0 bg-background border-b z-10">
            <div className="grid gap-px" style={{ gridTemplateColumns: '300px 1fr' }}>
              {/* Task Header */}
              <div className="bg-muted/50 p-4 border-r">
                <div className="font-medium text-sm text-muted-foreground">Tasks & Milestones</div>
              </div>
              
              {/* Calendar Days Header */}
              <div className="bg-muted/50 overflow-x-auto">
                <div className="grid gap-px min-w-max" style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, 1fr)` }}>
                  {daysInMonth.map((day, index) => (
                    <div 
                      key={index} 
                      className="p-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
                      style={{ minWidth: '40px' }}
                    >
                      <div>{format(day, 'd')}</div>
                      <div className="text-xs opacity-60">{format(day, 'EEE')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tasks and Timeline */}
          <div className="max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {groupedMonthlyTasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No tasks scheduled for {format(currentMonthDate, 'MMMM yyyy')}
              </div>
            ) : (
              <div className="space-y-1">
                {groupedMonthlyTasks.map((group, groupIndex) => (
                  <div key={group.milestone.id}>
                    {/* Milestone Header */}
                    <div className="grid gap-px bg-muted/30" style={{ gridTemplateColumns: '300px 1fr' }}>
                      <div className="p-3 border-r bg-background">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <span className="font-medium text-sm">{group.milestone.name}</span>
                          <Badge variant="outline" className="text-xs">{group.tasks.length}</Badge>
                        </div>
                      </div>
                      <div className="bg-background"></div>
                    </div>
                    
                    {/* Tasks */}
                    {group.tasks.map((task, taskIndex) => (
                      <div key={task.id} className="grid gap-px hover:bg-muted/20" style={{ gridTemplateColumns: '300px 1fr' }}>
                        {/* Task Info */}
                        <div className="p-3 border-r bg-background">
                          <div className="space-y-1">
                            <div className="font-medium text-sm truncate" title={task.title}>
                              {task.title}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <div 
                                className="h-2 w-2 rounded-full" 
                                style={{ backgroundColor: statusColors[task.status as keyof typeof statusColors] || statusColors.not_started }}
                              />
                              <span className="capitalize">{task.status.replace('_', ' ')}</span>
                              <span>•</span>
                              <span>Start: {format(parseISO(task.created_at), 'MMM d')}</span>
                              {task.due_date && (
                                <>
                                  <span>•</span>
                                  <span>Due: {format(parseISO(task.due_date), 'MMM d')}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Timeline */}
                        <div className="relative bg-background overflow-x-auto">
                          <div className="h-16 relative" style={{ minWidth: `${daysInMonth.length * 40}px` }}>
                            {/* Grid Lines */}
                            <div className="absolute inset-0 grid gap-px" style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, 1fr)` }}>
                              {daysInMonth.map((_, dayIndex) => (
                                <div key={dayIndex} className="border-r border-border/20 last:border-r-0" />
                              ))}
                            </div>
                            
                            {/* Task Bar */}
                            {(() => {
                              const position = getTaskBarPosition(task);
                              if (!position) return null;
                              
                              const taskColor = airbusColors[taskIndex % airbusColors.length];
                              const startDate = parseISO(task.created_at);
                              const endDate = task.due_date ? parseISO(task.due_date) : startDate;
                              
                              return (
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 rounded-sm shadow-sm flex items-center justify-center text-white text-xs font-medium"
                                  style={{
                                    left: position.left,
                                    width: position.width,
                                    height: '24px',
                                    backgroundColor: taskColor,
                                    minWidth: '32px'
                                  }}
                                  title={`${task.title} - ${format(startDate, 'MMM d')} to ${format(endDate, 'MMM d')}`}
                                >
                                  <div className="truncate px-1">{task.title.substring(0, 12)}</div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}