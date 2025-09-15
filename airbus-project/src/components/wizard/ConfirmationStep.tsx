import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, Users, Target, ListTodo, Milestone } from 'lucide-react';
import { ProjectData } from '../ProjectWizard';

interface ConfirmationStepProps {
  projectData: ProjectData;
  setProjectData: (data: ProjectData) => void;
}

const ConfirmationStep: React.FC<ConfirmationStepProps> = ({ projectData }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const totalTasks = projectData.milestones.reduce((sum, milestone) => sum + milestone.tasks.length, 0);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-muted-foreground">
          Review your project setup. Ready to create it?
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Basics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Project Basics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{projectData.projectName}</h3>
              <p className="text-muted-foreground mt-1">{projectData.objective}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>Start: {formatDate(projectData.startDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>End: {formatDate(projectData.endDate)}</span>
              </div>
            </div>

            {projectData.businessValue && (
              <div>
                <h4 className="font-medium">Business Value</h4>
                <p className="text-sm text-muted-foreground">{projectData.businessValue}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team ({projectData.inviteEmails.length + 1})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-medium">You (Project Creator)</p>
                  <Badge variant="default" className="text-xs">Owner</Badge>
                </div>
              </div>
              
              {projectData.inviteEmails.map((email) => (
                <div key={email} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-muted-foreground text-sm font-medium">
                      {email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{email}</p>
                    <Badge variant="outline" className="text-xs">Invited</Badge>
                  </div>
                </div>
              ))}

              {projectData.inviteEmails.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No additional team members invited
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks & Milestones Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Tasks & Milestones Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <div className="text-2xl font-bold text-primary">{projectData.milestones.length}</div>
              <p className="text-sm text-muted-foreground">Milestones</p>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <div className="text-2xl font-bold text-primary">{totalTasks}</div>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {Math.round(totalTasks / projectData.milestones.length)}
              </div>
              <p className="text-sm text-muted-foreground">Avg Tasks/Milestone</p>
            </div>
          </div>

          <div className="space-y-4">
            {projectData.milestones.map((milestone, index) => (
              <div key={milestone.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Milestone className="h-4 w-4" />
                    <h4 className="font-semibold">{milestone.name}</h4>
                    <Badge variant="outline">{milestone.tasks.length} tasks</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Due: {formatDate(milestone.dueDate)}
                  </div>
                </div>
                <div className="space-y-1">
                  {milestone.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-muted-foreground" />
                      <span>{task.title}</span>
                      <Badge variant="outline" className="text-xs">{task.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="bg-muted p-6 rounded-lg text-center">
        <h3 className="font-semibold mb-2">Ready to Create Your Project?</h3>
        <p className="text-muted-foreground">
          Your project "{projectData.projectName}" will be created with {projectData.milestones.length} milestones
          and {totalTasks} tasks. {projectData.inviteEmails.length > 0 && 
          `${projectData.inviteEmails.length} team members will be invited.`}
        </p>
      </div>
    </div>
  );
};

export default ConfirmationStep;