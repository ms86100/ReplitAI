import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Calendar, Users, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';

interface Iteration {
  id: string;
  name: string;
  type: string;
  team_id: string;
  team_name?: string;
  start_date: string;
  end_date: string;
  weeks_count: number;
  hasRealIteration?: boolean;
  realIterationId?: string;
}

interface TeamMember {
  id: string;
  member_name: string;
  role?: string;
  email?: string;
}

interface Week {
  id: string;
  week_index: number;
  week_start: string;
  week_end: string;
}

interface WeeklyAvailability {
  id?: string;
  iteration_week_id: string;
  team_member_id: string;
  availability_percent: number;
  calculated_days_present: number;
  calculated_days_total: number;
}

interface AvailabilityViewProps {
  iteration: Iteration;
  onBack: () => void;
  onEdit: () => void;
}

export const AvailabilityView: React.FC<AvailabilityViewProps> = ({
  iteration,
  onBack,
  onEdit,
}) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [availability, setAvailability] = useState<Record<string, WeeklyAvailability>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [iteration.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (!iteration || !iteration.team_id) {
        toast({ title: 'Error', description: 'Invalid iteration data - no team assigned.', variant: 'destructive' });
        return;
      }

      // Fetch team members
      const membersResponse = await apiClient.getTeamMembers(iteration.team_id);
      if (membersResponse.success && membersResponse.data) {
        const teamMembers = membersResponse.data.filter(member => member.team_id === iteration.team_id || !member.team_id);
        setTeamMembers(teamMembers);
      } else {
        setTeamMembers([]);
      }

      // Generate weeks from iteration data
      if (iteration.weeks_count && iteration.start_date) {
        const generatedWeeks = generateWeeksFromIteration(iteration);
        setWeeks(generatedWeeks);
      }

      // Fetch saved weekly availability
      const iterationIdForApi = iteration.realIterationId || iteration.id;
      if (iterationIdForApi) {
        const waRes = await apiClient.getWeeklyAvailability(iterationIdForApi);
        if (waRes.success && Array.isArray(waRes.data)) {
          const map: Record<string, WeeklyAvailability> = {};
          waRes.data.forEach((row: any) => {
            const weekId = `week-${row.week_index}`;
            const key = getAvailabilityKey(row.team_member_id, weekId);
            map[key] = {
              iteration_week_id: weekId,
              team_member_id: row.team_member_id,
              availability_percent: row.availability_percent || 100,
              calculated_days_present: row.days_present || Math.round((row.availability_percent || 100) / 100 * 5),
              calculated_days_total: row.days_total || 5,
            } as WeeklyAvailability;
          });
          setAvailability(map);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load iteration data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const generateWeeksFromIteration = (iteration: Iteration): Week[] => {
    const weeks: Week[] = [];
    const startDate = new Date(iteration.start_date);
    
    for (let i = 0; i < iteration.weeks_count; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      weeks.push({
        id: `week-${i + 1}`,
        week_index: i + 1,
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0]
      });
    }
    
    return weeks;
  };

  const getAvailabilityKey = (memberId: string, weekId: string) => `${memberId}-${weekId}`;

  if (loading && teamMembers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{iteration.name} - Availability View</h1>
            <p className="text-muted-foreground">
              View weekly availability for team members
            </p>
          </div>
        </div>
        <Button onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Availability
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{iteration.weeks_count} Weeks</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(iteration.start_date).toLocaleDateString()} to {new Date(iteration.end_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{teamMembers.length} Members</div>
                <div className="text-sm text-muted-foreground">
                  Team: {iteration.team_name}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-2">Legend</div>
            <div className="space-y-1 text-sm">
              <div>% = Weekly availability</div>
              <div>Days = Present/Total days</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Availability</CardTitle>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No team members</h3>
              <p className="text-muted-foreground">
                No team members found for this iteration
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Team Member</TableHead>
                    {weeks.map((week) => (
                      <TableHead key={week.id} className="text-center min-w-32">
                        <div className="space-y-1">
                          <div className="font-medium">Week {week.week_index}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(week.week_start).toLocaleDateString()} - {new Date(week.week_end).toLocaleDateString()}
                          </div>
                        </div>
                      </TableHead>
                     ))}
                     <TableHead className="text-center min-w-32">
                       <div className="font-medium">Total</div>
                       <div className="text-xs text-muted-foreground">Avg %</div>
                     </TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {teamMembers.map((member) => {
                     // Calculate total availability for this member
                     const memberAvailabilities = weeks.map(week => {
                       const key = getAvailabilityKey(member.id, week.id);
                       return availability[key]?.availability_percent || 100;
                     });
                     const avgAvailability = memberAvailabilities.length > 0 
                       ? Math.round(memberAvailabilities.reduce((sum, val) => sum + val, 0) / memberAvailabilities.length)
                       : 100;
                     
                     return (
                   <TableRow key={member.id}>
                     <TableCell>
                       <div>
                         <div className="font-medium">{member.member_name || 'Unknown Member'}</div>
                         {member.role && (
                           <Badge variant="outline" className="text-xs mt-1">
                             {member.role}
                           </Badge>
                         )}
                         {member.email && (
                           <div className="text-xs text-muted-foreground mt-1">{member.email}</div>
                         )}
                       </div>
                     </TableCell>
                     {weeks.map((week) => {
                       const key = getAvailabilityKey(member.id, week.id);
                       const avail = availability[key];
                       const percent = avail?.availability_percent || 100;
                       
                        return (
                          <TableCell key={week.id} className="text-center">
                            <div className="space-y-1">
                              <div className="font-medium text-lg">{percent}%</div>
                              {avail?.calculated_days_present !== undefined && (
                                <div className="text-xs text-muted-foreground">
                                  {avail.calculated_days_present}/5 days
                                </div>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center bg-muted/30">
                        <div>
                          <div className="font-semibold text-lg">{avgAvailability}%</div>
                          <div className="text-xs text-muted-foreground">Average</div>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
               </TableBody>
             </Table>
           </div>
         )}
       </CardContent>
     </Card>
   </div>
 );
};