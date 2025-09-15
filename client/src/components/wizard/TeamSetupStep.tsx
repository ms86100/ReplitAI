import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Mail, Users } from 'lucide-react';
import { ProjectData } from '../ProjectWizard';

interface TeamSetupStepProps {
  projectData: ProjectData;
  setProjectData: (data: ProjectData) => void;
}

const TeamSetupStep: React.FC<TeamSetupStepProps> = ({ projectData, setProjectData }) => {
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    
    if (!email) return;
    
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (projectData.inviteEmails.includes(email)) {
      setEmailError('This email is already added');
      return;
    }

    setProjectData({
      ...projectData,
      inviteEmails: [...projectData.inviteEmails, email]
    });

    setNewEmail('');
    setEmailError('');
  };

  const removeEmail = (emailToRemove: string) => {
    setProjectData({
      ...projectData,
      inviteEmails: projectData.inviteEmails.filter(email => email !== emailToRemove)
    });
  };

  const handleEmailChange = (value: string) => {
    setNewEmail(value);
    if (emailError) {
      setEmailError('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-muted-foreground">
          Invite teammates (optional). You can always add team members later.
        </p>
      </div>

      {/* Add Email Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="teamEmail">Email Address</Label>
                <Input
                  id="teamEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="colleague@company.com"
                  onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                />
                {emailError && (
                  <p className="text-sm text-destructive">{emailError}</p>
                )}
              </div>
              <div className="flex items-end">
                <Button onClick={addEmail} disabled={!newEmail.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      {projectData.inviteEmails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({projectData.inviteEmails.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projectData.inviteEmails.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {email[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{email}</p>
                      <Badge variant="outline" className="text-xs">
                        Pending Invitation
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeEmail(email)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {projectData.inviteEmails.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">
              No team members invited yet
            </p>
            <p className="text-sm text-muted-foreground">
              You can skip this step and invite team members later from the project dashboard.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Note */}
      <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
        <p>
          <strong>Note:</strong> Invited team members will receive an email notification
          with instructions to join the project. They'll need to create an account
          if they don't have one already.
        </p>
      </div>
    </div>
  );
};

export default TeamSetupStep;