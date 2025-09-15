import React, { useState, useEffect } from 'react';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, Users, Calendar, TrendingUp, TrendingDown, Settings, Eye, BarChart3, Copy } from 'lucide-react';
import { format, differenceInDays, eachDayOfInterval, isWeekend } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';

interface CapacitySettings {
  workModeWeights: {
    office: number;
    wfh: number;
    hybrid: number;
  };
  defaultWorkingDays: number;
  defaultAvailability: number;
}

interface CapacityIteration {
  id: string;
  project_id: string;
  iteration_name: string;
  start_date: string;
  end_date: string;
  working_days: number;
  committed_story_points: number;
  created_at: string;
  members: CapacityMember[];
  totalEffectiveCapacity: number;
  totalMembers: number;
}

interface CapacityMember {
  id: string;
  iteration_id: string;
  stakeholder_id: string | null;
  team_id: string | null;
  member_name: string;
  role: string;
  work_mode: string;
  leaves: number;
  availability_percent: number;
  effective_capacity_days: number;
}

interface Stakeholder {
  id: string;
  name: string;
  email?: string;
  department?: string;
}

interface Team {
  id: string;
  project_id: string;
  team_name: string;
  description: string;
  created_at: string;
  members: TeamMember[];
}

interface TeamMember {
  id: string;
  team_id: string;
  member_name: string;
  role: string;
  work_mode: string;
  default_availability_percent: number;
  stakeholder_id: string | null;
}

interface CapacityAnalytics {
  project_id: string;
  iteration_id?: string;
  team_id?: string;
  total_capacity_days: number;
  allocated_capacity_days: number;
  utilization_percentage: number;
  velocity_points: number;
  team_size: number;
  avg_member_capacity: number;
  work_mode_distribution: {
    office: number;
    wfh: number;
    hybrid: number;
  };
}

interface TeamCapacityTrackerProps {
  projectId: string;
}

export function TeamCapacityTracker({ projectId }: TeamCapacityTrackerProps) {
  const { user, session } = useApiAuth();
  const { toast } = useToast();

  // Helper function to get authorization token
  const getAuthToken = () => {
    if (session?.access_token) {
      return session.access_token;
    }
    // Fallback for localStorage token (for localhost/cloud compatibility)
    const storedSession = localStorage.getItem('auth_session');
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        return parsed.access_token || parsed;
      } catch {
        return storedSession;
      }
    }
    return '';
  };
  
  const [settings, setSettings] = useState<CapacitySettings | null>(null);
  const [iterations, setIterations] = useState<CapacityIteration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [analytics, setAnalytics] = useState<CapacityAnalytics[]>([]);
  const [selectedIteration, setSelectedIteration] = useState<CapacityIteration | null>(null);
  const [viewingIteration, setViewingIteration] = useState<CapacityIteration | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIterationDialog, setShowIterationDialog] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [editingIteration, setEditingIteration] = useState<CapacityIteration | null>(null);
  
  // Form state for iteration
  const [iterationForm, setIterationForm] = useState({
    iteration_name: '',
    start_date: '',
    end_date: '',
    working_days: 0,
    committed_story_points: 0
  });
  
  // Form state for member
  const [memberForm, setMemberForm] = useState({
    iteration_id: '',
    member_name: '',
    role: '',
    work_mode: 'office',
    leaves: 0,
    availability_percent: 100,
    stakeholder_id: 'none',
    team_id: 'none'
  });

  // Form state for team
  const [teamForm, setTeamForm] = useState({
    team_name: '',
    description: '',
    members: [] as TeamMember[]
  });

  useEffect(() => {
    if (projectId) {
      fetchSettings();
      fetchCapacityData();
      fetchStakeholders();
      fetchTeams();
      fetchAnalytics();
    }
  }, [projectId]);

  const fetchSettings = async () => {
    try {
      const response = await apiClient.getCapacitySettings(projectId);
      
      if (response.success) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchCapacityData = async () => {
    try {
      const response = await apiClient.getCapacityData(projectId);
      
      if (response.success) {
        setIterations(response.data.iterations || []);
        
      }
    } catch (error) {
      console.error('Error fetching capacity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStakeholders = async () => {
    try {
      const response = await apiClient.getStakeholders(projectId);
      if (response.success) {
        setStakeholders(response.data.stakeholders || []);
      }
    } catch (error) {
      console.error('Error fetching stakeholders:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await apiClient.getTeams(projectId);
      if (response.success) {
        setTeams(response.data || []);
      } else {
        setTeams([]);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Fetch real analytics data from the database
      const analyticsData: CapacityAnalytics[] = [];
      
      for (const iteration of iterations) {
        try {
          const response = await fetch(`/api/capacity-service/iterations/${iteration.id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.weeks) {
              const weeks = data.data.weeks;
              const totalCapacity = weeks.reduce((acc, week) => {
                return acc + (week.members?.reduce((memberAcc, member) => 
                  memberAcc + (member.effective_capacity || 0), 0) || 0);
              }, 0);
              
              const analytics: CapacityAnalytics = {
                project_id: projectId,
                iteration_id: iteration.id,
                total_capacity_days: totalCapacity,
                allocated_capacity_days: iteration.committed_story_points || 0,
                utilization_percentage: totalCapacity > 0 
                  ? Math.min(100, ((iteration.committed_story_points || 0) / totalCapacity) * 100)
                  : 0,
                velocity_points: iteration.committed_story_points || 0,
                team_size: weeks[0]?.members?.length || 0,
                avg_member_capacity: weeks[0]?.members?.length > 0 ? 
                  totalCapacity / weeks[0].members.length : 0,
                work_mode_distribution: {
                  office: weeks[0]?.members?.filter(m => m.work_mode === 'office').length || 0,
                  wfh: weeks[0]?.members?.filter(m => m.work_mode === 'wfh').length || 0,
                  hybrid: weeks[0]?.members?.filter(m => m.work_mode === 'hybrid').length || 0
                }
              };
              
              analyticsData.push(analytics);
            }
          }
        } catch (iterationError) {
          console.error(`Error fetching analytics for iteration ${iteration.id}:`, iterationError);
        }
      }
      
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics([]);
    }
  };

  const generateAnalytics = async () => {
    try {
      // Generate real analytics based on database data
      const realAnalytics: CapacityAnalytics[] = [];
      
      for (const iteration of iterations) {
        try {
          const response = await fetch(`/api/capacity-service/iterations/${iteration.id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.weeks) {
              const weeks = data.data.weeks;
              const totalCapacity = weeks.reduce((acc, week) => {
                return acc + (week.members?.reduce((memberAcc, member) => 
                  memberAcc + (member.effective_capacity || 0), 0) || 0);
              }, 0);
              
              const members = weeks[0]?.members || [];
              const analytics: CapacityAnalytics = {
                project_id: projectId,
                iteration_id: iteration.id,
                total_capacity_days: totalCapacity,
                allocated_capacity_days: iteration.committed_story_points || 0,
                utilization_percentage: totalCapacity > 0 
                  ? Math.min(100, ((iteration.committed_story_points || 0) / totalCapacity) * 100)
                  : 0,
                velocity_points: iteration.committed_story_points || 0,
                team_size: members.length,
                avg_member_capacity: members.length > 0 ? totalCapacity / members.length : 0,
                work_mode_distribution: {
                  office: members.filter(m => m.work_mode === 'office').length,
                  wfh: members.filter(m => m.work_mode === 'wfh').length,
                  hybrid: members.filter(m => m.work_mode === 'hybrid').length
                }
              };
              
              realAnalytics.push(analytics);
            }
          } else {
            // Fallback to iteration data if API fails
            const fallbackAnalytics: CapacityAnalytics = {
              project_id: projectId,
              iteration_id: iteration.id,
              total_capacity_days: iteration.totalEffectiveCapacity || 0,
              allocated_capacity_days: iteration.committed_story_points || 0,
              utilization_percentage: iteration.totalEffectiveCapacity > 0 
                ? ((iteration.committed_story_points || 0) / iteration.totalEffectiveCapacity) * 100 
                : 0,
              velocity_points: iteration.committed_story_points || 0,
              team_size: iteration.totalMembers || 0,
              avg_member_capacity: iteration.totalMembers > 0 
                ? (iteration.totalEffectiveCapacity || 0) / iteration.totalMembers 
                : 0,
              work_mode_distribution: {
                office: iteration.members?.filter(m => m.work_mode === 'office').length || 0,
                wfh: iteration.members?.filter(m => m.work_mode === 'wfh').length || 0,
                hybrid: iteration.members?.filter(m => m.work_mode === 'hybrid').length || 0
              }
            };
            
            realAnalytics.push(fallbackAnalytics);
          }
        } catch (iterationError) {
          console.error(`Error generating analytics for iteration ${iteration.id}:`, iterationError);
        }
      }

      setAnalytics(realAnalytics);
      toast({
        title: "Analytics Updated",
        description: "Capacity analytics have been refreshed.",
      });
    } catch (error) {
      console.error('Error generating analytics:', error);
    }
  };

  const createTeam = async (teamData: typeof teamForm) => {
    try {
      // Create mock team for now
      const newTeam: Team = {
        id: `team-${Date.now()}`,
        project_id: projectId,
        team_name: teamData.team_name,
        description: teamData.description,
        created_at: new Date().toISOString(),
        members: (teamData.members || []).map(member => ({
          ...member,
          id: `member-${Date.now()}-${Math.random()}`,
          team_id: `team-${Date.now()}`
        }))
      };

      setTeams(prev => [...prev, newTeam]);
      toast({
        title: "Team Created",
        description: `Team "${teamData.team_name}" has been created successfully.`,
      });
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: "Error",
        description: "Failed to create team. Please try again.",
        variant: "destructive"
      });
    }
  };

  const addTeamToIteration = async (teamId: string, iterationId: string) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      // Add all team members to the iteration
      for (const member of (team.members || [])) {
        await handleMemberSubmit(null, {
          iteration_id: iterationId,
          member_name: member.member_name,
          role: member.role,
          work_mode: member.work_mode,
          leaves: 0, // Default leaves for team members
          availability_percent: member.default_availability_percent || 100,
          stakeholder_id: member.stakeholder_id || 'none',
          team_id: teamId
        });
      }

      toast({
        title: "Team Added",
        description: `Team "${team.team_name}" has been added to the iteration.`,
      });
    } catch (error) {
      console.error('Error adding team to iteration:', error);
      toast({
        title: "Error",
        description: "Failed to add team to iteration.",
        variant: "destructive"
      });
    }
  };

  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = eachDayOfInterval({ start, end });
    
    return days.filter(day => !isWeekend(day)).length;
  };

  // Update working days when dates change
  useEffect(() => {
    if (iterationForm.start_date && iterationForm.end_date) {
      const workingDays = calculateWorkingDays(iterationForm.start_date, iterationForm.end_date);
      setIterationForm(prev => ({ ...prev, working_days: workingDays }));
    }
  }, [iterationForm.start_date, iterationForm.end_date]);

  const handleIterationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const requestData = {
        type: 'iteration' as const,
        iterationName: iterationForm.iteration_name,
        startDate: iterationForm.start_date,
        endDate: iterationForm.end_date,
        workingDays: iterationForm.working_days,
        committedStoryPoints: iterationForm.committed_story_points
      };

      

      let response;
      if (editingIteration) {
        response = await apiClient.updateCapacityIteration(projectId, editingIteration.id, requestData);
      } else {
        response = await apiClient.createCapacityIteration(projectId, requestData);
      }
      
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create iteration');
      }

      toast({
        title: editingIteration ? "Iteration Updated" : "Iteration Created",
        description: `Iteration "${iterationForm.iteration_name}" has been ${editingIteration ? 'updated' : 'created'} successfully.`,
      });

      resetIterationForm();
      setShowIterationDialog(false);
      setEditingIteration(null);
      await fetchCapacityData();
    } catch (error) {
      console.error('Error creating/updating iteration:', error);
      toast({
        title: "Error",
        description: `Failed to ${editingIteration ? 'update' : 'create'} iteration: ${error}`,
        variant: "destructive"
      });
    }
  };

  const handleMemberSubmit = async (e: React.FormEvent | null, memberData?: typeof memberForm) => {
    if (e) e.preventDefault();
    
    const formData = memberData || memberForm;
    
    try {
      const requestData = {
        type: 'member' as const,
        iterationId: formData.iteration_id,
        memberName: formData.member_name,
        role: formData.role,
        workMode: formData.work_mode,
        availabilityPercent: formData.availability_percent,
        leaves: formData.leaves,
        stakeholderId: formData.stakeholder_id === 'none' ? null : formData.stakeholder_id,
        teamId: formData.team_id === 'none' ? null : formData.team_id
      };

      

      const response = await apiClient.addCapacityMember(projectId, requestData);
      
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create capacity item');
      }

      if (!memberData) {
        toast({
          title: "Member Added",
          description: `Team member "${formData.member_name}" has been added successfully.`,
        });

        resetMemberForm();
        setShowMemberDialog(false);
      }
      
      await fetchCapacityData();
    } catch (error) {
      console.error('Error adding member:', error);
      toast({
        title: "Error",
        description: `Failed to add team member: ${error}`,
        variant: "destructive"
      });
    }
  };

  const handleDeleteIteration = async (iterationId: string) => {
    try {
      const response = await fetch(`https://knivoexfpvqohsvpsziq.supabase.co/functions/v1/capacity-service/projects/${projectId}/capacity/${iterationId}?type=iteration`, {
        method: 'DELETE',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuaXZvZXhmcHZxb2hzdnBzemlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMjgyOTgsImV4cCI6MjA3MTgwNDI5OH0.TfV3FF9FNYXVv_f5TTgne4-CrDWmN1xOed2ZIjzn96Q',
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete iteration');
      }

      toast({
        title: "Iteration Deleted",
        description: "The iteration and all its capacity data have been deleted.",
      });
      
      await fetchCapacityData();
    } catch (error) {
      console.error('Error deleting iteration:', error);
      toast({
        title: "Error",
        description: `Failed to delete iteration: ${error}`,
        variant: "destructive"
      });
    }
  };

  const resetIterationForm = () => {
    setIterationForm({
      iteration_name: '',
      start_date: '',
      end_date: '',
      working_days: 0,
      committed_story_points: 0
    });
  };

  const resetMemberForm = () => {
    setMemberForm({
      iteration_id: '',
      member_name: '',
      role: '',
      work_mode: 'office',
      leaves: 0,
      availability_percent: 100,
      stakeholder_id: 'none',
      team_id: 'none'
    });
  };

  const resetTeamForm = () => {
    setTeamForm({
      team_name: '',
      description: '',
      members: []
    });
  };

  const openEditIteration = (iteration: CapacityIteration) => {
    setEditingIteration(iteration);
    setIterationForm({
      iteration_name: iteration.iteration_name,
      start_date: iteration.start_date,
      end_date: iteration.end_date,
      working_days: iteration.working_days,
      committed_story_points: iteration.committed_story_points
    });
    setShowIterationDialog(true);
  };

  const openViewIteration = (iteration: CapacityIteration) => {
    setViewingIteration(iteration);
    setShowViewDialog(true);
  };

  const openAddMember = (iterationId: string) => {
    setMemberForm(prev => ({ ...prev, iteration_id: iterationId }));
    setShowMemberDialog(true);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const token = getAuthToken();
    if (!token) {
      toast({
        title: "Authentication Error", 
        description: "Please log in again to continue",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const requestData = {
        team_name: teamForm.team_name,
        description: teamForm.description,
        members: teamForm.members
      };

      const response = await fetch(`https://knivoexfpvqohsvpsziq.supabase.co/functions/v1/capacity-service/projects/${projectId}/teams`, {
        method: 'POST',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuaXZvZXhmcHZxb2hzdnBzemlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMjgyOTgsImV4cCI6MjA3MVgwNDI5OH0.TfV3FF9FNYXVv_f5TTgne4-CrDWmN1xOed2ZIjzn96Q',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create team');
      }

      toast({
        title: "Team Created",
        description: `Team "${teamForm.team_name}" has been created successfully.`,
      });
      
      setTeamForm({
        team_name: '',
        description: '',
        members: []
      });
      setShowTeamDialog(false);
      await fetchTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: "Error",
        description: `Failed to create team: ${error}`,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Analytics */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Capacity Tracker</h2>
          <p className="text-muted-foreground">
            Plan and track team capacity across iterations with advanced analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateAnalytics}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Refresh Analytics
          </Button>
          <Button variant="outline" onClick={() => {
            resetTeamForm();
            setShowTeamDialog(true);
          }}>
            <Users className="h-4 w-4 mr-2" />
            Create Team
          </Button>
          <Button onClick={() => {
            resetIterationForm();
            setEditingIteration(null);
            setShowIterationDialog(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            New Iteration
          </Button>

          {/* Iteration Dialog */}
          <Dialog open={showIterationDialog} onOpenChange={setShowIterationDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingIteration ? 'Edit Iteration' : 'Create New Iteration'}
                </DialogTitle>
                <DialogDescription>
                  {editingIteration 
                    ? 'Update the iteration details below.' 
                    : 'Set up a new iteration for capacity planning.'
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleIterationSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="iteration_name">Iteration Name</Label>
                  <Input
                    id="iteration_name"
                    value={iterationForm.iteration_name}
                    onChange={(e) => setIterationForm(prev => ({ ...prev, iteration_name: e.target.value }))}
                    placeholder="e.g., Sprint 1, Q1 Iteration"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={iterationForm.start_date}
                      onChange={(e) => setIterationForm(prev => ({ ...prev, start_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={iterationForm.end_date}
                      onChange={(e) => setIterationForm(prev => ({ ...prev, end_date: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="working_days">Working Days (Auto-calculated)</Label>
                    <Input
                      id="working_days"
                      type="number"
                      value={iterationForm.working_days.toString()}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                      title="Automatically calculated based on start and end dates (excluding weekends)"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Excludes weekends (Sat & Sun)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="committed_story_points">Story Points</Label>
                    <Input
                      id="committed_story_points"
                      type="number"
                      value={iterationForm.committed_story_points}
                      onChange={(e) => setIterationForm(prev => ({ ...prev, committed_story_points: parseInt(e.target.value) || 0 }))}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowIterationDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingIteration ? 'Update Iteration' : 'Create Iteration'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Member Dialog */}
          <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Add a team member to the selected iteration for capacity planning.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleMemberSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="member_name">Member Name</Label>
                  <Input
                    id="member_name"
                    value={memberForm.member_name}
                    onChange={(e) => setMemberForm(prev => ({ ...prev, member_name: e.target.value }))}
                    placeholder="Enter team member name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={memberForm.role}
                    onChange={(e) => setMemberForm(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g., Developer, Tester, Designer"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="work_mode">Work Mode</Label>
                  <Select 
                    value={memberForm.work_mode} 
                    onValueChange={(value) => setMemberForm(prev => ({ ...prev, work_mode: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select work mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office">Office</SelectItem>
                      <SelectItem value="wfh">Work from Home</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="leaves">Planned Leaves (days)</Label>
                    <Input
                      id="leaves"
                      type="number"
                      value={memberForm.leaves}
                      onChange={(e) => setMemberForm(prev => ({ ...prev, leaves: parseInt(e.target.value) || 0 }))}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="availability_percent">Availability %</Label>
                    <Input
                      id="availability_percent"
                      type="number"
                      value={memberForm.availability_percent}
                      onChange={(e) => setMemberForm(prev => ({ ...prev, availability_percent: parseInt(e.target.value) || 100 }))}
                      min="0"
                      max="100"
                      placeholder="100"
                    />
                  </div>
                </div>
                {teams.length > 0 && (
                  <div>
                    <Label htmlFor="team_id">Link to Team (Optional)</Label>
                    <Select 
                      value={memberForm.team_id} 
                      onValueChange={(value) => setMemberForm(prev => ({ ...prev, team_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {teams.map(team => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.team_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {stakeholders.length > 0 && (
                  <div>
                    <Label htmlFor="stakeholder_id">Link to Stakeholder (Optional)</Label>
                    <Select 
                      value={memberForm.stakeholder_id} 
                      onValueChange={(value) => setMemberForm(prev => ({ ...prev, stakeholder_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select stakeholder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {stakeholders.map(stakeholder => (
                          <SelectItem key={stakeholder.id} value={stakeholder.id}>
                            {stakeholder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowMemberDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Add Member
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Team Dialog */}
          <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Reusable Team</DialogTitle>
                <DialogDescription>
                  Create a team template that can be reused across multiple iterations.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="team_name">Team Name</Label>
                  <Input
                    id="team_name"
                    value={teamForm.team_name}
                    onChange={(e) => setTeamForm(prev => ({ ...prev, team_name: e.target.value }))}
                    placeholder="e.g., Backend Team, Frontend Squad"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="team_description">Description</Label>
                  <Textarea
                    id="team_description"
                    value={teamForm.description}
                    onChange={(e) => setTeamForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the team's role and responsibilities"
                  />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Team Members</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setTeamForm(prev => ({
                        ...prev,
                        members: [...prev.members, {
                          id: `temp-${Date.now()}`,
                          team_id: '',
                          member_name: '',
                          role: '',
                          work_mode: 'office',
                          default_availability_percent: 100,
                          stakeholder_id: null
                        }]
                      }))}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Member
                    </Button>
                  </div>
                  
                  {(teamForm.members || []).map((member, index) => (
                    <Card key={member.id} className="p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Name</Label>
                          <Input
                            value={member.member_name}
                            onChange={(e) => {
                              const newMembers = [...(teamForm.members || [])];
                              newMembers[index].member_name = e.target.value;
                              setTeamForm(prev => ({ ...prev, members: newMembers }));
                            }}
                            placeholder="Member name"
                          />
                        </div>
                        <div>
                          <Label>Role</Label>
                          <Input
                            value={member.role}
                            onChange={(e) => {
                              const newMembers = [...(teamForm.members || [])];
                              newMembers[index].role = e.target.value;
                              setTeamForm(prev => ({ ...prev, members: newMembers }));
                            }}
                            placeholder="e.g., Developer, Tester"
                          />
                        </div>
                        <div>
                          <Label>Work Mode</Label>
                          <Select 
                            value={member.work_mode} 
                            onValueChange={(value) => {
                              const newMembers = [...(teamForm.members || [])];
                              newMembers[index].work_mode = value;
                              setTeamForm(prev => ({ ...prev, members: newMembers }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="office">Office</SelectItem>
                              <SelectItem value="wfh">Work from Home</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label>Default Availability %</Label>
                            <Input
                              type="number"
                              value={member.default_availability_percent}
                              onChange={(e) => {
                                const newMembers = [...(teamForm.members || [])];
                                newMembers[index].default_availability_percent = parseInt(e.target.value) || 100;
                                setTeamForm(prev => ({ ...prev, members: newMembers }));
                              }}
                              min="0"
                              max="100"
                            />
                          </div>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const newMembers = (teamForm.members || []).filter((_, i) => i !== index);
                              setTeamForm(prev => ({ ...prev, members: newMembers }));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowTeamDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="button"
                    onClick={async () => {
                      await createTeam(teamForm);
                      setShowTeamDialog(false);
                      resetTeamForm();
                    }}
                  >
                    Create Team
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* View Iteration Dialog */}
          <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {viewingIteration?.iteration_name} - Detailed View
                </DialogTitle>
                <DialogDescription>
                  Complete capacity overview and team member breakdown
                </DialogDescription>
              </DialogHeader>
              
              {viewingIteration && (
                <div className="space-y-6">
                  {/* Analytics Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4">
                      <div className="text-2xl font-bold">
                        {viewingIteration?.totalEffectiveCapacity ? viewingIteration.totalEffectiveCapacity.toFixed(1) : '0.0'}
                      </div>
                      <p className="text-sm text-muted-foreground">Total Capacity Days</p>
                    </Card>
                    <Card className="p-4">
                      <div className="text-2xl font-bold">{viewingIteration.committed_story_points}</div>
                      <p className="text-sm text-muted-foreground">Committed Points</p>
                    </Card>
                    <Card className="p-4">
                      <div className="text-2xl font-bold">{viewingIteration.totalMembers}</div>
                      <p className="text-sm text-muted-foreground">Team Members</p>
                    </Card>
                    <Card className="p-4">
                      <div className="text-2xl font-bold">{viewingIteration.working_days}</div>
                      <p className="text-sm text-muted-foreground">Working Days</p>
                    </Card>
                  </div>

                  {/* Team Members Breakdown */}
                  <div>
                    <h4 className="text-lg font-semibold mb-3">Team Members</h4>
                    <div className="grid gap-3">
                      {(viewingIteration.members || []).map(member => (
                        <Card key={member.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium">{member.member_name}</h5>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{member.role}</span>
                                <Badge variant="outline">{member.work_mode}</Badge>
                                <span>{member.availability_percent}% available</span>
                                {member.leaves > 0 && (
                                  <span>{member.leaves} days leave</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold">{Number(member.effective_capacity_days).toFixed(1)}</div>
                              <p className="text-sm text-muted-foreground">effective days</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Work Mode Distribution */}
                  <div>
                    <h4 className="text-lg font-semibold mb-3">Work Mode Distribution</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {['office', 'wfh', 'hybrid'].map(mode => {
                        const count = (viewingIteration.members || []).filter(m => m.work_mode === mode).length;
                        return (
                          <Card key={mode} className="p-4 text-center">
                            <div className="text-2xl font-bold">{count}</div>
                            <p className="text-sm text-muted-foreground capitalize">{mode === 'wfh' ? 'Work from Home' : mode}</p>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="iterations">Iterations</TabsTrigger>
          <TabsTrigger value="capacity">Team Capacity</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {iterations.length > 0 ? (
            <div className="space-y-6">
              {iterations.map((iteration) => (
                <Card key={iteration.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{iteration.iteration_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(iteration.start_date), 'MMM dd')} - {format(new Date(iteration.end_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <Badge variant="outline">{iteration.working_days} working days</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-border/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {iteration.totalEffectiveCapacity?.toFixed(1) || '0.0'}
                        </div>
                        <p className="text-xs text-muted-foreground">effective days</p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Committed Points</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{iteration.committed_story_points}</div>
                        <p className="text-xs text-muted-foreground">story points</p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Variance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2">
                          {(() => {
                            const totalCapacity = iteration.totalEffectiveCapacity || 0;
                            const variance = totalCapacity - iteration.committed_story_points;
                            return (
                              <>
                                {variance > 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : 
                                 variance < 0 ? <TrendingDown className="h-5 w-5 text-red-500" /> : null}
                                {Math.abs(variance).toFixed(1)}
                              </>
                            );
                          })()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const totalCapacity = iteration.totalEffectiveCapacity || 0;
                            const variance = totalCapacity - iteration.committed_story_points;
                            return variance > 0 ? 'Over-capacity' : variance < 0 ? 'Under-capacity' : 'Balanced';
                          })()}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No iterations yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first iteration to start tracking team capacity.
                </p>
                <Button onClick={() => {
                  resetIterationForm();
                  setShowIterationDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Iteration
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="iterations" className="space-y-4">
          <div className="grid gap-4">
            {iterations.map((iteration) => (
              <Card key={iteration.id} className={`cursor-pointer transition-all ${selectedIteration?.id === iteration.id ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div onClick={() => setSelectedIteration(iteration)}>
                      <CardTitle className="text-lg">{iteration.iteration_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(iteration.start_date), 'MMM dd')} - {format(new Date(iteration.end_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openViewIteration(iteration);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditIteration(iteration);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Iteration</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{iteration.iteration_name}"? This action cannot be undone and will remove all associated team capacity data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteIteration(iteration.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">{iteration.working_days} working days</Badge>
                    <Badge variant="outline">{iteration.committed_story_points} story points</Badge>
                    <Badge variant="outline">{iteration.totalMembers || 0} members</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="capacity" className="space-y-6">
          {iterations.length > 0 ? (
            <div className="space-y-6">
              {iterations.map((iteration) => (
                <Card key={iteration.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{iteration.iteration_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(iteration.start_date), 'MMM dd')} - {format(new Date(iteration.end_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {teams.length > 0 && (
                        <Select onValueChange={(teamId) => addTeamToIteration(teamId, iteration.id)}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Add Team" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.map(team => (
                              <SelectItem key={team.id} value={team.id}>
                                <div className="flex items-center gap-2">
                                  <Copy className="h-4 w-4" />
                                  {team.team_name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button onClick={() => openAddMember(iteration.id)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Member
                      </Button>
                    </div>
                  </div>
                  
                  {(iteration.members || []).length > 0 ? (
                    <div className="space-y-4">
                      {(iteration.members || []).map(member => (
                        <Card key={member.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{member.member_name}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{member.role}</span>
                                <Badge variant="outline">{member.work_mode}</Badge>
                                {member.team_id && (
                                  <Badge variant="secondary">
                                    {teams.find(t => t.id === member.team_id)?.team_name || 'Team'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{Number(member.effective_capacity_days || 0).toFixed(1)} days</div>
                              <p className="text-sm text-muted-foreground">{member.availability_percent}% available</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h4 className="text-lg font-semibold mb-2">No team members yet</h4>
                      <p className="text-muted-foreground mb-4">
                        Add team members to start capacity planning for this iteration.
                      </p>
                      <Button onClick={() => openAddMember(iteration.id)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Member
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No iterations yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first iteration to start capacity planning.
                </p>
                <Button onClick={() => {
                  resetIterationForm();
                  setShowIterationDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Iteration
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <div className="grid gap-4">
            {teams.map((team) => (
              <Card key={team.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{team.team_name}</h3>
                    <p className="text-sm text-muted-foreground">{team.description}</p>
                  </div>
                  <Badge variant="outline">{(team.members || []).length} members</Badge>
                </div>
                
                {(team.members || []).length > 0 ? (
                  <div className="grid gap-3">
                    {(team.members || []).map(member => (
                      <Card key={member.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{member.member_name}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{member.role}</span>
                              <Badge variant="outline">{member.work_mode}</Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{member.default_availability_percent}%</div>
                            <p className="text-sm text-muted-foreground">default availability</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No members in this team</p>
                )}
              </Card>
            ))}
            
            {teams.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create reusable teams to streamline capacity planning across iterations.
                  </p>
                  <Button onClick={() => {
                    resetTeamForm();
                    setShowTeamDialog(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Team
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analytics.length > 0 ? (
            <div className="grid gap-6">
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Capacity Analytics Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <h4 className="font-semibold mb-2">Total Capacity Days</h4>
                      <div className="text-2xl font-bold">
                        {analytics.reduce((sum, a) => sum + (a.total_capacity_days || 0), 0).toFixed(1)}
                      </div>
                    </Card>
                    <Card className="p-4">
                      <h4 className="font-semibold mb-2">Average Team Size</h4>
                      <div className="text-2xl font-bold">
                        {(analytics.reduce((sum, a) => sum + (a.team_size || 0), 0) / analytics.length).toFixed(1)}
                      </div>
                    </Card>
                    <Card className="p-4">
                      <h4 className="font-semibold mb-2">Average Member Capacity</h4>
                      <div className="text-2xl font-bold">
                        {(analytics.reduce((sum, a) => sum + (a.avg_member_capacity || 0), 0) / analytics.length).toFixed(1)}
                      </div>
                    </Card>
                  </div>
                </CardContent>
              </Card>
              
              {/* Work Mode Distribution */}
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Work Mode Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {['office', 'wfh', 'hybrid'].map(mode => {
                      const total = analytics.reduce((sum, a) => {
                        const distribution = a.work_mode_distribution || {};
                        return sum + (distribution[mode as keyof typeof distribution] || 0);
                      }, 0);
                      return (
                        <Card key={mode} className="p-4 text-center">
                          <div className="text-2xl font-bold">{total}</div>
                          <p className="text-sm text-muted-foreground capitalize">
                            {mode === 'wfh' ? 'Work from Home' : mode}
                          </p>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No analytics data yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Analytics will be generated automatically as you add iterations and team members.
                </p>
                <Button onClick={generateAnalytics}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate Analytics
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}