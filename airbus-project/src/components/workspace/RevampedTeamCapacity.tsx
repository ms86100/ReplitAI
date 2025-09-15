import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Users, Eye, Edit, Trash2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import TeamManagement from './TeamManagement';
import WeeklyAvailabilityManager from './WeeklyAvailabilityManager';

interface Team {
  id: string;
  team_name: string;
  description?: string;
  member_count?: number;
}

interface TeamMember {
  id: string;
  team_id: string;
  member_name: string;
  role?: string;
  work_mode: string;
  default_availability_percent: number;
}

interface Iteration {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  working_days: number;
  status: string;
  team_id?: string;
  team_name?: string;
  committed_story_points?: number;
  totalEffectiveCapacity?: number;
  members?: TeamMember[];
}

interface RevampedTeamCapacityProps {
  projectId: string;
}

const RevampedTeamCapacity: React.FC<RevampedTeamCapacityProps> = ({ projectId }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [loading, setLoading] = useState(false);
  const [iterationDialogOpen, setIterationDialogOpen] = useState(false);
  const [viewingIteration, setViewingIteration] = useState<Iteration | null>(null);
  const [editingIteration, setEditingIteration] = useState<Iteration | null>(null);
  const [weeklyAvailabilityDialogOpen, setWeeklyAvailabilityDialogOpen] = useState(false);
  const [planningIteration, setPlanningIteration] = useState<Iteration | null>(null);
  const { toast } = useToast();

  const [iterationForm, setIterationForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    working_days: 10,
    team_id: '',
    committed_story_points: 0
  });

  useEffect(() => {
    fetchTeams();
    fetchIterations();
  }, [projectId]);

  const fetchTeams = async () => {
    try {
      const response = await apiClient.getTeams(projectId);
      if (response.success) {
        setTeams(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchIterations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCapacityData(projectId);
      if (response.success) {
        setIterations(response.data?.iterations || []);
      }
    } catch (error) {
      console.error('Error fetching iterations:', error);
      toast({ title: 'Error', description: 'Failed to fetch iterations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calculateWeeksFromDates = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.ceil(diffDays / 7);
  };

  const handleCreateIteration = async () => {
    try {
      setLoading(true);
      const iterationData = {
        type: 'iteration' as const,
        iterationName: iterationForm.name,
        startDate: iterationForm.start_date,
        endDate: iterationForm.end_date,
        workingDays: iterationForm.working_days,
        committedStoryPoints: iterationForm.committed_story_points,
        teamId: iterationForm.team_id // Include team assignment
      };
      
      const response = await apiClient.createCapacityIteration(projectId, iterationData);
      if (response.success) {
        toast({ 
          title: 'Success', 
          description: `Iteration created with ${calculateWeeksFromDates(iterationForm.start_date, iterationForm.end_date)} weeks` 
        });
        setIterationDialogOpen(false);
        resetIterationForm();
        fetchIterations();
      } else {
        throw new Error(response.error || 'Failed to create iteration');
      }
    } catch (error) {
      console.error('Error creating iteration:', error);
      toast({ title: 'Error', description: 'Failed to create iteration', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateIteration = async () => {
    if (!editingIteration) return;
    
    try {
      setLoading(true);
      const iterationData = {
        type: 'iteration' as const,
        iterationName: iterationForm.name,
        startDate: iterationForm.start_date,
        endDate: iterationForm.end_date,
        workingDays: iterationForm.working_days,
        committedStoryPoints: iterationForm.committed_story_points
      };
      
      const response = await apiClient.updateCapacityIteration(projectId, editingIteration.id, iterationData);
      if (response.success) {
        toast({ title: 'Success', description: 'Iteration updated successfully' });
        setIterationDialogOpen(false);
        setEditingIteration(null);
        resetIterationForm();
        fetchIterations();
      } else {
        throw new Error(response.error || 'Failed to update iteration');
      }
    } catch (error) {
      console.error('Error updating iteration:', error);
      toast({ title: 'Error', description: 'Failed to update iteration', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIteration = async (iterationId: string) => {
    if (!confirm('Are you sure you want to delete this iteration? This will also remove all team capacity data.')) return;
    
    try {
      setLoading(true);
      const response = await apiClient.deleteCapacityIteration(projectId, iterationId);
      if (response.success) {
        toast({ title: 'Success', description: 'Iteration deleted successfully' });
        fetchIterations();
        if (viewingIteration?.id === iterationId) {
          setViewingIteration(null);
        }
      } else {
        throw new Error(response.error || 'Failed to delete iteration');
      }
    } catch (error) {
      console.error('Error deleting iteration:', error);
      toast({ title: 'Error', description: 'Failed to delete iteration', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetIterationForm = () => {
    setIterationForm({
      name: '',
      start_date: '',
      end_date: '',
      working_days: 10,
      team_id: '',
      committed_story_points: 0
    });
  };

  const openIterationDialog = (iteration?: Iteration) => {
    if (iteration) {
      setEditingIteration(iteration);
      setIterationForm({
        name: iteration.name,
        start_date: iteration.start_date,
        end_date: iteration.end_date,
        working_days: iteration.working_days,
        team_id: iteration.team_id || '',
        committed_story_points: iteration.committed_story_points || 0
      });
    } else {
      setEditingIteration(null);
      resetIterationForm();
    }
    setIterationDialogOpen(true);
  };

  const viewIteration = async (iteration: Iteration) => {
    try {
      // For now, just show the iteration with basic data
      setViewingIteration({
        ...iteration,
        totalEffectiveCapacity: iteration.totalEffectiveCapacity || 0
      });
    } catch (error) {
      console.error('Error fetching iteration details:', error);
      setViewingIteration(iteration);
    }
  };

  const getSelectedTeamName = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.team_name : 'Select Team';
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Capacity Overview</TabsTrigger>
          <TabsTrigger value="teams">Team Management</TabsTrigger>
          <TabsTrigger value="iterations">Iterations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Capacity Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Capacity Overview
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Overview of team capacity across all iterations
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-2xl font-bold">{iterations.length}</div>
                  <p className="text-sm text-muted-foreground">Total Iterations</p>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold">{teams.length}</div>
                  <p className="text-sm text-muted-foreground">Active Teams</p>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold">
                    {iterations.reduce((sum, iter) => sum + (iter.totalEffectiveCapacity || 0), 0).toFixed(1)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Capacity Days</p>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Recent Iterations */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Iterations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Iteration</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {iterations.slice(0, 5).map((iteration) => (
                    <TableRow key={iteration.id}>
                      <TableCell className="font-medium">{iteration.name}</TableCell>
                      <TableCell>{iteration.team_name || 'No Team'}</TableCell>
                      <TableCell>
                        {new Date(iteration.start_date).toLocaleDateString()} - {new Date(iteration.end_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={iteration.status === 'active' ? 'default' : 'secondary'}>
                          {iteration.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{iteration.totalEffectiveCapacity?.toFixed(1) || '0.0'} days</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => viewIteration(iteration)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {iterations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No iterations found. Create your first iteration to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams">
          <TeamManagement projectId={projectId} />
        </TabsContent>

        <TabsContent value="iterations" className="space-y-6">
          {/* Iterations Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Iterations
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage capacity planning iterations for your project
                </p>
              </div>
              <Dialog open={iterationDialogOpen} onOpenChange={setIterationDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => openIterationDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Iteration
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingIteration ? 'Edit Iteration' : 'Create New Iteration'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="iteration-name">Iteration Name</Label>
                      <Input
                        id="iteration-name"
                        value={iterationForm.name}
                        onChange={(e) => setIterationForm({ ...iterationForm, name: e.target.value })}
                        placeholder="e.g., Sprint 1, Q1 2024"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={iterationForm.start_date}
                          onChange={(e) => setIterationForm({ ...iterationForm, start_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={iterationForm.end_date}
                          onChange={(e) => setIterationForm({ ...iterationForm, end_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="working-days">Working Days</Label>
                      <Input
                        id="working-days"
                        type="number"
                        min="1"
                        value={iterationForm.working_days}
                        onChange={(e) => setIterationForm({ 
                          ...iterationForm, 
                          working_days: parseInt(e.target.value) || 10 
                        })}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Duration: {calculateWeeksFromDates(iterationForm.start_date, iterationForm.end_date)} weeks
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="team-select">Select Team</Label>
                      <Select 
                        value={iterationForm.team_id} 
                        onValueChange={(value) => setIterationForm({ ...iterationForm, team_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a team for this iteration" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.team_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="story-points">Committed Story Points</Label>
                      <Input
                        id="story-points"
                        type="number"
                        min="0"
                        value={iterationForm.committed_story_points}
                        onChange={(e) => setIterationForm({ 
                          ...iterationForm, 
                          committed_story_points: parseInt(e.target.value) || 0 
                        })}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setIterationDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={editingIteration ? handleUpdateIteration : handleCreateIteration}
                        disabled={!iterationForm.name.trim() || !iterationForm.team_id || loading}
                      >
                        {editingIteration ? 'Update' : 'Create'} Iteration
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Iteration</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Working Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Story Points</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {iterations.map((iteration) => (
                    <TableRow key={iteration.id}>
                      <TableCell className="font-medium">{iteration.name}</TableCell>
                      <TableCell>{iteration.team_name || 'No Team'}</TableCell>
                      <TableCell>
                        {new Date(iteration.start_date).toLocaleDateString()} - {new Date(iteration.end_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{iteration.working_days}</TableCell>
                      <TableCell>
                        <Badge variant={iteration.status === 'active' ? 'default' : 'secondary'}>
                          {iteration.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{iteration.committed_story_points || 0}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => viewIteration(iteration)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {iteration.team_id && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setPlanningIteration(iteration);
                                setWeeklyAvailabilityDialogOpen(true);
                              }}
                              title="Plan Weekly Availability"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openIterationDialog(iteration)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteIteration(iteration.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openIterationDialog(iteration)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteIteration(iteration.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {iterations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No iterations created yet. Click "Create Iteration" to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Iteration Details Modal */}
      {viewingIteration && (
        <Dialog open={!!viewingIteration} onOpenChange={() => setViewingIteration(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{viewingIteration.name} - Capacity Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Analytics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-2xl font-bold">
                    {viewingIteration.totalEffectiveCapacity?.toFixed(1) || '0.0'}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Capacity Days</p>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold">{viewingIteration.committed_story_points || 0}</div>
                  <p className="text-sm text-muted-foreground">Committed Points</p>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold">{viewingIteration.working_days}</div>
                  <p className="text-sm text-muted-foreground">Working Days</p>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold">{viewingIteration.members?.length || 0}</div>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                </Card>
              </div>

              {/* Team Members */}
              {viewingIteration.members && viewingIteration.members.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Team Members Capacity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Work Mode</TableHead>
                          <TableHead>Availability</TableHead>
                          <TableHead>Effective Capacity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingIteration.members.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">{member.member_name}</TableCell>
                            <TableCell>{member.role || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {member.work_mode}
                              </Badge>
                            </TableCell>
                            <TableCell>{member.default_availability_percent}%</TableCell>
                            <TableCell>
                              {((viewingIteration.working_days * member.default_availability_percent) / 100).toFixed(1)} days
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Weekly Availability Planning Dialog */}
      <Dialog open={weeklyAvailabilityDialogOpen} onOpenChange={setWeeklyAvailabilityDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Weekly Availability Planning - {planningIteration?.name}
            </DialogTitle>
          </DialogHeader>
          {planningIteration && planningIteration.team_id && (
            <WeeklyAvailabilityManager
              projectId={projectId}
              iterationId={planningIteration.id}
              teamId={planningIteration.team_id}
              startDate={planningIteration.start_date}
              endDate={planningIteration.end_date}
              onSave={() => {
                setWeeklyAvailabilityDialogOpen(false);
                fetchIterations();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RevampedTeamCapacity;