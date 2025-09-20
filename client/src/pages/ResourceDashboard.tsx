import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, UserCheck, UserX, AlertTriangle, Clock, Target } from 'lucide-react';
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
  return (
    <Card className="airbus-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-lg ${color} airbus-gradient`}>
            {icon}
          </div>
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

const ResourceDashboard = () => {
  const { data: resourceData, isLoading } = useQuery({
    queryKey: ['resources', 'summary'],
    queryFn: () => apiClient.getResourceSummary(),
  });

  const { data: utilizationData } = useQuery({
    queryKey: ['resources', 'utilization'],
    queryFn: () => apiClient.getResourceUtilization(),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading resource dashboard...</div>
        </div>
      </DashboardLayout>
    );
  }

  const resources = resourceData?.data || {};
  const utilization = utilizationData?.data || [];

  // Resource allocation pie chart
  const allocationData = [
    { name: 'Assigned', value: resources.assignedResources || 0, fill: 'hsl(var(--chart-1))' },
    { name: 'Available', value: resources.availableResources || 0, fill: 'hsl(var(--chart-2))' },
    { name: 'Overallocated', value: resources.overallocatedResources || 0, fill: 'hsl(var(--destructive))' }
  ];

  // Team utilization heatmap data
  const utilizationHeatmap = [
    { team: 'Engineering', week1: 85, week2: 92, week3: 78, week4: 95 },
    { team: 'Design', week1: 70, week2: 85, week3: 88, week4: 75 },
    { team: 'QA', week1: 90, week2: 95, week3: 85, week4: 80 },
    { team: 'DevOps', week1: 100, week2: 105, week3: 95, week4: 90 }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold airbus-text-primary">Resource Dashboard</h1>
            <p className="text-muted-foreground">Team allocation and utilization insights</p>
          </div>
          <Badge variant="outline" className="airbus-text-accent">
            {resources.totalResources || 0} Total Resources
          </Badge>
        </div>

        {/* KPI Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Resources"
            value={resources.totalResources || 0}
            icon={<Users className="h-6 w-6 text-white" />}
            color="bg-blue-500"
          />
          <KPICard
            title="Assigned Resources"
            value={resources.assignedResources || 0}
            subtitle="Currently working"
            icon={<UserCheck className="h-6 w-6 text-white" />}
            color="bg-green-500"
          />
          <KPICard
            title="Available Resources"
            value={resources.availableResources || 0}
            subtitle="Ready for assignment"
            icon={<Clock className="h-6 w-6 text-white" />}
            color="bg-orange-500"
          />
          <KPICard
            title="Overallocated"
            value={resources.overallocatedResources || 0}
            subtitle="Need rebalancing"
            icon={<AlertTriangle className="h-6 w-6 text-white" />}
            color="bg-red-500"
          />
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Resource Allocation */}
          <Card className="airbus-card">
            <CardHeader>
              <CardTitle className="airbus-text-primary">Resource Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Team Utilization */}
          <Card className="airbus-card">
            <CardHeader>
              <CardTitle className="airbus-text-primary">Team Utilization (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={utilizationHeatmap}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="team" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="week1" fill="hsl(var(--chart-1))" name="Week 1" />
                  <Bar dataKey="week2" fill="hsl(var(--chart-2))" name="Week 2" />
                  <Bar dataKey="week3" fill="hsl(var(--chart-3))" name="Week 3" />
                  <Bar dataKey="week4" fill="hsl(var(--chart-4))" name="Week 4" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Utilization Heatmap */}
        <Card className="airbus-card">
          <CardHeader>
            <CardTitle className="airbus-text-primary">Resource Utilization Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2 mb-4">
              <div className="font-medium text-sm">Team</div>
              <div className="text-center font-medium text-sm">Week 1</div>
              <div className="text-center font-medium text-sm">Week 2</div>
              <div className="text-center font-medium text-sm">Week 3</div>
              <div className="text-center font-medium text-sm">Week 4</div>
              
              {utilizationHeatmap.map((team, index) => (
                <React.Fragment key={index}>
                  <div className="font-medium text-sm">{team.team}</div>
                  <div className={`text-center p-2 rounded text-white text-sm ${
                    team.week1 > 100 ? 'bg-red-500' : 
                    team.week1 > 85 ? 'bg-orange-400' : 'bg-green-400'
                  }`}>
                    {team.week1}%
                  </div>
                  <div className={`text-center p-2 rounded text-white text-sm ${
                    team.week2 > 100 ? 'bg-red-500' : 
                    team.week2 > 85 ? 'bg-orange-400' : 'bg-green-400'
                  }`}>
                    {team.week2}%
                  </div>
                  <div className={`text-center p-2 rounded text-white text-sm ${
                    team.week3 > 100 ? 'bg-red-500' : 
                    team.week3 > 85 ? 'bg-orange-400' : 'bg-green-400'
                  }`}>
                    {team.week3}%
                  </div>
                  <div className={`text-center p-2 rounded text-white text-sm ${
                    team.week4 > 100 ? 'bg-red-500' : 
                    team.week4 > 85 ? 'bg-orange-400' : 'bg-green-400'
                  }`}>
                    {team.week4}%
                  </div>
                </React.Fragment>
              ))}
            </div>
            <div className="flex justify-center items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-400 rounded"></div>
                <span>Optimal (&lt;85%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-400 rounded"></div>
                <span>High (85-100%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Overallocated (&gt;100%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resource Assignments Table */}
        <Card className="airbus-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 airbus-text-primary">
              <Target className="h-5 w-5" />
              Resource Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Total Tasks</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>In Progress</TableHead>
                    <TableHead>Utilization</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utilization.slice(0, 10).map((resource: any, index: number) => (
                    <TableRow key={resource.user_id || index}>
                      <TableCell className="font-medium">{resource.name || `Resource ${index + 1}`}</TableCell>
                      <TableCell>{resource.role || 'Developer'}</TableCell>
                      <TableCell>{resource.team || 'Engineering'}</TableCell>
                      <TableCell>{resource.total_tasks || 0}</TableCell>
                      <TableCell className="text-green-600">{resource.completed_tasks || 0}</TableCell>
                      <TableCell className="text-blue-600">{resource.in_progress_tasks || 0}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-sm ${
                          (resource.utilization || 0) > 100 ? 'bg-red-100 text-red-800' :
                          (resource.utilization || 0) > 85 ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {resource.utilization || 75}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          (resource.utilization || 0) > 100 ? 'destructive' :
                          (resource.utilization || 0) > 85 ? 'secondary' :
                          'outline'
                        }>
                          {(resource.utilization || 0) > 100 ? 'Overallocated' :
                           (resource.utilization || 0) > 85 ? 'High Load' : 'Available'}
                        </Badge>
                      </TableCell>
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

export default ResourceDashboard;