import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, Calendar, Target, AlertTriangle, Activity, Clock } from 'lucide-react';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
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

interface TeamMember {
  id: string;
  member_name: string;
  role?: string;
  email?: string;
}

interface WeeklyAvailability {
  team_member_id: string;
  availability_percent: number;
  calculated_days_present: number;
  calculated_days_total: number;
  week_index: number;
}

interface IterationData {
  id: string;
  name: string;
  team_name: string;
  weeks: WeekData[];
  total_capacity: number;
  avg_availability: number;
  total_members: number;
}

interface WeekData {
  week_index: number;
  week_start: string;
  week_end: string;
  members: MemberWeekData[];
  week_capacity: number;
  week_availability: number;
}

interface MemberWeekData {
  member_id: string;
  member_name: string;
  availability_percent: number;
  days_present: number;
  days_total: number;
}

interface EnhancedTeamCapacityAnalyticsProps {
  projectId: string;
  teams: Team[];
  iterations: Iteration[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

export const EnhancedTeamCapacityAnalytics: React.FC<EnhancedTeamCapacityAnalyticsProps> = ({
  projectId,
  teams,
  iterations,
}) => {
  const [selectedIteration, setSelectedIteration] = useState<string>('all');
  const [iterationData, setIterationData] = useState<IterationData[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (iterations.length > 0) {
      fetchIterationAnalytics();
    }
  }, [iterations]);

  const fetchIterationAnalytics = async () => {
    if (iterations.length === 0) {
      return;
    }

    try {
      setLoading(true);
      const analytics: IterationData[] = [];

      for (const iteration of iterations) {
        try {
          // Get team members for this iteration
          const membersResponse = await apiClient.getTeamMembers(iteration.team_id);
          const members = membersResponse.success ? membersResponse.data || [] : [];
          
          console.log('Team members response:', { teamId: iteration.team_id, members });

          // Get weekly availability data for this iteration
          // Weekly availability rows from API
          const availResp = await apiClient.getWeeklyAvailability(iteration.id);

          let weeks: WeekData[] = [];
          let totalCapacity = 0;
          let avgAvailability = 0;

          if (availResp.success && Array.isArray(availResp.data)) {
            const rows = availResp.data as any[];
            const maxWeek = rows.reduce((m, r) => Math.max(m, Number(r.week_index || 0)), 0) || iteration.weeks_count || 0;

            // Build week structure 1..maxWeek
            for (let i = 1; i <= maxWeek; i++) {
              const weekRows = rows.filter(r => Number(r.week_index) === i);
              const weekMembers: MemberWeekData[] = members.map(member => {
                const r = weekRows.find(w => w.team_member_id === member.id) || {};
                return {
                  member_id: member.id,
                  member_name: member.display_name || member.member_name || member.name || `Team Member ${members.indexOf(member) + 1}`,
                  availability_percent: Number(r.availability_percent ?? 100),
                  days_present: Number(r.days_present ?? 5),
                  days_total: Number(r.days_total ?? 5),
                };
              });

              const weekCapacity = weekMembers.reduce((sum, m) => sum + m.availability_percent, 0);
              const weekAvailability = weekMembers.length > 0 ? weekCapacity / weekMembers.length : 100;

              weeks.push({
                week_index: i,
                week_start: '',
                week_end: '',
                members: weekMembers,
                week_capacity: weekCapacity,
                week_availability: weekAvailability,
              });
            }

            totalCapacity = weeks.reduce((sum, week) => sum + week.week_capacity, 0);
            avgAvailability = weeks.length > 0 ? totalCapacity / (weeks.length * members.length) : 100;
          } else {
            // Generate default week structure if no data
            for (let i = 0; i < iteration.weeks_count; i++) {
              const startDate = new Date(iteration.start_date);
              startDate.setDate(startDate.getDate() + (i * 7));
              const endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + 6);

              const weekMembers: MemberWeekData[] = members.map(member => ({
                member_id: member.id,
                member_name: member.display_name || member.member_name || member.name || `Team Member ${members.indexOf(member) + 1}`,
                availability_percent: 100,
                days_present: 5,
                days_total: 5,
              }));

              weeks.push({
                week_index: i + 1,
                week_start: startDate.toISOString().split('T')[0],
                week_end: endDate.toISOString().split('T')[0],
                members: weekMembers,
                week_capacity: members.length * 100,
                week_availability: 100,
              });
            }

            totalCapacity = weeks.length * members.length * 100;
            avgAvailability = 100;
          }

          analytics.push({
            id: iteration.id,
            name: iteration.name,
            team_name: iteration.team_name || teams.find(t => t.id === iteration.team_id)?.name || 'Unknown Team',
            weeks,
            total_capacity: totalCapacity,
            avg_availability: avgAvailability,
            total_members: members.length,
          });

        } catch (error) {
          console.error(`Error fetching data for iteration ${iteration.id}:`, error);
          
          // Create fallback data structure
          const team = teams.find(t => t.id === iteration.team_id);
          const memberCount = team?.member_count || 0;
          
          analytics.push({
            id: iteration.id,
            name: iteration.name,
            team_name: iteration.team_name || team?.name || 'Unknown Team',
            weeks: [],
            total_capacity: 0,
            avg_availability: 0,
            total_members: memberCount,
          });
        }
      }

      setIterationData(analytics);
    } catch (error) {
      console.error('Error fetching iteration analytics:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to load capacity analytics', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on selected iteration
  const filteredData = selectedIteration === 'all' 
    ? iterationData 
    : iterationData.filter(iter => iter.id === selectedIteration);

  // Calculate overall metrics
  const overallMetrics = {
    totalIterations: iterationData.length,
    totalTeams: new Set(iterationData.map(iter => iter.team_name)).size,
    totalMembers: iterationData.reduce((sum, iter) => sum + iter.total_members, 0),
    avgCapacity: iterationData.length > 0 
      ? Math.round(iterationData.reduce((sum, iter) => sum + iter.avg_availability, 0) / iterationData.length)
      : 0,
    activeIterations: iterationData.filter(iter => iter.weeks.length > 0).length,
  };

  // Generate charts data with better fallback names
  const iterationComparison = iterationData.map((iter, index) => ({
    name: iter.name && iter.name.trim() !== '' ? iter.name : `Iteration ${index + 1}`,
    team: iter.team_name && iter.team_name.trim() !== '' ? iter.team_name : 'Unassigned Team',
    capacity: Math.round(iter.avg_availability),
    members: iter.total_members,
    weeks: iter.weeks.length,
  }));

  const weeklyTrends = filteredData.length > 0 && filteredData[0].weeks.length > 0
    ? filteredData[0].weeks.map(week => ({
        week: `Week ${week.week_index}`,
        availability: Math.round(week.week_availability),
        capacity: Math.round(week.week_capacity / Math.max(week.members.length, 1)),
        date: week.week_start,
      }))
    : [];

  const memberPerformance = filteredData.length > 0 && filteredData[0].weeks.length > 0
    ? filteredData[0].weeks[0].members.map(member => {
        const memberWeeks = filteredData[0].weeks.map(week => 
          week.members.find(m => m.member_id === member.member_id)
        ).filter(Boolean);
        
        const avgAvailability = memberWeeks.length > 0 
          ? memberWeeks.reduce((sum, m) => sum + (m?.availability_percent || 0), 0) / memberWeeks.length
          : 0;

        return {
          name: member.member_name || 'Unknown Member',
          availability: Math.round(avgAvailability),
          totalDays: memberWeeks.reduce((sum, m) => sum + (m?.days_total || 0), 0),
          presentDays: memberWeeks.reduce((sum, m) => sum + (m?.days_present || 0), 0),
        };
      })
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (iterationData.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Capacity Data Available</h3>
          <p className="text-muted-foreground">
            Team capacity analytics data is not available. Create iterations and set availability to view analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Capacity</p>
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
                <p className="text-sm font-medium text-muted-foreground">Active Iterations</p>
                <p className="text-2xl font-bold">{overallMetrics.activeIterations}</p>
                <p className="text-xs text-muted-foreground">of {overallMetrics.totalIterations} total</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
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
                <p className="text-sm font-medium text-muted-foreground">Teams</p>
                <p className="text-2xl font-bold">{overallMetrics.totalTeams}</p>
                <p className="text-xs text-muted-foreground">Active teams</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Planning Health</p>
                <p className="text-2xl font-bold">
                  {overallMetrics.activeIterations > 0 ? 'Good' : 'Low'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {overallMetrics.activeIterations > 0 ? 'Data available' : 'Needs planning'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Iteration Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Capacity Analytics</CardTitle>
            <Select value={selectedIteration} onValueChange={setSelectedIteration}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select iteration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Iterations</SelectItem>
                {iterationData.map(iter => (
                  <SelectItem key={iter.id} value={iter.id}>
                    {iter.name} - {iter.team_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="iterations">Iteration Comparison</TabsTrigger>
          <TabsTrigger value="trends">Weekly Trends</TabsTrigger>
          <TabsTrigger value="members">Member Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Iteration Capacity Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={iterationComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="capacity" fill="#8884d8" name="Avg Capacity %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                     <Pie
                       data={iterationComparison}
                       cx="50%"
                       cy="50%"
                       outerRadius={80}
                       fill="#8884d8"
                       dataKey="members"
                       label={({name, members}) => `${name}: ${members || 0}`}
                    >
                      {iterationComparison.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="iterations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Iteration Performance Table</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Iteration</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Weeks</TableHead>
                    <TableHead>Avg Capacity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {iterationData.map((iter) => (
                    <TableRow key={iter.id}>
                      <TableCell className="font-medium">{iter.name}</TableCell>
                      <TableCell>{iter.team_name}</TableCell>
                      <TableCell>{iter.total_members}</TableCell>
                      <TableCell>{iter.weeks.length}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{Math.round(iter.avg_availability)}%</span>
                          <Progress value={iter.avg_availability} className="w-16 h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={iter.avg_availability > 85 ? 'default' : 
                                  iter.avg_availability > 70 ? 'secondary' : 'destructive'}
                        >
                          {iter.avg_availability > 85 ? 'Optimal' : 
                           iter.avg_availability > 70 ? 'Good' : 'Needs Attention'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {weeklyTrends.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Weekly Capacity Trends
                  {selectedIteration !== 'all' && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      - {filteredData[0]?.name}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={weeklyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="availability" stroke="#8884d8" name="Availability %" />
                    <Line type="monotone" dataKey="capacity" stroke="#82ca9d" name="Capacity %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Trend Data</h3>
                <p className="text-muted-foreground">
                  {selectedIteration === 'all' 
                    ? 'Select a specific iteration to view weekly trends'
                    : 'No weekly data available for this iteration'
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          {memberPerformance.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Member Capacity Details
                  {selectedIteration !== 'all' && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      - {filteredData[0]?.name}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Name</TableHead>
                      <TableHead>Avg Availability</TableHead>
                      <TableHead>Present Days</TableHead>
                      <TableHead>Total Days</TableHead>
                      <TableHead>Attendance Rate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberPerformance.map((member) => {
                      const attendanceRate = member.totalDays > 0 
                        ? Math.round((member.presentDays / member.totalDays) * 100)
                        : 0;
                      
                      return (
                        <TableRow key={member.name}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{member.availability}%</span>
                              <Progress value={member.availability} className="w-16 h-2" />
                            </div>
                          </TableCell>
                          <TableCell>{member.presentDays}</TableCell>
                          <TableCell>{member.totalDays}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{attendanceRate}%</span>
                              <Progress value={attendanceRate} className="w-16 h-2" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={member.availability > 90 ? 'default' : 
                                      member.availability > 75 ? 'secondary' : 'destructive'}
                            >
                              {member.availability > 90 ? 'Excellent' : 
                               member.availability > 75 ? 'Good' : 'Needs Review'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Member Data</h3>
                <p className="text-muted-foreground">
                  {selectedIteration === 'all' 
                    ? 'Select a specific iteration to view member details'
                    : 'No member data available for this iteration'
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};