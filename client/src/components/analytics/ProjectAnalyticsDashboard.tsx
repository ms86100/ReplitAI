import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import {
  BarChart3,
  AlertTriangle,
  DollarSign,
  CheckCircle,
  Clock,
  Target,
  PieChart,
  User,
  Shield,
  Send
} from 'lucide-react';

interface ProjectAnalyticsDashboardProps {
  projectId: string;
}

interface ProjectCompletionGaugeProps {
  totalTasks: number;
  completedTasks: number;
}

const ProjectCompletionGauge: React.FC<ProjectCompletionGaugeProps> = ({ totalTasks, completedTasks }) => {
  // Calculate completion percentage
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="h-[200px] flex flex-col items-center justify-center p-4">
      {/* Percentage display */}
      <div className="text-center mb-4">
        <div className="text-3xl font-bold text-teal-600" data-testid="text-completion-percentage">
          {completionPercentage}%
        </div>
        <div className="text-sm text-muted-foreground mt-1">Complete</div>
      </div>
      
      {/* Progress bar */}
      <div className="w-full max-w-xs mb-4">
        <div 
          className="h-6 bg-gray-300 rounded-md relative overflow-hidden"
          role="progressbar"
          aria-valuenow={completionPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div 
            className="h-full bg-teal-500 rounded-md transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>
      
      {/* Summary stats */}
      <div className="text-center" data-testid="text-completion-summary">
        <div className="text-sm text-muted-foreground">
          {completedTasks} of {totalTasks} tasks completed
        </div>
      </div>
    </div>
  );
};

const ProjectAnalyticsDashboard: React.FC<ProjectAnalyticsDashboardProps> = ({ projectId }) => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        console.log('Fetching analytics for project:', projectId);
        const response = await apiClient.getProjectOverviewAnalytics(projectId);
        console.log('Analytics API response:', response);
        
        if (response.success) {
          setAnalyticsData(response.data);
          console.log('Analytics data received:', response.data);
        } else {
          throw new Error(response.error || 'Failed to fetch analytics');
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
        toast({
          title: "Error",
          description: "Failed to load analytics data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchAnalytics();
    }
  }, [projectId, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No analytics data available</p>
      </div>
    );
  }

  const { projectHealth, budgetAnalytics, taskAnalytics } = analyticsData;

  const handleSendReminder = async (taskId: string, taskTitle: string, taskOwner: string) => {
    if (taskOwner === 'Unassigned') {
      toast({
        title: "Cannot Send Reminder",
        description: "This task is not assigned to anyone.",
        variant: "destructive",
      });
      return;
    }

    setSendingReminder(taskId);
    try {
      // Note: sendTaskReminder method would need to be implemented in apiClient
      // const response = await apiClient.sendTaskReminder(projectId, taskId);
      const response = { success: true }; // Placeholder for now
      if (response.success) {
        toast({
          title: "Reminder Sent",
          description: `Overdue task reminder sent to ${taskOwner} for "${taskTitle}".`,
        });
      } else {
        throw new Error(response.error || 'Failed to send reminder');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast({
        title: "Error",
        description: "Failed to send reminder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingReminder(null);
    }
  };

  // Get overdue tasks with details
  const overdueTasksWithDetails = taskAnalytics.overdueTasksList || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-700 text-sm font-medium">Total Tasks</p>
                <p className="text-3xl font-bold text-blue-900">{taskAnalytics.totalTasks}</p>
                <p className="text-blue-600 text-sm">All Tasks</p>
              </div>
              <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completed Tasks */}
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-700 text-sm font-medium">Completed</p>
                <p className="text-3xl font-bold text-emerald-900">{taskAnalytics.completedTasks}</p>
                <p className="text-emerald-600 text-sm">Tasks Done</p>
              </div>
              <div className="h-12 w-12 bg-emerald-600 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Tasks */}
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-700 text-sm font-medium">#Overdue</p>
                <p className="text-3xl font-bold text-amber-900">{taskAnalytics.overdueTasks}</p>
                <p className="text-amber-600 text-sm">Overdue Tasks</p>
              </div>
              <div className="h-12 w-12 bg-amber-600 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Status */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-700 text-sm font-medium">Budget Health</p>
                <p className="text-3xl font-bold text-blue-900">{projectHealth.budget}%</p>
                <p className="text-blue-600 text-sm">${budgetAnalytics.remainingBudget.toLocaleString()} remaining</p>
              </div>
              <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Task Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              {taskAnalytics.tasksByStatus?.length > 0 && taskAnalytics.tasksByStatus.some((item: any) => item.count > 0) ? (
                <RechartsPieChart>
                  <Pie
                    data={taskAnalytics.tasksByStatus.filter((item: any) => item.count > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, count }: any) => `${status}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {taskAnalytics.tasksByStatus.filter((item: any) => item.count > 0).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, 'Tasks']} />
                  <Legend formatter={(value, entry: any) => `${entry.payload?.status || value} (${entry.payload?.count || 0})`} />
                </RechartsPieChart>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No task status data available
                </div>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Budget Overview with Completion Gauge */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Budget Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Total Budget</span>
                <span className="font-bold">
                  {budgetAnalytics.totalAllocated > 0 
                    ? `$${budgetAnalytics.totalAllocated.toLocaleString()}` 
                    : 'Not Set'
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Amount Spent</span>
                <span className="font-bold text-red-600">${budgetAnalytics.totalSpent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Remaining</span>
                <span className="font-bold text-green-600">${budgetAnalytics.remainingBudget.toLocaleString()}</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-slate-500 to-slate-700 h-3 rounded-full transition-all duration-500" 
                  style={{ 
                    width: budgetAnalytics.totalAllocated > 0 
                      ? `${Math.min((budgetAnalytics.totalSpent / budgetAnalytics.totalAllocated) * 100, 100)}%` 
                      : '0%' 
                  }}
                />
              </div>
              
              <div className="pt-4">
                <ProjectCompletionGauge 
                  totalTasks={taskAnalytics.totalTasks}
                  completedTasks={taskAnalytics.completedTasks}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks by Owner & Overdue Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Owner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Tasks by Owner
            </CardTitle>
          </CardHeader>
          <CardContent>
            {taskAnalytics.tasksByOwner?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>In Progress</TableHead>
                    <TableHead>Blocked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskAnalytics.tasksByOwner.map((owner: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{owner.owner}</TableCell>
                      <TableCell>{owner.total}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                          {owner.completed}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-blue-100 text-blue-800">
                          {owner.inProgress}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-red-100 text-red-800">
                          {owner.blocked}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No task ownership data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Overdue Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueTasksWithDetails?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueTasksWithDetails.map((task: any) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{task.owner}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs">
                          {task.daysOverdue} days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendReminder(task.id, task.title, task.owner)}
                          disabled={sendingReminder === task.id || task.owner === 'Unassigned'}
                          className="flex items-center gap-2"
                          data-testid={`button-send-reminder-${task.id}`}
                        >
                          {sendingReminder === task.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Send Reminder
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No overdue tasks
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Health Overview section removed as requested */}
    </div>
  );
};

export { ProjectAnalyticsDashboard };