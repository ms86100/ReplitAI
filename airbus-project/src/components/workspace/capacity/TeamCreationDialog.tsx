import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';

interface TeamMember {
  display_name: string;
  role: string;
  email: string;
}

interface TeamCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onTeamCreated: (teamId: string) => void;
}

export const TeamCreationDialog: React.FC<TeamCreationDialogProps> = ({
  open,
  onOpenChange,
  projectId,
  onTeamCreated,
}) => {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();

  const [teamForm, setTeamForm] = useState({
    name: '',
    description: '',
  });

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberForm, setMemberForm] = useState({
    display_name: '',
    role: '',
    email: '',
  });

  const handleClose = () => {
    setCurrentStep(1);
    setTeamForm({ name: '', description: '' });
    setMembers([]);
    setMemberForm({ display_name: '', role: '', email: '' });
    onOpenChange(false);
  };

  const handleAddMember = () => {
    if (memberForm.display_name.trim()) {
      setMembers([...members, { ...memberForm }]);
      setMemberForm({ display_name: '', role: '', email: '' });
    }
  };

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleCreateTeam = async () => {
    try {
      setLoading(true);
      
      // Create team
      const teamResponse = await apiClient.createTeam(projectId, teamForm);
      if (!teamResponse.success) {
        throw new Error(teamResponse.error || 'Failed to create team');
      }
      
      const teamId = teamResponse.data.id;

      // Add members if any
      if (members.length > 0) {
        
        for (const member of members) {
          const memberData = {
            member_name: member.display_name,
            role: member.role,
            email: member.email,
            skills: [],
            work_mode: 'office',
            default_availability_percent: 100
          };
          
          const memberResponse = await apiClient.createTeamMember(teamId, memberData);
          if (!memberResponse.success) {
            console.error('Failed to create member:', memberResponse.error);
            throw new Error(`Failed to create member ${member.display_name}: ${memberResponse.error}`);
          }
        }
      }

      onTeamCreated(teamId);
      handleClose();
    } catch (error) {
      console.error('Error creating team:', error);
      
      // Show actual error message for debugging
      let errorMessage = 'Failed to create team';
      if (error instanceof Error) {
        errorMessage = `Failed to create team: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = `Failed to create team: ${error}`;
      } else if (error && typeof error === 'object' && 'error' in error) {
        errorMessage = `Failed to create team: ${error.error}`;
      }
      
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Create New Team - Step {currentStep} of 2
          </DialogTitle>
        </DialogHeader>

        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="team-name">Team Name *</Label>
              <Input
                id="team-name"
                value={teamForm.name}
                onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                placeholder="Enter team name"
                required
              />
            </div>
            <div>
              <Label htmlFor="team-description">Description</Label>
              <Textarea
                id="team-description"
                value={teamForm.description}
                onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                placeholder="Enter team description"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={() => setCurrentStep(2)}
                disabled={!teamForm.name.trim()}
              >
                Next: Add Members
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Team Members</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="member-name">Name *</Label>
                    <Input
                      id="member-name"
                      value={memberForm.display_name}
                      onChange={(e) => setMemberForm({ ...memberForm, display_name: e.target.value })}
                      placeholder="Member name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="member-role">Role</Label>
                    <Input
                      id="member-role"
                      value={memberForm.role}
                      onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                      placeholder="e.g., Developer, Designer"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="member-email">Email</Label>
                  <Input
                    id="member-email"
                    type="email"
                    value={memberForm.email}
                    onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <Button 
                  type="button" 
                  onClick={handleAddMember}
                  disabled={!memberForm.display_name.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </CardContent>
            </Card>

            {members.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Members ({members.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {members.map((member, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">{member.display_name}</span>
                          {member.role && <span className="text-muted-foreground ml-2">• {member.role}</span>}
                          {member.email && <span className="text-muted-foreground ml-2">• {member.email}</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTeam}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};