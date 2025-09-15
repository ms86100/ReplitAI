import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Users, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';

interface Team {
  id: string;
  team_name: string;
  description?: string;
  created_at: string;
  project_id: string;
  member_count?: number;
}

interface TeamMember {
  id: string;
  team_id: string;
  member_name: string;
  role?: string;
  email?: string;
  skills?: string[];
  work_mode: string;
  default_availability_percent: number;
  created_at: string;
}

interface TeamManagementProps {
  projectId: string;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ projectId }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const { toast } = useToast();

  const [teamForm, setTeamForm] = useState({
    name: '',
    description: ''
  });

  const [memberForm, setMemberForm] = useState({
    member_name: '',
    role: '',
    email: '',
    skills: '',
    work_mode: 'office',
    default_availability_percent: 100
  });

  useEffect(() => {
    fetchTeams();
  }, [projectId]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id);
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getTeams(projectId);
      if (response.success) {
        setTeams(response.data || []);
        if (response.data?.length > 0 && !selectedTeam) {
          setSelectedTeam(response.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({ title: 'Error', description: 'Failed to fetch teams', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      const response = await apiClient.getTeamMembers(teamId);
      if (response.success) {
        setTeamMembers(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({ title: 'Error', description: 'Failed to fetch team members', variant: 'destructive' });
    }
  };

  const handleCreateTeam = async () => {
    try {
      setLoading(true);
      const response = await apiClient.createTeam(projectId, teamForm);
      if (response.success) {
        toast({ title: 'Success', description: 'Team created successfully' });
        setTeamDialogOpen(false);
        setTeamForm({ name: '', description: '' });
        fetchTeams();
      }
    } catch (error) {
      console.error('Error creating team:', error);
      toast({ title: 'Error', description: 'Failed to create team', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTeam = async () => {
    if (!editingTeam) return;
    
    try {
      setLoading(true);
      const response = await apiClient.updateTeam(editingTeam.id, teamForm);
      if (response.success) {
        toast({ title: 'Success', description: 'Team updated successfully' });
        setTeamDialogOpen(false);
        setEditingTeam(null);
        setTeamForm({ name: '', description: '' });
        fetchTeams();
      }
    } catch (error) {
      console.error('Error updating team:', error);
      toast({ title: 'Error', description: 'Failed to update team', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? This will also remove all team members.')) return;
    
    try {
      setLoading(true);
      const response = await apiClient.deleteTeam(teamId);
      if (response.success) {
        toast({ title: 'Success', description: 'Team deleted successfully' });
        if (selectedTeam?.id === teamId) {
          setSelectedTeam(null);
          setTeamMembers([]);
        }
        fetchTeams();
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({ title: 'Error', description: 'Failed to delete team', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMember = async () => {
    if (!selectedTeam) return;
    
    try {
      setLoading(true);
      const memberData = {
        ...memberForm,
        skills: memberForm.skills ? memberForm.skills.split(',').map(s => s.trim()) : []
      };
      const response = await apiClient.createTeamMember(selectedTeam.id, memberData);
      if (response.success) {
        toast({ title: 'Success', description: 'Team member added successfully' });
        setMemberDialogOpen(false);
        setMemberForm({
          member_name: '',
          role: '',
          email: '',
          skills: '',
          work_mode: 'office',
          default_availability_percent: 100
        });
        fetchTeamMembers(selectedTeam.id);
      }
    } catch (error) {
      console.error('Error creating team member:', error);
      toast({ title: 'Error', description: 'Failed to add team member', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMember = async () => {
    if (!editingMember) return;
    
    try {
      setLoading(true);
      const memberData = {
        ...memberForm,
        skills: memberForm.skills ? memberForm.skills.split(',').map(s => s.trim()) : []
      };
      const response = await apiClient.updateTeamMember(editingMember.id, memberData);
      if (response.success) {
        toast({ title: 'Success', description: 'Team member updated successfully' });
        setMemberDialogOpen(false);
        setEditingMember(null);
        if (selectedTeam) {
          fetchTeamMembers(selectedTeam.id);
        }
      }
    } catch (error) {
      console.error('Error updating team member:', error);
      toast({ title: 'Error', description: 'Failed to update team member', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    
    try {
      setLoading(true);
      const response = await apiClient.deleteTeamMember(memberId);
      if (response.success) {
        toast({ title: 'Success', description: 'Team member removed successfully' });
        if (selectedTeam) {
          fetchTeamMembers(selectedTeam.id);
        }
      }
    } catch (error) {
      console.error('Error deleting team member:', error);
      toast({ title: 'Error', description: 'Failed to remove team member', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openTeamDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setTeamForm({ name: team.team_name, description: team.description || '' });
    } else {
      setEditingTeam(null);
      setTeamForm({ name: '', description: '' });
    }
    setTeamDialogOpen(true);
  };

  const openMemberDialog = (member?: TeamMember) => {
    if (member) {
      setEditingMember(member);
      setMemberForm({
        member_name: member.member_name,
        role: member.role || '',
        email: member.email || '',
        skills: member.skills?.join(', ') || '',
        work_mode: member.work_mode,
        default_availability_percent: member.default_availability_percent
      });
    } else {
      setEditingMember(null);
      setMemberForm({
        member_name: '',
        role: '',
        email: '',
        skills: '',
        work_mode: 'office',
        default_availability_percent: 100
      });
    }
    setMemberDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Teams Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teams Management
            </CardTitle>
            <p className="text-sm text-muted-foreground">Create and manage teams for your project</p>
          </div>
          <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openTeamDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTeam ? 'Edit Team' : 'Create New Team'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="team-name">Team Name</Label>
                  <Input
                    id="team-name"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    placeholder="Enter team name"
                  />
                </div>
                <div>
                  <Label htmlFor="team-description">Description (Optional)</Label>
                  <Textarea
                    id="team-description"
                    value={teamForm.description}
                    onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                    placeholder="Enter team description"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={editingTeam ? handleUpdateTeam : handleCreateTeam}
                    disabled={!teamForm.name.trim() || loading}
                  >
                    {editingTeam ? 'Update' : 'Create'} Team
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teams.map((team) => (
              <Card 
                key={team.id} 
                className={`cursor-pointer transition-colors ${
                  selectedTeam?.id === team.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedTeam(team)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{team.team_name}</h3>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTeamDialog(team);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTeam(team.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {team.description && (
                    <p className="text-sm text-muted-foreground mb-2">{team.description}</p>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {teamMembers.filter(m => m.team_id === team.id).length} members
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      {selectedTeam && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {selectedTeam.team_name} Members
              </CardTitle>
              <p className="text-sm text-muted-foreground">Manage team members for {selectedTeam.team_name}</p>
            </div>
            <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openMemberDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingMember ? 'Edit Member' : 'Add Team Member'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="member-name">Name</Label>
                    <Input
                      id="member-name"
                      value={memberForm.member_name}
                      onChange={(e) => setMemberForm({ ...memberForm, member_name: e.target.value })}
                      placeholder="Enter member name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="member-role">Role</Label>
                    <Input
                      id="member-role"
                      value={memberForm.role}
                      onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                      placeholder="e.g., Developer, Designer, QA"
                    />
                  </div>
                  <div>
                    <Label htmlFor="member-email">Email</Label>
                    <Input
                      id="member-email"
                      type="email"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="member-skills">Skills (comma-separated)</Label>
                    <Input
                      id="member-skills"
                      value={memberForm.skills}
                      onChange={(e) => setMemberForm({ ...memberForm, skills: e.target.value })}
                      placeholder="e.g., React, Node.js, Python"
                    />
                  </div>
                  <div>
                    <Label htmlFor="work-mode">Work Mode</Label>
                    <Select 
                      value={memberForm.work_mode} 
                      onValueChange={(value) => setMemberForm({ ...memberForm, work_mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="wfh">Work From Home</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="availability">Default Availability (%)</Label>
                    <Input
                      id="availability"
                      type="number"
                      min="0"
                      max="100"
                      value={memberForm.default_availability_percent}
                      onChange={(e) => setMemberForm({ 
                        ...memberForm, 
                        default_availability_percent: parseInt(e.target.value) || 100 
                      })}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={editingMember ? handleUpdateMember : handleCreateMember}
                      disabled={!memberForm.member_name.trim() || loading}
                    >
                      {editingMember ? 'Update' : 'Add'} Member
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
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Work Mode</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.filter(m => m.team_id === selectedTeam.id).map((member) => (
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
                      {member.skills && member.skills.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {member.skills.slice(0, 2).map((skill, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {member.skills.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{member.skills.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMemberDialog(member)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMember(member.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {teamMembers.filter(m => m.team_id === selectedTeam.id).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No team members added yet. Click "Add Member" to get started.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeamManagement;