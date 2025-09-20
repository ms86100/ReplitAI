import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { User, CheckCircle, Clock, AlertTriangle, Calendar, Send } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiClient } from '@/services/api';

const KPICard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, subtitle, icon, color }) => {
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

const MyWork = () => {
  const { data: myTasksData, isLoading } = useQuery({
    queryKey: ['me', 'tasks', 'summary'],
    queryFn: () => apiClient.getMyTasksSummary(),
  });

  const { data: tasksListData } = useQuery({
    queryKey: ['me', 'tasks'],
    queryFn: () => apiClient.getMyTasks(),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading your work dashboard...</div>
        </div>
      </DashboardLayout>
    );
  }

  const myTasks = myTasksData?.data || {};
  const tasksList = tasksListData?.data || [];

  // Task status distribution
  const statusData = [
    { name: 'Completed', value: myTasks.completedTasks || 0, fill: 'hsl(var(--chart-2))' },
    { name: 'In Progress', value: myTasks.inProgressTasks || 0, fill: 'hsl(var(--chart-1))' },
    { name: 'Pending', value: myTasks.pendingTasks || 0, fill: 'hsl(var(--chart-3))' },
    { name: 'At Risk', value: myTasks.atRiskTasks || 0, fill: 'hsl(var(--destructive))' }
  ];

  // Tasks by project
  const projectData = [
    { project: 'A350 Enhancement', tasks: 12, completed: 8 },
    { project: 'A320 Maintenance', tasks: 8, completed: 6 },
    { project: 'Digital Twin', tasks: 6, completed: 2 },
    { project: 'Sustainability', tasks: 4, completed: 4 }
  ];

  // Calculate overdue tasks
  const overdueTasks = tasksList.filter((task: any) => 
    task.due_date && 
    new Date(task.due_date) < new Date() && 
    task.status?.toLowerCase() !== 'completed'
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold airbus-text-primary">My Work</h1>
            <p className="text-muted-foreground">Personal task dashboard and workload overview</p>
          </div>
          <Badge variant="outline" className="airbus-text-accent">
            {myTasks.assignedTasks || 0} Assigned Tasks
          </Badge>
        </div>

        {/* KPI Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Assigned Tasks"
            value={myTasks.assignedTasks || 0}
            icon={<User className="h-6 w-6 text-white" />}
            color="bg-blue-500"
          />
          <KPICard
            title="Completed Tasks"
            value={myTasks.completedTasks || 0}
            subtitle="This month"
            icon={<CheckCircle className="h-6 w-6 text-white" />}
            color="bg-green-500"
          />
          <KPICard
            title="In Progress"
            value={myTasks.inProgressTasks || 0}
            subtitle="Currently working"
            icon={<Clock className="h-6 w-6 text-white" />}
            color="bg-orange-500"
          />
          <KPICard
            title="Overdue Tasks"
            value={overdueTasks.length}
            subtitle="Need attention"
            icon={<AlertTriangle className="h-6 w-6 text-white" />}
            color="bg-red-500"
          />
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Task Status Distribution */}
          <Card className="airbus-card">
            <CardHeader>
              <CardTitle className="airbus-text-primary">My Task Status</CardTitle>
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

          {/* Tasks by Project */}
          <Card className="airbus-card">
            <CardHeader>
              <CardTitle className="airbus-text-primary">Tasks by Project</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="project" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill="hsl(var(--chart-2))" name="Completed" />
                  <Bar dataKey="tasks" fill="hsl(var(--chart-1))" name="Total" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* My Tasks Table */}
        <Card className="airbus-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 airbus-text-primary">
              <Calendar className="h-5 w-5" />
              My Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasksList.slice(0, 10).map((task: any, index: number) => {
                    const isOverdue = task.due_date && 
                      new Date(task.due_date) < new Date() && 
                      task.status?.toLowerCase() !== 'completed';
                    
                    return (
                      <TableRow key={task.id || index}>
                        <TableCell>
                          <Badge variant={
                            task.priority?.toLowerCase() === 'critical' ? 'destructive' :
                            task.priority?.toLowerCase() === 'high' ? 'secondary' :
                            'outline'
                          }>
                            {task.priority || 'Medium'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>{task.project_name || 'Project'}</TableCell>
                        <TableCell>
                          <Badge variant={
                            task.status === 'completed' ? 'default' :
                            task.status === 'in_progress' ? 'secondary' :
                            'outline'
                          }>
                            {task.status?.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                          {isOverdue && <span className="ml-1">⚠️</span>}
                        </TableCell>
                        <TableCell>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${isOverdue ? 'bg-red-500' : 'airbus-gradient'}`}
                              style={{ width: `${task.progress || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-muted-foreground">{task.progress || 0}%</span>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm"
                            variant="outline"
                            data-testid={`button-update-${task.id}`}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Update
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MyWork;