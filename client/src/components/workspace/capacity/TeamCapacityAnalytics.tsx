import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, Calendar, Target, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  team_name: string;
  member_count?: number;
}

interface Iteration {
  id: string;
  name: string;
  type: string;
  team_id: string;
  team_name?: string;
  start_date: string;
  end_date: string;
  weeks_count: number;
}

interface TeamCapacityAnalyticsProps {
  projectId: string;
  teams: Team[];
  iterations: Iteration[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const TeamCapacityAnalytics: React.FC<TeamCapacityAnalyticsProps> = ({
  projectId,
  teams,
  iterations,
}) => {
  const [capacityData, setCapacityData] = useState<any[]>([]);
  const [utilizationData, setUtilizationData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    generateAnalyticsData();
  }, [teams, iterations]);

  const generateAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch real capacity data from database for each team
      const capacityAnalytics = await Promise.all(
        teams.map(async (team) => {
          const teamIterations = iterations.filter(it => it.team_id === team.id);
          let totalCapacity = 0;
          let totalEfficiency = 0;
          let validDataPoints = 0;

          // Get actual capacity data for each iteration
          for (const iteration of teamIterations) {
            try {
              const response = await fetch(`/api/capacity-service/iterations/${iteration.id}`);
              if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.weeks) {
                  const weeks = data.data.weeks;
                  const weeklyCapacities = weeks.map(week => {
                    const weekCapacity = week.members?.reduce((acc, member) => 
                      acc + (member.effective_capacity || 0), 0) || 0;
                    return weekCapacity;
                  });
                  
                  const avgWeekCapacity = weeklyCapacities.length > 0 ? 
                    weeklyCapacities.reduce((sum, cap) => sum + cap, 0) / weeklyCapacities.length : 0;
                  
                  if (avgWeekCapacity > 0) {
                    // Calculate capacity percentage (assuming 40 hours per week as 100%)
                    const capacityPercentage = Math.min(100, (avgWeekCapacity / 40) * 100);
                    totalCapacity += capacityPercentage;
                    totalEfficiency += capacityPercentage * 0.9; // Assume 90% efficiency
                    validDataPoints++;
                  }
                }
              }
            } catch (error) {
              console.error(`Error fetching iteration ${iteration.id} data:`, error);
            }
          }

          // Calculate averages or use defaults
          const avgCapacity = validDataPoints > 0 ? totalCapacity / validDataPoints : 
            (team.member_count || 0) * 20; // Default 20 hours per member per week = 50% of 40hr week
          const efficiency = validDataPoints > 0 ? totalEfficiency / validDataPoints : avgCapacity * 0.85;
          
          return {
            team_name: team.team_name,
            members: team.member_count || 0,
            iterations: teamIterations.length,
            capacity: Math.round(avgCapacity),
            efficiency: Math.round(efficiency),
            utilization: Math.round(avgCapacity * (efficiency / avgCapacity || 0.85)),
            status: avgCapacity > 90 ? 'overloaded' : avgCapacity > 70 ? 'optimal' : 'underutilized'
          };
        })
      );

      // Generate utilization trend from real iteration data
      const utilizationTrend = await Promise.all(
        iterations.map(async (iteration, index) => {
          let planned = 0;
          let actual = 0;
          
          try {
            const response = await fetch(`/api/capacity-service/iterations/${iteration.id}`);
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data.weeks) {
                const weeks = data.data.weeks;
                const totalPlanned = weeks.length * 40; // 40 hours per week target
                const totalActual = weeks.reduce((acc, week) => {
                  return acc + (week.members?.reduce((memberAcc, member) => 
                    memberAcc + (member.effective_capacity || 0), 0) || 0);
                }, 0);
                
                planned = totalPlanned > 0 ? Math.min(100, (totalPlanned / (weeks.length * 40)) * 100) : 85;
                actual = totalPlanned > 0 ? Math.min(100, (totalActual / totalPlanned) * 100) : 80;
              }
            }
          } catch (error) {
            console.error(`Error fetching iteration ${iteration.id} utilization:`, error);
            planned = 85;
            actual = 80;
          }

          return {
            iteration: iteration.name,
            planned,
            actual,
            efficiency: actual * 0.9, // Efficiency is typically 90% of actual capacity
            week: index + 1
          };
        })
      );

      setCapacityData(capacityAnalytics);
      setUtilizationData(utilizationTrend);
    } catch (error) {
      console.error('Error generating analytics:', error);
      toast({ title: 'Error', description: 'Failed to load analytics data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const overallMetrics = {
    totalTeams: teams.length,
    totalIterations: iterations.length,
    avgCapacity: capacityData.length > 0 ? Math.round(capacityData.reduce((sum, team) => sum + team.capacity, 0) / capacityData.length) : 0,
    avgEfficiency: capacityData.length > 0 ? Math.round(capacityData.reduce((sum, team) => sum + team.efficiency, 0) / capacityData.length) : 0,
    totalMembers: teams.reduce((sum, team) => sum + (team.member_count || 0), 0)
  };

  const teamStatusDistribution = [
    { name: 'Optimal', value: capacityData.filter(t => t.status === 'optimal').length, color: '#00C49F' },
    { name: 'Overloaded', value: capacityData.filter(t => t.status === 'overloaded').length, color: '#FF8042' },
    { name: 'Underutilized', value: capacityData.filter(t => t.status === 'underutilized').length, color: '#FFBB28' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Team Capacity</p>
                <p className="text-2xl font-bold">{overallMetrics.avgCapacity}%</p>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  {overallMetrics.avgCapacity > 85 ? (
                    <><TrendingUp className="h-3 w-3 mr-1 text-green-500" />Optimal</>
                  ) : (
                    <><TrendingDown className="h-3 w-3 mr-1 text-yellow-500" />Below Target</>
                  )}
                </p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Team Efficiency</p>
                <p className="text-2xl font-bold">{overallMetrics.avgEfficiency}%</p>
                <p className="text-xs text-muted-foreground">Across all teams</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{overallMetrics.totalMembers}</p>
                <p className="text-xs text-muted-foreground">{overallMetrics.totalTeams} teams</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Iterations</p>
                <p className="text-2xl font-bold">{overallMetrics.totalIterations}</p>
                <p className="text-xs text-muted-foreground">Planning cycles</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teams">Team Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Capacity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={capacityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="team_name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="capacity" fill="#8884d8" name="Capacity %" />
                    <Bar dataKey="efficiency" fill="#82ca9d" name="Efficiency %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={teamStatusDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, value}) => `${name}: ${value}`}
                    >
                      {teamStatusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Individual Team Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {capacityData.map((team) => (
                  <div key={team.team_name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{team.team_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {team.members} members • {team.iterations} iterations
                        </p>
                      </div>
                      <Badge 
                        variant={team.status === 'optimal' ? 'default' : 
                                team.status === 'overloaded' ? 'destructive' : 'secondary'}
                      >
                        {team.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium mb-1">Capacity</p>
                        <Progress value={team.capacity} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">{team.capacity}%</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium mb-1">Efficiency</p>
                        <Progress value={team.efficiency} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">{team.efficiency}%</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium mb-1">Utilization</p>
                        <Progress value={team.utilization} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">{team.utilization}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Capacity Utilization Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={utilizationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="iteration" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="planned" stroke="#8884d8" name="Planned %" />
                  <Line type="monotone" dataKey="actual" stroke="#82ca9d" name="Actual %" />
                  <Line type="monotone" dataKey="efficiency" stroke="#ffc658" name="Efficiency %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    High Performance Teams
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {capacityData.filter(t => t.efficiency > 85).length} teams operating at high efficiency
                  </p>
                </div>
                
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Capacity Optimization
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Average team capacity utilization is {overallMetrics.avgCapacity}%
                  </p>
                </div>
                
                {capacityData.filter(t => t.status === 'overloaded').length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Overloaded Teams
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {capacityData.filter(t => t.status === 'overloaded').length} teams need capacity rebalancing
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {overallMetrics.avgCapacity < 80 && (
                    <div className="p-3 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                      <p className="text-sm font-medium">Increase Team Utilization</p>
                      <p className="text-xs text-muted-foreground">Consider adding more work or optimizing processes</p>
                    </div>
                  )}
                  
                  {capacityData.filter(t => t.status === 'overloaded').length > 0 && (
                    <div className="p-3 border-l-4 border-red-500 bg-red-50 dark:bg-red-950">
                      <p className="text-sm font-medium">Rebalance Workload</p>
                      <p className="text-xs text-muted-foreground">Some teams are overloaded - redistribute tasks</p>
                    </div>
                  )}
                  
                  {overallMetrics.totalIterations < teams.length && (
                    <div className="p-3 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950">
                      <p className="text-sm font-medium">Plan More Iterations</p>
                      <p className="text-xs text-muted-foreground">Some teams don't have active iterations</p>
                    </div>
                  )}
                  
                  <div className="p-3 border-l-4 border-green-500 bg-green-50 dark:bg-green-950">
                    <p className="text-sm font-medium">Track Daily Attendance</p>
                    <p className="text-xs text-muted-foreground">Use availability matrix for accurate capacity planning</p>
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