import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  Target,
  DollarSign,
  Clock,
  CheckSquare,
  Shield,
  Users,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  PieChart,
  CheckCircle,
  Calendar,
  User
} from 'lucide-react';

interface ProjectAnalyticsData {
  projectHealth: {
    overall: number;
    budget: number;
    timeline: number;
    risks: number;
    team: number;
  };
  budgetAnalytics: {
    totalAllocated: number;
    totalSpent: number;
    remainingBudget: number;
    spendByCategory: Array<{ name: string; value: number; color: string }>;
    burnRate: Array<{ month: string; planned: number; actual: number }>;
  };
  teamPerformance: {
    totalMembers: number;
    activeMembers: number;
    avgCapacity: number;
    avgEfficiency: number;
    topPerformers: Array<{ name: string; efficiency: number }>;
    capacityTrend: Array<{ week: string; capacity: number; utilization: number }>;
  };
  taskAnalytics: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    avgCompletionTime: number;
    tasksByStatus: Array<{ status: string; count: number; color: string }>;
    tasksByOwner: Array<{ owner: string; total: number; completed: number; inProgress: number; blocked: number }>;
    overdueTasksList: Array<{ id: string; title: string; owner: string; dueDate: string; daysOverdue: number }>;
    productivityTrend: Array<{ week: string; completed: number; created: number }>;
  };
  riskAnalysis: {
    totalRisks: number;
    highRisks: number;
    mitigatedRisks: number;
    riskHeatmap: Array<{ category: string; probability: number; impact: number }>;
    risksByCategory: Array<{ category: string; count: number }>;
  };
  stakeholderEngagement: {
    totalStakeholders: number;
    activeStakeholders: number;
    recentMeetings: number;
    communicationFrequency: Array<{ week: string; interactions: number }>;
  };
  retrospectiveInsights: {
    totalRetros: number;
    actionItemsCreated: number;
    actionItemsCompleted: number;
    teamSatisfactionTrend: Array<{ sprint: string; satisfaction: number }>;
  };
}

interface ProjectAnalyticsDashboardProps {
  projectId: string;
}

export const ProjectAnalyticsDashboard: React.FC<ProjectAnalyticsDashboardProps> = ({ projectId }) => {
  const [analyticsData, setAnalyticsData] = useState<ProjectAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyticsData();
  }, [projectId]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch analytics via API client (handles auth)
      console.log('Fetching analytics for project:', projectId);
      const resp = await apiClient.getProjectOverviewAnalytics(projectId);
      console.log('Analytics API response:', resp);
      
      if (!resp.success) {
        throw new Error(resp.error || 'Analytics request failed');
      }
      
      const apiData = resp.data;
      console.log('Analytics data received:', apiData);
      
      // Build analytics data from real API response with enhanced task analytics
      const finalAnalyticsData: ProjectAnalyticsData = {
        projectHealth: {
          overall: apiData.projectHealth?.overall || 0,
          budget: apiData.projectHealth?.budget || 0,
          timeline: apiData.projectHealth?.timeline || 0,
          risks: apiData.projectHealth?.risks || 0,
          team: apiData.projectHealth?.team || 0
        },
        budgetAnalytics: {
          totalAllocated: apiData.budgetAnalytics?.totalAllocated || 0,
          totalSpent: apiData.budgetAnalytics?.totalSpent || 0,
          remainingBudget: apiData.budgetAnalytics?.remainingBudget || 0,
          spendByCategory: apiData.budgetAnalytics?.spendByCategory || [],
          burnRate: apiData.budgetAnalytics?.burnRate || []
        },
        teamPerformance: {
          totalMembers: apiData.teamPerformance?.totalMembers || 0,
          activeMembers: apiData.teamPerformance?.activeMembers || 0,
          avgCapacity: apiData.teamPerformance?.avgCapacity || 0,
          avgEfficiency: apiData.teamPerformance?.avgEfficiency || 0,
          topPerformers: apiData.teamPerformance?.topPerformers || [],
          capacityTrend: apiData.teamPerformance?.capacityTrend || []
        },
        taskAnalytics: {
          totalTasks: apiData.taskAnalytics?.totalTasks || 0,
          completedTasks: apiData.taskAnalytics?.completedTasks || 0,
          overdueTasks: apiData.taskAnalytics?.overdueTasks || 0,
          avgCompletionTime: apiData.taskAnalytics?.avgCompletionTime || 0,
          tasksByStatus: apiData.taskAnalytics?.tasksByStatus || [],
          tasksByOwner: apiData.taskAnalytics?.tasksByOwner || [],
          overdueTasksList: apiData.taskAnalytics?.overdueTasksList || [],
          productivityTrend: apiData.taskAnalytics?.productivityTrend || []
        },
        riskAnalysis: {
          totalRisks: apiData.riskAnalysis?.totalRisks || 0,
          highRisks: apiData.riskAnalysis?.highRisks || 0,
          mitigatedRisks: apiData.riskAnalysis?.mitigatedRisks || 0,
          riskHeatmap: apiData.riskAnalysis?.riskHeatmap || [],
          risksByCategory: apiData.riskAnalysis?.risksByCategory || []
        },
        stakeholderEngagement: {
          totalStakeholders: apiData.stakeholderAnalytics?.totalStakeholders || 0,
          activeStakeholders: apiData.stakeholderAnalytics?.activeStakeholders || 0,
          recentMeetings: apiData.stakeholderAnalytics?.recentMeetings || 0,
          communicationFrequency: apiData.stakeholderAnalytics?.communicationFrequency || []
        },
        retrospectiveInsights: {
          totalRetros: apiData.retrospectiveAnalytics?.totalRetros || 0,
          actionItemsCreated: apiData.retrospectiveAnalytics?.totalActionItems || 0,
          actionItemsCompleted: apiData.retrospectiveAnalytics?.convertedToTasks || 0,
          teamSatisfactionTrend: apiData.retrospectiveAnalytics?.teamSatisfactionTrend || []
        }
      };
      
      setAnalyticsData(finalAnalyticsData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      
      // Set empty analytics data structure if API fails
      const emptyAnalyticsData: ProjectAnalyticsData = {
        projectHealth: { overall: 0, budget: 0, timeline: 0, risks: 0, team: 0 },
        budgetAnalytics: { totalAllocated: 0, totalSpent: 0, remainingBudget: 0, spendByCategory: [], burnRate: [] },
        teamPerformance: { totalMembers: 0, activeMembers: 0, avgCapacity: 0, avgEfficiency: 0, topPerformers: [], capacityTrend: [] },
        taskAnalytics: { 
          totalTasks: 0, 
          completedTasks: 0, 
          overdueTasks: 0, 
          avgCompletionTime: 0, 
          tasksByStatus: [], 
          tasksByOwner: [],
          overdueTasksList: [],
          productivityTrend: [] 
        },
        riskAnalysis: { totalRisks: 0, highRisks: 0, mitigatedRisks: 0, riskHeatmap: [], risksByCategory: [] },
        stakeholderEngagement: { totalStakeholders: 0, activeStakeholders: 0, recentMeetings: 0, communicationFrequency: [] },
        retrospectiveInsights: { totalRetros: 0, actionItemsCreated: 0, actionItemsCompleted: 0, teamSatisfactionTrend: [] }
      };
      
      setAnalyticsData(emptyAnalyticsData);
      
      toast({
        title: 'Dashboard Service',
        description: 'Unable to load dashboard right now.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboard data...</div>
      </div>
    );
  }

  // Error state
  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Failed to load dashboard data</div>
      </div>
    );
  }

  const { projectHealth, budgetAnalytics, teamPerformance, taskAnalytics, riskAnalysis, stakeholderEngagement, retrospectiveInsights } = analyticsData;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Dashboard</h1>
          <p className="text-muted-foreground mt-1">Comprehensive project insights and analytics</p>
        </div>
      </div>

      {/* Key Metrics Summary - Airbus Theme */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Tasks */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-700 text-sm font-medium">#Tasks</p>
                <p className="text-3xl font-bold text-slate-900">{taskAnalytics.totalTasks}</p>
                <p className="text-slate-600 text-sm">Total Tasks</p>
              </div>
              <div className="h-12 w-12 bg-slate-600 rounded-lg flex items-center justify-center">
                <CheckSquare className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completed Tasks */}
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-700 text-sm font-medium">#Completed</p>
                <p className="text-3xl font-bold text-emerald-900">{taskAnalytics.completedTasks}</p>
                <p className="text-emerald-600 text-sm">Completed Tasks</p>
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
              {taskAnalytics.tasksByStatus?.length > 0 && taskAnalytics.tasksByStatus.some(item => item.count > 0) ? (
                <RechartsPieChart>
                  <Pie
                    data={taskAnalytics.tasksByStatus.filter(item => item.count > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, count }) => `${status}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {taskAnalytics.tasksByStatus.filter(item => item.count > 0).map((entry, index) => (
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

        {/* Budget Overview */}
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
                <span className="font-bold">${budgetAnalytics.totalAllocated.toLocaleString()}</span>
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
                <ResponsiveContainer width="100%" height={200}>
                  {budgetAnalytics.spendByCategory?.length > 0 ? (
                    <BarChart data={budgetAnalytics.spendByCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Amount Spent']} />
                      <Bar dataKey="value" fill="#475569" />
                    </BarChart>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                      No budget category data available
                    </div>
                  )}
                </ResponsiveContainer>
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
                  {taskAnalytics.tasksByOwner.map((owner, index) => (
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
              <Calendar className="h-5 w-5" />
              Overdue Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {taskAnalytics.overdueTasksList?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskAnalytics.overdueTasksList.slice(0, 5).map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{task.owner}</TableCell>
                      <TableCell>{task.dueDate}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          {task.daysOverdue} days
                        </Badge>
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

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="budget">Budget Details</TabsTrigger>
          <TabsTrigger value="team">Team Analytics</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Health Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Project Health Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={[
                    { subject: 'Budget', A: projectHealth.budget, fullMark: 100 },
                    { subject: 'Timeline', A: projectHealth.timeline, fullMark: 100 },
                    { subject: 'Team', A: projectHealth.team, fullMark: 100 },
                    { subject: 'Risks', A: projectHealth.risks, fullMark: 100 },
                    { subject: 'Quality', A: 85, fullMark: 100 }
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Health Score" dataKey="A" stroke="#475569" fill="#475569" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Productivity Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Productivity Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  {taskAnalytics.productivityTrend?.length > 0 ? (
                    <AreaChart data={taskAnalytics.productivityTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="completed" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="created" stackId="2" stroke="#475569" fill="#475569" fillOpacity={0.6} />
                    </AreaChart>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No productivity trend data available
                    </div>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="budget" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget Spend by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Spend by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  {budgetAnalytics.spendByCategory?.length > 0 ? (
                    <RechartsPieChart>
                      <Pie
                        data={budgetAnalytics.spendByCategory}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {budgetAnalytics.spendByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Amount']} />
                      <Legend />
                    </RechartsPieChart>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No budget category data available
                    </div>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Budget Burn Rate */}
            <Card>
              <CardHeader>
                <CardTitle>Budget vs Spend Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  {budgetAnalytics.burnRate?.length > 0 ? (
                    <AreaChart data={budgetAnalytics.burnRate}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, '']} />
                      <Area type="monotone" dataKey="planned" stackId="1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.3} />
                      <Area type="monotone" dataKey="actual" stackId="2" stroke="#475569" fill="#475569" fillOpacity={0.5} />
                    </AreaChart>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No budget trend data available
                    </div>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Capacity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Members:</span>
                    <span className="font-bold">{teamPerformance.totalMembers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Members:</span>
                    <span className="font-bold">{teamPerformance.activeMembers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Capacity:</span>
                    <span className="font-bold">{teamPerformance.avgCapacity}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Efficiency:</span>
                    <span className="font-bold">{teamPerformance.avgEfficiency}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                {teamPerformance.topPerformers?.length > 0 ? (
                  <div className="space-y-3">
                    {teamPerformance.topPerformers.map((performer, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="font-medium">{performer.name}</span>
                        <Badge variant="default">{performer.efficiency}% efficiency</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    No team performance data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Risk Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Risks:</span>
                    <span className="font-bold">{riskAnalysis.totalRisks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>High Priority Risks:</span>
                    <span className="font-bold text-red-600">{riskAnalysis.highRisks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mitigated Risks:</span>
                    <span className="font-bold text-green-600">{riskAnalysis.mitigatedRisks}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stakeholder Engagement */}
            <Card>
              <CardHeader>
                <CardTitle>Stakeholder Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Stakeholders:</span>
                    <span className="font-bold">{stakeholderEngagement.totalStakeholders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Stakeholders:</span>
                    <span className="font-bold">{stakeholderEngagement.activeStakeholders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recent Meetings:</span>
                    <span className="font-bold">{stakeholderEngagement.recentMeetings}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};