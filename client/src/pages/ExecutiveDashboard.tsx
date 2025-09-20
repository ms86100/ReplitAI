import { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { 
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Clock, Users, AlertTriangle, 
  DollarSign, Target, Activity, Calendar, Mail, Download,
  FileText, Image, Presentation
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

// Color palette for charts and health indicators
const COLORS = {
  primary: '#0070f3',
  success: '#00d084',
  warning: '#ff6b35',
  danger: '#dc2626',
  info: '#06b6d4',
  purple: '#8b5cf6',
  charts: ['#0070f3', '#00d084', '#ff6b35', '#dc2626', '#06b6d4', '#8b5cf6']
};

interface HealthKPIProps {
  title: string;
  value: number | string;
  subtitle: string;
  trend?: 'up' | 'down' | 'stable';
  health: 'healthy' | 'warning' | 'critical';
  icon: React.ReactNode;
}

const HealthKPICard = ({ title, value, subtitle, trend, health, icon }: HealthKPIProps) => {
  const healthColors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500', 
    critical: 'bg-red-500'
  };

  const trendIcons = {
    up: <TrendingUp className="h-4 w-4 text-green-600" />,
    down: <TrendingDown className="h-4 w-4 text-red-600" />,
    stable: <Activity className="h-4 w-4 text-blue-600" />
  };

  return (
    <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${healthColors[health]} bg-opacity-10`}>
              {icon}
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {title}
              </CardTitle>
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${healthColors[health]}`} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {value}
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
              {trend && trendIcons[trend]}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ExecutiveDashboard = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('delivery');
  const [dateRange, setDateRange] = useState({ from: '30d', to: 'now' });
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Using existing overview data for now - fallback to working APIs
  const { data: overviewData } = useQuery({
    queryKey: ['analytics', 'overview', projectId],
    queryFn: () => apiClient.getProjectOverviewAnalytics(projectId!),
    enabled: !!projectId
  });

  // Mock data for demonstration - in production these would use the new analytics endpoints
  const velocityData = { data: [
    { date: '2025-01-01', completed: 5, story_points: 13 },
    { date: '2025-01-02', completed: 8, story_points: 21 },
    { date: '2025-01-03', completed: 6, story_points: 15 },
    { date: '2025-01-04', completed: 12, story_points: 34 },
    { date: '2025-01-05', completed: 9, story_points: 23 },
  ]};

  const leadTimeData = { data: { 
    tasks: [], 
    metrics: { p50: 24, p85: 72, average: 48 }
  }};

  const agingWorkData = { data: { 
    tasks: [], 
    buckets: { fresh: 8, moderate: 7, aging: 4, stale: 3 }
  }};

  const forecastData = { data: { 
    avgVelocity: 8, 
    remainingTasks: 16, 
    weeksToComplete: 2, 
    estimatedCompletion: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    confidence: 'High'
  }};

  const teamFocusData = { data: [
    { owner_name: 'Alice Johnson', planned: 8, unplanned: 2, total: 10, focus_ratio: 80 },
    { owner_name: 'Bob Smith', planned: 6, unplanned: 4, total: 10, focus_ratio: 60 },
    { owner_name: 'Carol Davis', planned: 9, unplanned: 1, total: 10, focus_ratio: 90 },
  ]};

  const jiraSyncData = { data: { 
    syncPercentage: 85, 
    totalTasks: 22, 
    syncedTasks: 19, 
    lastSyncTime: new Date(),
    syncHealth: 'healthy'
  }};

  const budgetData = { data: { 
    totalBudget: 500000, 
    spentToDate: 320000, 
    remaining: 180000, 
    burnRate: 50000, 
    runwayMonths: 3.6, 
    budgetHealth: 'healthy',
    spentPercentage: 64,
    categoryAllocation: [
      { category: 'Personnel', amount: 192000, percentage: 60 },
      { category: 'Infrastructure', amount: 64000, percentage: 20 },
      { category: 'External Services', amount: 48000, percentage: 15 },
      { category: 'Other', amount: 16000, percentage: 5 }
    ]
  }};

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
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgWidth = 297;
      const pageHeight = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`project-dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
      
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
          saveAs(blob, `project-dashboard-${new Date().toISOString().split('T')[0]}.png`);
          toast({
            title: 'Export Successful',
            description: 'Dashboard exported to image successfully',
            variant: 'default'
          });
        }
      });
    } catch (error) {
      console.error('Image export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export dashboard to image',
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
      await pptx.writeFile({ fileName: `project-dashboard-${new Date().toISOString().split('T')[0]}.pptx` });
      
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

  // Calculate health metrics
  const getOverallHealth = () => {
    const budgetHealth = budgetData?.data?.budgetHealth || 'unknown';
    const jiraHealth = jiraSyncData?.data?.syncHealth || 'unknown';
    const agingIssues = agingWorkData?.data?.buckets?.stale || 0;
    
    if (budgetHealth === 'critical' || agingIssues > 10) return 'critical';
    if (budgetHealth === 'warning' || jiraHealth === 'warning' || agingIssues > 5) return 'warning';
    return 'healthy';
  };

  const handleSendReminder = async (taskId: string, taskTitle: string, owner: string) => {
    try {
      setSendingReminder(taskId);
      const response = await apiClient.sendOverdueReminder(taskId);
      
      if (response.success) {
        toast({
          title: 'Reminder Sent',
          description: response.data?.message || `Email reminder sent to ${owner}`,
          variant: 'default'
        });
      } else {
        throw new Error(response.error || 'Failed to send reminder');
      }
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast({
        title: 'Reminder Failed',
        description: error instanceof Error ? error.message : 'Failed to send reminder email',
        variant: 'destructive'
      });
    } finally {
      setSendingReminder(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6" ref={dashboardRef}>
      {/* Header with Export Actions */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Executive Dashboard
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Real-time insights and performance metrics
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={exportToImage}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
            data-testid="button-export-image"
          >
            <Image className="h-4 w-4" />
            <span>Export PNG</span>
          </Button>
          
          <Button
            onClick={exportToPDF}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
            data-testid="button-export-pdf"
          >
            <FileText className="h-4 w-4" />
            <span>Export PDF</span>
          </Button>
          
          <Button
            onClick={exportToPPT}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
            data-testid="button-export-ppt"
          >
            <Presentation className="h-4 w-4" />
            <span>Export PPT</span>
          </Button>
        </div>
      </div>

      {/* Health KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <HealthKPICard
          title="Overall Health"
          value="87%"
          subtitle="Project status"
          trend="up"
          health={getOverallHealth()}
          icon={<Target className="h-6 w-6 text-blue-600" />}
        />
        
        <HealthKPICard
          title="Budget Health"
          value={budgetData?.data ? `${Math.round(budgetData.data.spentPercentage)}%` : 'Loading...'}
          subtitle="Budget utilized"
          trend={budgetData?.data?.budgetHealth === 'healthy' ? 'stable' : 'down'}
          health={budgetData?.data?.budgetHealth || 'warning'}
          icon={<DollarSign className="h-6 w-6 text-green-600" />}
        />
        
        <HealthKPICard
          title="Schedule Health"
          value={forecastData?.data?.confidence || 'Medium'}
          subtitle="Delivery confidence"
          trend="stable"
          health="healthy"
          icon={<Calendar className="h-6 w-6 text-purple-600" />}
        />
        
        <HealthKPICard
          title="Risk Exposure"
          value={agingWorkData?.data?.buckets?.stale || 0}
          subtitle="High-risk items"
          trend={agingWorkData?.data?.buckets?.stale > 5 ? 'up' : 'stable'}
          health={agingWorkData?.data?.buckets?.stale > 10 ? 'critical' : agingWorkData?.data?.buckets?.stale > 5 ? 'warning' : 'healthy'}
          icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
        />
        
        <HealthKPICard
          title="Team Health"
          value={teamFocusData?.data?.length || 0}
          subtitle="Active contributors"
          trend="up"
          health="healthy"
          icon={<Users className="h-6 w-6 text-indigo-600" />}
        />
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-white dark:bg-gray-800 shadow-sm">
          <TabsTrigger value="delivery" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Delivery</span>
          </TabsTrigger>
          <TabsTrigger value="budget" className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4" />
            <span>Budget & Capacity</span>
          </TabsTrigger>
          <TabsTrigger value="risk" className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Risk & Governance</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Team Performance</span>
          </TabsTrigger>
        </TabsList>

        {/* Delivery Tab */}
        <TabsContent value="delivery" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Velocity Trend Chart */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span>Velocity Trend</span>
                </CardTitle>
                <CardDescription>Tasks completed over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={velocityData?.data || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="completed" 
                      stroke={COLORS.primary} 
                      fill={COLORS.primary} 
                      fillOpacity={0.3} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lead Time Analysis */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-green-600" />
                  <span>Lead Time Analysis</span>
                </CardTitle>
                <CardDescription>Delivery performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">P50 Lead Time</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {leadTimeData?.data?.metrics?.p50?.toFixed(1) || 0}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">P85 Lead Time</span>
                    <span className="text-2xl font-bold text-orange-600">
                      {leadTimeData?.data?.metrics?.p85?.toFixed(1) || 0}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Average Lead Time</span>
                    <span className="text-2xl font-bold text-purple-600">
                      {leadTimeData?.data?.metrics?.average?.toFixed(1) || 0}h
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overdue Tasks Table */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span>Overdue Tasks</span>
                  <Badge variant="destructive">{overviewData?.data?.overdueTasksList?.length || 0}</Badge>
                </CardTitle>
                <CardDescription>Tasks requiring immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overviewData?.data?.overdueTasksList?.map((task: any) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>{task.owner}</TableCell>
                        <TableCell>{new Date(task.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{task.daysOverdue} days</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleSendReminder(task.id, task.title, task.owner)}
                            disabled={sendingReminder === task.id}
                            className="flex items-center space-x-1"
                            data-testid={`button-send-reminder-${task.id}`}
                          >
                            <Mail className="h-3 w-3" />
                            <span>{sendingReminder === task.id ? 'Sending...' : 'Remind'}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
          </div>
        </TabsContent>

        {/* Budget & Capacity Tab */}
        <TabsContent value="budget" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Budget Burn Chart */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span>Budget Burn Rate</span>
                </CardTitle>
                <CardDescription>Spending vs planned budget</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Budget</span>
                    <span className="text-xl font-bold">
                      ${(budgetData?.data?.totalBudget || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Spent to Date</span>
                    <span className="text-xl font-bold text-orange-600">
                      ${(budgetData?.data?.spentToDate || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Remaining</span>
                    <span className="text-xl font-bold text-green-600">
                      ${(budgetData?.data?.remaining || 0).toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={budgetData?.data?.spentPercentage || 0} 
                    className="h-3"
                  />
                  <div className="text-center text-sm text-gray-600">
                    {Math.round(budgetData?.data?.spentPercentage || 0)}% of budget utilized
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category Allocation */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Budget Allocation</CardTitle>
                <CardDescription>Spending by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={budgetData?.data?.categoryAllocation || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percentage }) => `${category} ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="percentage"
                    >
                      {(budgetData?.data?.categoryAllocation || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS.charts[index % COLORS.charts.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Runway Forecast */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  <span>Forecast & Runway</span>
                </CardTitle>
                <CardDescription>Project completion predictions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {budgetData?.data?.runwayMonths || 0}
                    </div>
                    <div className="text-sm text-gray-600">Months Remaining</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {forecastData?.data?.weeksToComplete || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">Weeks to Complete</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {forecastData?.data?.confidence || 'Medium'}
                    </div>
                    <div className="text-sm text-gray-600">Confidence Level</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
          </div>
        </TabsContent>

        {/* Risk & Governance Tab */}
        <TabsContent value="risk" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Aging Work Analysis */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span>Work Aging Analysis</span>
                </CardTitle>
                <CardDescription>Task age distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { age: 'Fresh (0-3 days)', count: agingWorkData?.data?.buckets?.fresh || 0 },
                      { age: 'Moderate (4-7 days)', count: agingWorkData?.data?.buckets?.moderate || 0 },
                      { age: 'Aging (8-14 days)', count: agingWorkData?.data?.buckets?.aging || 0 },
                      { age: 'Stale (15+ days)', count: agingWorkData?.data?.buckets?.stale || 0 }
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="age" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill={COLORS.warning} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Jira Sync Health */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <span>Jira Sync Health</span>
                </CardTitle>
                <CardDescription>Integration status and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Sync Status</span>
                    <Badge 
                      variant={jiraSyncData?.data?.syncHealth === 'healthy' ? 'default' : 'destructive'}
                    >
                      {jiraSyncData?.data?.syncHealth || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Synced Tasks</span>
                    <span className="text-xl font-bold">
                      {jiraSyncData?.data?.syncedTasks || 0} / {jiraSyncData?.data?.totalTasks || 0}
                    </span>
                  </div>
                  <Progress 
                    value={jiraSyncData?.data?.syncPercentage || 0} 
                    className="h-3"
                  />
                  <div className="text-center text-sm text-gray-600">
                    {Math.round(jiraSyncData?.data?.syncPercentage || 0)}% sync coverage
                  </div>
                  <div className="text-xs text-gray-500">
                    Last sync: {jiraSyncData?.data?.lastSyncTime ? 
                      new Date(jiraSyncData.data.lastSyncTime).toLocaleString() : 'Never'}
                  </div>
                </div>
              </CardContent>
            </Card>
            
          </div>
        </TabsContent>

        {/* Team Performance Tab */}
        <TabsContent value="team" className="mt-6">
          <div className="grid grid-cols-1 gap-6">
            
            {/* Team Focus Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <span>Team Focus Metrics</span>
                </CardTitle>
                <CardDescription>Planned vs unplanned work distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Member</TableHead>
                      <TableHead>Planned Work</TableHead>
                      <TableHead>Unplanned Work</TableHead>
                      <TableHead>Total Tasks</TableHead>
                      <TableHead>Focus Ratio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamFocusData?.data?.map((member: any) => (
                      <TableRow key={member.owner_id}>
                        <TableCell className="font-medium">{member.owner_name || 'Unknown'}</TableCell>
                        <TableCell>{member.planned}</TableCell>
                        <TableCell>{member.unplanned}</TableCell>
                        <TableCell>{member.total}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Progress value={member.focus_ratio} className="h-2 w-20" />
                            <span className="text-sm">{Math.round(member.focus_ratio)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
          </div>
        </TabsContent>
        
      </Tabs>
    </div>
  );
};

export default ExecutiveDashboard;