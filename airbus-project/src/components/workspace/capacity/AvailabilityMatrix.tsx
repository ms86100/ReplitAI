import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Calendar, Users, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { DailyAttendanceModal } from './DailyAttendanceModal';

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
  name?: string;
  display_name?: string;
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

interface AvailabilityMatrixProps {
  iteration: Iteration;
  onBack: () => void;
  onUpdate: () => void;
}

export const AvailabilityMatrix: React.FC<AvailabilityMatrixProps> = ({
  iteration,
  onBack,
  onUpdate,
}) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [availability, setAvailability] = useState<Record<string, WeeklyAvailability>>({});
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedMemberWeek, setSelectedMemberWeek] = useState<{
    memberId: string;
    weekId: string;
    availabilityId?: string;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    
    // Validate that we have required iteration data
    if (!iteration.team_id) {
      console.error('❌ No team_id found in iteration:', iteration);
      toast({
        title: 'Error',
        description: 'Invalid iteration data - no team assigned.',
        variant: 'destructive'
      });
      return;
    }

    fetchData();
  }, [iteration.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      

      if (!iteration || !iteration.team_id) {
        console.error('❌ No team_id found in iteration:', iteration);
        toast({ title: 'Error', description: 'Invalid iteration data - no team assigned.', variant: 'destructive' });
        return;
      }

      // Fetch team members for the specific team
      const membersResponse = await apiClient.getTeamMembers(iteration.team_id);

      if (membersResponse.success && membersResponse.data) {
        const teamMembers = membersResponse.data.filter(member => member.team_id === iteration.team_id || !member.team_id);
        
        setTeamMembers(teamMembers);
      } else {
        console.error('❌ Failed to fetch team members:', membersResponse.error);
        toast({ title: 'Error', description: `Failed to fetch team members: ${membersResponse.error}`, variant: 'destructive' });
        setTeamMembers([]);
      }

      // Fetch iteration weeks from backend to get real UUIDs
      const iterationIdForApi = iteration.realIterationId || iteration.id;
      let generatedWeeks: Week[] = [];

      try {
        const weeksRes = await apiClient.getIterationWeeks(iterationIdForApi);
        if (weeksRes.success && Array.isArray(weeksRes.data) && weeksRes.data.length > 0) {
          generatedWeeks = weeksRes.data.map((w: any) => ({
            id: w.id,
            week_index: w.week_index,
            week_start: w.week_start,
            week_end: w.week_end,
          }));
          setWeeks(generatedWeeks);
        } else if (iteration.weeks_count && iteration.start_date) {
          // Fallback to local generation (will not be used for saving if no UUIDs)
          generatedWeeks = generateWeeksFromIteration(iteration);
          setWeeks(generatedWeeks);
        }
      } catch (e) {
        console.error('❌ Failed to fetch iteration weeks, using local generation as fallback', e);
        if (iteration.weeks_count && iteration.start_date) {
          generatedWeeks = generateWeeksFromIteration(iteration);
          setWeeks(generatedWeeks);
        }
      }

      // Fetch saved weekly availability and prefill state
      if (iterationIdForApi) {
        const waRes = await apiClient.getWeeklyAvailability(iterationIdForApi);
        const map: Record<string, WeeklyAvailability> = {};

        if (waRes.success) {
          // Handle both legacy array and new structured response
          const availabilityRows = Array.isArray(waRes.data)
            ? (waRes.data as any[])
            : (((waRes.data as any)?.availability as any[]) || []);
          availabilityRows.forEach((row: any) => {
            // Prefer matching by iteration_week_id; fallback to week_index mapping
            const weekId = row.iteration_week_id || generatedWeeks.find(w => w.week_index === row.week_index)?.id;
            if (!weekId) return;
            const key = getAvailabilityKey(row.team_member_id, weekId);
            map[key] = {
              iteration_week_id: weekId,
              team_member_id: row.team_member_id,
              availability_percent: row.availability_percent || 100,
              calculated_days_present: row.calculated_days_present || Math.round((row.availability_percent || 100) / 100 * 5),
              calculated_days_total: row.calculated_days_total || 5,
            } as WeeklyAvailability;
          });
        }

        if (Object.keys(map).length > 0) {
          setAvailability(map);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load iteration data. Try again.', variant: 'destructive' });
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

  const updateAvailability = (memberId: string, weekId: string, percent: number) => {
    const key = getAvailabilityKey(memberId, weekId);
    const existing = availability[key];
    
    setAvailability(prev => ({
      ...prev,
      [key]: {
        ...existing,
        iteration_week_id: weekId,
        team_member_id: memberId,
        availability_percent: percent,
        calculated_days_present: Math.round((percent / 100) * 5),
        calculated_days_total: 5,
      }
    }));
  };

  const saveAvailability = async () => {
    // Allow saving when we have a real iteration id
    const isTemp = iteration.id?.startsWith('temp-');
    if ((isTemp || !iteration.id) && !iteration.realIterationId) {
      toast({
        title: 'Create Iteration Required',
        description: "This team needs a proper iteration to save availability data. Use 'Create Iteration' button first.",
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      // Ensure weeks have real UUIDs; otherwise saving will fail
      const hasInvalidWeekIds = weeks.some(w => !/^[0-9a-fA-F-]{36}$/.test(w.id));
      if (hasInvalidWeekIds) {
        toast({
          title: 'Setup Required',
          description: 'Iteration weeks are not set up in the backend. Please recreate the iteration or contact admin.',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }
      
      const availabilityList: any[] = [];
      const iterationIdForApi = iteration.realIterationId || iteration.id;

      // Build complete grid with defaults so backend always receives data
      teamMembers.forEach((member) => {
        weeks.forEach((week) => {
          const key = getAvailabilityKey(member.id, week.id);
          const percent = availability[key]?.availability_percent ?? 100;
          availabilityList.push({
            iteration_week_id: week.id,
            team_member_id: member.id,
            availability_percent: percent,
            calculated_days_present: Math.round((percent / 100) * 5),
            calculated_days_total: 5,
          });
        });
      });

      if (availabilityList.length === 0) {
        throw new Error('No availability to save (no team members or weeks)');
      }

      const response = await apiClient.saveWeeklyAvailability(iterationIdForApi, availabilityList);
      
      if (response.success) {
        toast({ title: 'Success', description: 'Availability updated successfully.' });
        // Redirect to analytics/main view after successful save
        setTimeout(() => {
          onUpdate();
        }, 1500);
      } else {
        throw new Error(response.error || 'Failed to save availability');
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to save availability. Try again.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const openDailyModal = (memberId: string, weekId: string) => {
    const key = getAvailabilityKey(memberId, weekId);
    const avail = availability[key];
    
    setSelectedMemberWeek({
      memberId,
      weekId,
      availabilityId: avail?.id,
    });
  };

  const handleDailyUpdate = (memberId: string, weekId: string, percent: number, daysPresent: number) => {
    updateAvailability(memberId, weekId, percent);
    setSelectedMemberWeek(null);
    
    // Force a refresh of the availability data to reflect the changes
    // This ensures the UI shows the updated percentages
    const key = getAvailabilityKey(memberId, weekId);
    const currentAvail = availability[key];
    
    // Update the availability with the new calculated values
    setAvailability(prev => ({
      ...prev,
      [key]: {
        ...currentAvail,
        availability_percent: percent,
        calculated_days_present: daysPresent,
        // Mark as updated so UI reflects the change
        updated_at: new Date().toISOString()
      }
    }));
  };

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
            <h1 className="text-2xl font-bold">{iteration.name} - Availability Matrix</h1>
            <p className="text-muted-foreground">
              Plan weekly availability for team members
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setEditMode(!editMode)}
          >
            <Users className="h-4 w-4 mr-2" />
            {editMode ? 'View Mode' : 'Edit Availability'}
          </Button>
          <Button onClick={saveAvailability} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Availability
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{iteration.weeks_count} Weeks</div>
                <div className="text-sm text-muted-foreground">
                  {iteration.start_date} to {iteration.end_date}
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
              <div>P = Present, A = Absent</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Availability Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No team members</h3>
              <p className="text-muted-foreground">
                Add team members to start planning availability
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
                          <div className="font-medium">{member.member_name || member.name || member.display_name || 'Unknown Member'}</div>
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
                             <div className="space-y-2">
                               {editMode ? (
                                 <>
                                   <Input
                                     key={`${member.id}-${week.id}-${percent}`}
                                     type="number"
                                     min="0"
                                     max="100"
                                     value={percent}
                                     onChange={(e) => updateAvailability(
                                       member.id, 
                                       week.id, 
                                       parseInt(e.target.value) || 0
                                     )}
                                     className="w-20 h-8 text-center"
                                   />
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     onClick={() => openDailyModal(member.id, week.id)}
                                     className="w-20 h-6 text-xs"
                                   >
                                     Daily
                                   </Button>
                                 </>
                               ) : (
                                 <div className="text-center">
                                   <div className="font-medium text-lg">{percent}%</div>
                                 </div>
                               )}
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

      {selectedMemberWeek && (
        <DailyAttendanceModal
          memberId={selectedMemberWeek.memberId}
          memberName={teamMembers.find(m => m.id === selectedMemberWeek.memberId)?.member_name || ''}
          weekId={selectedMemberWeek.weekId}
          week={weeks.find(w => w.id === selectedMemberWeek.weekId)}
          availabilityId={selectedMemberWeek.availabilityId}
          currentPercent={availability[getAvailabilityKey(selectedMemberWeek.memberId, selectedMemberWeek.weekId)]?.availability_percent || 100}
          onClose={() => setSelectedMemberWeek(null)}
          onUpdate={handleDailyUpdate}
        />
      )}
    </div>
  );
};