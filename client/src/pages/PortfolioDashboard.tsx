import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, Target, Clock, CheckCircle, AlertTriangle, Users, DollarSign } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiClient } from '@/services/api';

const KPICard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'stable';
}> = ({ title, value, subtitle, icon, color, trend }) => {
  const trendIcons = {
    up: <TrendingUp className="h-4 w-4 text-green-500" />,
    down: <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />,
    stable: <TrendingUp className="h-4 w-4 text-gray-500 rotate-90" />
  };

  return (
    <Card className="airbus-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-lg ${color} airbus-gradient`}>
            {icon}
          </div>
          {trend && trendIcons[trend]}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          <h3 className="text-3xl font-bold airbus-text-primary">{value}</h3>
          <p className="text-sm font-medium">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

const PortfolioDashboard = () => {
  const { data: portfolioData, isLoading } = useQuery({
    queryKey: ['portfolio', 'summary'],
    queryFn: () => apiClient.getPortfolioSummary(),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['portfolio', 'projects'],
    queryFn: () => apiClient.getPortfolioProjects(),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading portfolio dashboard...</div>
        </div>
      </DashboardLayout>
    );
  }

  const portfolio = portfolioData?.data || {};
  const projects = projectsData?.data || [];

  // Project status distribution
  const statusData = [
    { name: 'Active', value: portfolio.activeProjects || 0, fill: 'hsl(var(--chart-1))' },
    { name: 'Completed', value: portfolio.completedProjects || 0, fill: 'hsl(var(--chart-2))' },
    { name: 'On Hold', value: portfolio.onHoldProjects || 0, fill: 'hsl(var(--chart-3))' },
    { name: 'At Risk', value: portfolio.atRiskProjects || 0, fill: 'hsl(var(--destructive))' }
  ];

  // Project progress by category
  const categoryData = [
    { category: 'Engineering', total: 8, completed: 6, inProgress: 2 },
    { category: 'Manufacturing', total: 5, completed: 3, inProgress: 2 },
    { category: 'Research', total: 3, completed: 1, inProgress: 2 },
    { category: 'Operations', total: 4, completed: 4, inProgress: 0 }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold airbus-text-primary">Portfolio Dashboard</h1>
            <p className="text-muted-foreground">Enterprise project portfolio overview and insights</p>
          </div>
          <Badge variant="outline" className="airbus-text-accent">
            {portfolio.totalProjects || 0} Active Projects
          </Badge>
        </div>

        {/* KPI Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Projects"
            value={portfolio.totalProjects || 0}
            icon={<Target className="h-6 w-6 text-white" />}
            color="bg-blue-500"
            trend="up"
          />
          <KPICard
            title="Active Projects"
            value={portfolio.activeProjects || 0}
            subtitle="In progress"
            icon={<Clock className="h-6 w-6 text-white" />}
            color="bg-orange-500"
            trend="stable"
          />
          <KPICard
            title="Completed Projects"
            value={portfolio.completedProjects || 0}
            subtitle="This quarter"
            icon={<CheckCircle className="h-6 w-6 text-white" />}
            color="bg-green-500"
            trend="up"
          />
          <KPICard
            title="Total Budget"
            value={`€${Math.round((portfolio.totalBudget || 0) / 1000)}K`}
            subtitle="Allocated across portfolio"
            icon={<DollarSign className="h-6 w-6 text-white" />}
            color="bg-purple-500"
            trend="up"
          />
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Project Status Distribution */}
          <Card className="airbus-card">
            <CardHeader>
              <CardTitle className="airbus-text-primary">Project Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Project Progress by Category */}
          <Card className="airbus-card">
            <CardHeader>
              <CardTitle className="airbus-text-primary">Progress by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill="hsl(var(--chart-2))" name="Completed" />
                  <Bar dataKey="inProgress" fill="hsl(var(--chart-1))" name="In Progress" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Project List */}
        <Card className="airbus-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 airbus-text-primary">
              <Users className="h-5 w-5" />
              Portfolio Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Target Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.slice(0, 10).map((project: any, index: number) => (
                    <TableRow key={project.id || index}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>{project.category || 'Engineering'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          project.status === 'completed' ? 'default' :
                          project.status === 'in_progress' ? 'secondary' :
                          project.status === 'on_hold' ? 'outline' :
                          'destructive'
                        }>
                          {project.status?.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="airbus-gradient h-2 rounded-full" 
                            style={{ width: `${project.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-muted-foreground">{project.progress || 0}%</span>
                      </TableCell>
                      <TableCell>{project.manager_name || 'TBD'}</TableCell>
                      <TableCell>€{Math.round((project.budget || 0) / 1000)}K</TableCell>
                      <TableCell>{project.start_date ? new Date(project.start_date).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>{project.target_completion_date ? new Date(project.target_completion_date).toLocaleDateString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PortfolioDashboard;