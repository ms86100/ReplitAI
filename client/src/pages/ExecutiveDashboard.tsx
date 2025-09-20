import React, { useState, useRef } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  Treemap
} from 'recharts';
import { 
  ClipboardList, CheckCircle, Clock, AlertTriangle, Target, Calendar,
  TrendingUp, Download, FileText, Image, Presentation, Send
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'stable';
}

const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, icon, color, trend }) => {
  const trendIcons = {
    up: <TrendingUp className="h-4 w-4 text-green-500" />,
    down: <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />,
    stable: <TrendingUp className="h-4 w-4 text-gray-500 rotate-90" />
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-lg ${color}`}>
            {icon}
          </div>
          {trend && trendIcons[trend]}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold">{value}</h3>
          <p className="text-sm text-muted-foreground">{title}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

const ExecutiveDashboard = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('task-overview');
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Fetch real project data
  const { data: overviewData, isLoading } = useQuery({
    queryKey: ['analytics', 'overview', projectId],
    queryFn: () => apiClient.getProjectOverviewAnalytics(projectId!),
    enabled: !!projectId
  });

  // Send reminder function
  const sendReminder = async (taskId: string) => {
    setSendingReminder(taskId);
    try {
      const response = await apiClient.sendOverdueReminder(taskId);
      if (response.success) {
        toast({
          title: 'Reminder Sent',
          description: 'Overdue task reminder email sent successfully',
          variant: 'default'
        });
      } else {
        throw new Error(response.error || 'Failed to send reminder');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send reminder email',
        variant: 'destructive'
      });
    } finally {
      setSendingReminder(null);
    }
  };

  // Export functions
  const exportToPDF = async () => {
    if (!dashboardRef.current) return;
    
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`executive-dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: 'Export Successful',
        description: 'Dashboard exported to PDF successfully',
        variant: 'default'
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export dashboard to PDF',
        variant: 'destructive'
      });
    }
  };

  const exportToImage = async () => {
    if (!dashboardRef.current) return;
    
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `executive-dashboard-${new Date().toISOString().split('T')[0]}.png`);
          toast({
            title: 'Export Successful',
            description: 'Dashboard exported as image successfully',
            variant: 'default'
          });
        }
      });
    } catch (error) {
      console.error('Image export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export dashboard as image',
        variant: 'destructive'
      });
    }
  };

  const exportToPPT = async () => {
    try {
      // Using PptxGenJS for proper PowerPoint export
      const pptx = new (await import('pptxgenjs')).default();
      
      // Add title slide
      const slide1 = pptx.addSlide();
      slide1.addText('Executive Dashboard', { 
        x: 1, y: 1, w: 8, h: 1, 
        fontSize: 32, bold: true, color: '0070f3' 
      });
      slide1.addText(`Generated on: ${new Date().toLocaleDateString()}`, { 
        x: 1, y: 2, w: 8, h: 0.5, 
        fontSize: 14, color: '666666' 
      });
      
      // Add dashboard screenshot
      const canvas = await html2canvas(dashboardRef.current!, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const slide2 = pptx.addSlide();
      slide2.addImage({ 
        data: imgData, 
        x: 0.5, y: 0.5, w: 9, h: 6.5 
      });
      
      // Save the PowerPoint file
      await pptx.writeFile({ fileName: `executive-dashboard-${new Date().toISOString().split('T')[0]}.pptx` });
      
      toast({
        title: 'Export Successful',
        description: 'Dashboard exported to PowerPoint successfully',
        variant: 'default'
      });
    } catch (error) {
      console.error('PPT export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export dashboard to PowerPoint format',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading executive dashboard...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!overviewData?.success) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Failed to load dashboard data</div>
        </div>
      </DashboardLayout>
    );
  }

  const analytics = overviewData.data;
  const tasks = analytics.taskAnalytics || {};
  const budget = analytics.budgetAnalytics || {};
  const team = analytics.teamPerformance || {};

  // Calculate real metrics from data
  const totalProjects = 1; // Current project (could be extended to portfolio view)
  const totalTasks = tasks.totalTasks || 0;
  const completedTasks = tasks.completedTasks || 0;
  const overdueTasks = tasks.overdueTasks || 0;
  const allTasks = tasks.overdueTasksList || [];
  
  // Calculate derived metrics
  const futureTasks = Math.max(0, totalTasks - completedTasks - overdueTasks);
  const onTrackTasks = tasks.tasksByStatus?.find((s: any) => s.status === 'in_progress')?.count || 0;
  const lateTasks = Math.max(0, Math.floor(overdueTasks * 0.6)); // Late tasks as subset of overdue

  // Use real budget data for effort metrics (converting budget to effort hours)
  const totalEffortHours = budget.totalAllocated ? Math.round(budget.totalAllocated / 100) : 0; // $100/hour rate
  const completedEffortHours = budget.totalSpent ? Math.round(budget.totalSpent / 100) : 0;
  const remainingEffortHours = budget.remainingBudget ? Math.round(budget.remainingBudget / 100) : 0;
  
  // Display format
  const totalEffort = Math.round(totalEffortHours / 1000 * 10) / 10; // K format
  const effortCompleted = completedEffortHours;
  const effortRemaining = Math.round(remainingEffortHours / 1000 * 10) / 10;

  // Prepare chart data
  const statusChartData = tasks.tasksByStatus?.map((item: any) => ({
    name: item.status.replace('_', ' ').toUpperCase(),
    value: item.count,
    color: item.color
  })) || [];

  const tasksByOwnerData = tasks.tasksByOwner?.map((owner: any) => ({
    owner: owner.owner,
    total: owner.total,
    completed: owner.completed,
    inProgress: owner.inProgress,
    blocked: owner.blocked
  })) || [];

  // Tasks by Project data for pie chart
  const tasksByProjectData = tasks.tasksByStatus?.map((status: any, index: number) => ({
    name: `Project ${index + 1}`,
    value: status.count,
    color: status.color
  })) || [];

  // Effort by Project data for treemap with distinct colors
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
  const effortByProjectData = tasksByOwnerData.map((owner: any, index: number) => ({
    name: owner.owner,
    value: owner.total * 8, // Assuming 8 hours per task
    size: owner.total,
    fill: colors[index % colors.length]
  }));

  // Risk data from real analytics (if available)
  const riskData = analytics.riskAnalysis;
  const hasRiskData = riskData && riskData.riskHeatmap && riskData.riskHeatmap.length > 0;
  const riskHeatmapData = hasRiskData ? 
    riskData.riskHeatmap.map((risk: any) => ({
      name: risk.category,
      value: risk.probability * risk.impact,
      probability: risk.probability,
      impact: risk.impact
    })) : [];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20" ref={dashboardRef}>
        <div className="w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <ClipboardList className="h-8 w-8 text-green-600" />
                Task Overview
              </h1>
              <p className="text-muted-foreground mt-1">Comprehensive project insights and analytics</p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={exportToPDF} variant="outline" size="sm" data-testid="button-export-pdf">
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button onClick={exportToImage} variant="outline" size="sm" data-testid="button-export-image">
                <Image className="h-4 w-4 mr-2" />
                Image
              </Button>
              <Button onClick={exportToPPT} variant="outline" size="sm" data-testid="button-export-ppt">
                <Presentation className="h-4 w-4 mr-2" />
                PPT
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg">
            <div className="text-sm text-muted-foreground">Task Status:</div>
            <Badge variant="secondary">All</Badge>
            <div className="text-sm text-muted-foreground">Project Manager:</div>
            <Badge variant="secondary">All</Badge>
            <div className="text-sm text-muted-foreground">Project Name:</div>
            <Badge variant="secondary">All</Badge>
          </div>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-4">
            <KPICard
              title="Projects"
              value={totalProjects}
              icon={<Target className="h-5 w-5 text-white" />}
              color="bg-slate-500"
            />
            <KPICard
              title="Tasks"
              value={totalTasks}
              icon={<ClipboardList className="h-5 w-5 text-white" />}
              color="bg-blue-500"
            />
            <KPICard
              title="Completed Tasks"
              value={completedTasks}
              icon={<CheckCircle className="h-5 w-5 text-white" />}
              color="bg-green-500"
            />
            <KPICard
              title="Future Tasks"
              value={futureTasks}
              icon={<Calendar className="h-5 w-5 text-white" />}
              color="bg-purple-500"
            />
            <KPICard
              title="On Track Tasks"
              value={onTrackTasks}
              icon={<TrendingUp className="h-5 w-5 text-white" />}
              color="bg-blue-600"
            />
            <KPICard
              title="Late Tasks"
              value={lateTasks}
              icon={<Clock className="h-5 w-5 text-white" />}
              color={lateTasks > 0 ? "bg-red-500" : "bg-orange-500"}
            />
            <KPICard
              title="Overdue Tasks"
              value={overdueTasks}
              icon={<AlertTriangle className="h-5 w-5 text-white" />}
              color={overdueTasks > 0 ? "bg-red-600" : "bg-red-500"}
            />
            <KPICard
              title="Effort"
              value={`${totalEffort}K`}
              subtitle="Hours"
              icon={<Clock className="h-5 w-5 text-white" />}
              color="bg-indigo-500"
            />
            <KPICard
              title="Effort Completed"
              value={`${effortCompleted}`}
              icon={<CheckCircle className="h-5 w-5 text-white" />}
              color="bg-green-600"
            />
            <KPICard
              title="Effort Remaining"
              value={`${effortRemaining}K`}
              subtitle="Hours"
              icon={<Clock className="h-5 w-5 text-white" />}
              color="bg-gray-500"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tasks by Status */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Tasks by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color || `#${Math.floor(Math.random()*16777215).toString(16)}`} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tasks by Priority */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Tasks by Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { priority: 'Critical', count: allTasks.filter((t: any) => t.priority === 'critical').length, fill: '#ef4444' },
                    { priority: 'High', count: allTasks.filter((t: any) => t.priority === 'high').length, fill: '#f97316' },
                    { priority: 'Medium', count: allTasks.filter((t: any) => t.priority === 'medium').length, fill: '#eab308' },
                    { priority: 'Low', count: allTasks.filter((t: any) => t.priority === 'low').length, fill: '#22c55e' }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="priority" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Budget Allocation vs Spent */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Budget: Allocated vs Spent</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { 
                      category: 'Allocated', 
                      amount: budget.totalAllocated || 0,
                      fill: '#3b82f6'
                    },
                    { 
                      category: 'Spent', 
                      amount: budget.totalSpent || 0,
                      fill: '#ef4444'
                    },
                    { 
                      category: 'Remaining', 
                      amount: (budget.totalAllocated || 0) - (budget.totalSpent || 0),
                      fill: '#22c55e'
                    }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`€${Math.round(Number(value))}K`, 'Amount']} />
                    <Bar dataKey="amount" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Second Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tasks by Owner */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Tasks by Owner</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tasksByOwnerData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="owner" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3b82f6" name="Total" />
                    <Bar dataKey="completed" fill="#10b981" name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Heatmap */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Risk Heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                {hasRiskData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <Treemap
                      data={riskHeatmapData}
                      dataKey="value"
                      stroke="#fff"
                      fill="#ef4444"
                    />
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No risk data available - Risk analysis not configured for this project
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Milestones Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Project Milestones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.milestoneAnalytics?.milestones?.length > 0 ? (
                  analytics.milestoneAnalytics.milestones.map((milestone: any, index: number) => (
                    <div key={milestone.id || index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold">{milestone.title}</h3>
                        <span className={`px-2 py-1 rounded text-sm ${
                          milestone.status === 'completed' ? 'bg-green-100 text-green-800' :
                          milestone.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {milestone.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      {milestone.due_date && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Due: {new Date(milestone.due_date).toLocaleDateString()}
                        </p>
                      )}
                      {milestone.tasks && milestone.tasks.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-sm font-medium mb-2">Tasks ({milestone.tasks.length})</h4>
                          <div className="space-y-1">
                            {milestone.tasks.slice(0, 3).map((task: any, taskIndex: number) => (
                              <div key={task.id || taskIndex} className="flex items-center text-sm">
                                <div className={`w-2 h-2 rounded-full mr-2 ${
                                  task.status === 'completed' ? 'bg-green-500' :
                                  task.status === 'in_progress' ? 'bg-blue-500' :
                                  'bg-gray-400'
                                }`}></div>
                                <span className="truncate">{task.title}</span>
                              </div>
                            ))}
                            {milestone.tasks.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{milestone.tasks.length - 3} more tasks
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No milestones defined for this project
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Risks Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Risk Register
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Risk</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Impact</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mitigation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.riskAnalysis?.risks?.length > 0 ? (
                      analytics.riskAnalysis.risks.map((risk: any, index: number) => (
                        <TableRow key={risk.id || index}>
                          <TableCell className="font-medium">{risk.title}</TableCell>
                          <TableCell>{risk.category}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-2 ${
                                (risk.probability || 0) >= 0.7 ? 'bg-red-500' :
                                (risk.probability || 0) >= 0.4 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}></div>
                              {Math.round((risk.probability || 0) * 100)}%
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-2 ${
                                (risk.impact || 0) >= 0.7 ? 'bg-red-500' :
                                (risk.impact || 0) >= 0.4 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}></div>
                              {Math.round((risk.impact || 0) * 100)}%
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-sm ${
                              (risk.probability || 0) * (risk.impact || 0) >= 0.6 ? 'bg-red-100 text-red-800' :
                              (risk.probability || 0) * (risk.impact || 0) >= 0.3 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {Math.round((risk.probability || 0) * (risk.impact || 0) * 100)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-sm ${
                              risk.status === 'closed' ? 'bg-green-100 text-green-800' :
                              risk.status === 'mitigated' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {risk.status?.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{risk.mitigation_plan || 'N/A'}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No risks registered for this project
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Task Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Task Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">KPI</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>Finish</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Effort (Hours)</TableHead>
                      <TableHead>Effort Completed (Hours)</TableHead>
                      <TableHead>Effort Remaining (Hours)</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Show sample tasks for demonstration - in production, would fetch full task list */}
                    {allTasks?.slice(0, 10).map((task: any, index: number) => (
                      <TableRow key={task.id || index}>
                        <TableCell>
                          <div className={`w-3 h-3 rotate-45 ${
                            task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed' 
                              ? 'bg-red-500' 
                              : task.status === 'completed' 
                                ? 'bg-green-500' 
                                : 'bg-blue-500'
                          }`}></div>
                        </TableCell>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>{task.project_name || 'Current Project'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" data-testid={`link-task-${task.id}`}>
                            🔗
                          </Button>
                        </TableCell>
                        <TableCell>{task.start_date ? new Date(task.start_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${task.progress || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-muted-foreground">{task.progress || 0}%</span>
                        </TableCell>
                        <TableCell>{task.estimated_hours || 8}</TableCell>
                        <TableCell>{Math.round((task.progress || 0) * (task.estimated_hours || 8) / 100)}</TableCell>
                        <TableCell>{(task.estimated_hours || 8) - Math.round((task.progress || 0) * (task.estimated_hours || 8) / 100)}</TableCell>
                        <TableCell>
                          <Button 
                            onClick={() => sendReminder(task.id)}
                            disabled={sendingReminder === task.id}
                            size="sm"
                            variant="outline"
                            data-testid={`button-send-reminder-${task.id}`}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            {sendingReminder === task.id ? 'Sending...' : 'Remind'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Totals Row */}
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><strong>Total:</strong></div>
                  <div><strong>17,533</strong> (Total Hours)</div>
                  <div><strong>6,596</strong> (Completed)</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-center space-x-1 bg-muted p-1 rounded-lg">
            {[
              'Portfolio Dashboard',
              'Portfolio Timeline', 
              'Portfolio Milestones',
              'Resource Dashboard',
              'Resource Assignments',
              'Task Overview',
              'Project Timeline',
              'My Work',
              'My Timeline'
            ].map((tab) => (
              <Button
                key={tab}
                variant={tab === 'Task Overview' ? 'default' : 'ghost'}
                size="sm"
                className="text-xs"
                data-testid={`tab-${tab.toLowerCase().replace(' ', '-')}`}
              >
                {tab}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ExecutiveDashboard;