import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, parseISO, startOfYear, endOfYear, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
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

interface YearlyGanttViewProps {
  projectId: string;
}

export function YearlyGanttView({ projectId }: YearlyGanttViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const currentYearDate = new Date(selectedYear, 0, 1);
  const yearStart = startOfYear(currentYearDate);
  const yearEnd = endOfYear(currentYearDate);
  const monthsInYear = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  // Airbus color codes (repeat after 4)
  const airbusColors = [
    'hsl(210, 100%, 50%)', // Airbus Blue
    'hsl(120, 60%, 45%)',  // Airbus Green  
    'hsl(35, 100%, 50%)',  // Airbus Orange
    'hsl(340, 80%, 50%)',  // Airbus Red
  ];

  // Task status colors
  const statusColors = {
    'not_started': 'hsl(var(--muted))',
    'in_progress': 'hsl(var(--primary))', 
    'completed': 'hsl(var(--success))',
    'on_hold': 'hsl(var(--warning))',
    'blocked': 'hsl(var(--destructive))'
  };

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

  // Filter tasks for the selected year
  const yearlyTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.created_at) return false;
      
      const taskStartDate = parseISO(task.created_at);
      const taskEndDate = task.due_date ? parseISO(task.due_date) : taskStartDate;
      
      // Show task if it overlaps with the current year
      return (taskStartDate <= yearEnd && taskEndDate >= yearStart);
    });
  }, [tasks, yearStart, yearEnd]);

  // Group tasks by milestone for the selected year
  const groupedYearlyTasks = useMemo(() => {
    const grouped = milestones.map(milestone => {
      const milestoneTasks = yearlyTasks.filter(task => task.milestone_id === milestone.id);
      return {
        milestone,
        tasks: milestoneTasks
      };
    });
    
    // Add tasks without milestones
    const tasksWithoutMilestone = yearlyTasks.filter(task => !task.milestone_id);
    
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
  }, [milestones, yearlyTasks]);

  // Get milestones for the year with their positions
  const yearlyMilestones = useMemo(() => {
    return milestones
      .filter(milestone => {
        if (!milestone.due_date) return false;
        const milestoneDate = parseISO(milestone.due_date);
        return milestoneDate >= yearStart && milestoneDate <= yearEnd;
      })
      .map(milestone => {
        const milestoneDate = parseISO(milestone.due_date);
        const yearStartTime = yearStart.getTime();
        const yearEndTime = yearEnd.getTime();
        const yearDuration = yearEndTime - yearStartTime;
        const milestoneOffset = milestoneDate.getTime() - yearStartTime;
        const position = (milestoneOffset / yearDuration) * 100;
        
        return {
          ...milestone,
          position: `${position}%`,
          date: milestoneDate
        };
      });
  }, [milestones, yearStart, yearEnd]);

  const getTaskBarPosition = (task: Task) => {
    if (!task.created_at) return null;
    
    const taskStartDate = parseISO(task.created_at);
    const taskEndDate = task.due_date ? parseISO(task.due_date) : taskStartDate;
    
    // Calculate start position within the year
    const startOfYearTime = yearStart.getTime();
    const endOfYearTime = yearEnd.getTime();
    const yearDuration = endOfYearTime - startOfYearTime;
    
    // Clamp dates to year boundaries
    const clampedStartDate = new Date(Math.max(taskStartDate.getTime(), startOfYearTime));
    const clampedEndDate = new Date(Math.min(taskEndDate.getTime(), endOfYearTime));
    
    if (clampedStartDate > clampedEndDate) return null;
    
    // Calculate position and width as percentage of year
    const startOffset = clampedStartDate.getTime() - startOfYearTime;
    const duration = clampedEndDate.getTime() - clampedStartDate.getTime();
    
    const leftPercentage = (startOffset / yearDuration) * 100;
    const widthPercentage = Math.max((duration / yearDuration) * 100, 0.5); // Minimum 0.5% width
    
    return {
      left: `${leftPercentage}%`,
      width: `${widthPercentage}%`
    };
  };

  const navigateYear = (direction: 'prev' | 'next') => {
    setSelectedYear(direction === 'next' ? selectedYear + 1 : selectedYear - 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading yearly view...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-foreground">Yearly Gantt View</h2>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {selectedYear}
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Year Selector */}
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-24">
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
            <Button variant="ghost" size="sm" onClick={() => navigateYear('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              setSelectedYear(new Date().getFullYear());
            }}>
              <Calendar className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigateYear('next')}>
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
            Task Timeline - {selectedYear}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* Milestones Header */}
          <div className="relative bg-muted/20 border-b p-4">
            <div className="text-sm font-medium text-muted-foreground mb-2">Milestones</div>
            <div className="relative h-8">
              {yearlyMilestones.map((milestone, index) => (
                <div
                  key={milestone.id}
                  className="absolute flex flex-col items-center"
                  style={{ left: milestone.position, transform: 'translateX(-50%)' }}
                >
                  <div className="text-xs font-medium text-primary mb-1">
                    {milestone.name}
                  </div>
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary" />
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(milestone.date, 'MMM d')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar Header */}
          <div className="sticky top-0 bg-background border-b border-border/30 z-10">
            <div className="grid gap-px" style={{ gridTemplateColumns: '300px 1fr' }}>
              {/* Task Header */}
              <div className="bg-primary/5 p-4 border-r border-border/30">
                <div className="font-medium text-sm text-muted-foreground">Task Name</div>
              </div>
              
              {/* Calendar Months Header */}
              <div className="bg-primary/5 overflow-x-auto">
                <div className="grid gap-px min-w-max" style={{ gridTemplateColumns: `repeat(${monthsInYear.length}, 1fr)` }}>
                  {monthsInYear.map((month, index) => (
                    <div 
                      key={index} 
                      className="p-4 text-center font-medium text-primary bg-primary/10 border-r border-border/30 last:border-r-0"
                      style={{ minWidth: '100px' }}
                    >
                      {format(month, 'MMM')}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tasks and Timeline */}
          <div className="max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {groupedYearlyTasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No tasks scheduled for {selectedYear}
              </div>
            ) : (
              <div className="space-y-1">
                {groupedYearlyTasks.map((group, groupIndex) => (
                  <div key={group.milestone.id}>
                    {/* Milestone Header */}
                    <div className="grid gap-px bg-muted/30 border-b border-border/20" style={{ gridTemplateColumns: '300px 1fr' }}>
                        <div className="p-3 border-r border-border/20 bg-background">
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
                      <div key={task.id} className="grid gap-px hover:bg-muted/20 border-b border-border/10" style={{ gridTemplateColumns: '300px 1fr' }}>
                        {/* Task Info */}
                        <div className="p-3 border-r border-border/20 bg-background">
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
                        <div className="relative bg-background overflow-x-auto border-l">
                          <div className="h-16 relative border-b border-border/20" style={{ minWidth: `${monthsInYear.length * 100}px` }}>
                            {/* Month Grid Lines */}
                            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${monthsInYear.length}, 1fr)` }}>
                              {monthsInYear.map((_, monthIndex) => (
                                <div key={monthIndex} className="border-r border-border/30 h-full bg-muted/5" />
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
                                    minWidth: '40px'
                                  }}
                                  title={`${task.title} - ${format(startDate, 'MMM d')} to ${format(endDate, 'MMM d')}`}
                                >
                                  <div className="truncate px-2">
                                    {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}
                                  </div>
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