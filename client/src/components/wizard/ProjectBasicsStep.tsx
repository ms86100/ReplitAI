import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ProjectData } from '../ProjectWizard';

interface ProjectBasicsStepProps {
  projectData: ProjectData;
  setProjectData: (data: ProjectData) => void;
}

const ProjectBasicsStep: React.FC<ProjectBasicsStepProps> = ({ projectData, setProjectData }) => {
  const updateField = (field: keyof ProjectData, value: string) => {
    setProjectData({
      ...projectData,
      [field]: value
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-muted-foreground">
          Let's set up your project. What's the name and objective?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">
              Project Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="projectName"
              value={projectData.projectName}
              onChange={(e) => updateField('projectName', e.target.value)}
              placeholder="Enter project name"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              {projectData.projectName.length}/120 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={projectData.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={projectData.endDate}
              onChange={(e) => updateField('endDate', e.target.value)}
              min={projectData.startDate}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="objective">
              Project Objective <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="objective"
              value={projectData.objective}
              onChange={(e) => updateField('objective', e.target.value)}
              placeholder="Describe the main objective and goals of this project"
              className="min-h-[100px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {projectData.objective.length}/500 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessValue">Business Value (Optional)</Label>
            <Textarea
              id="businessValue"
              value={projectData.businessValue}
              onChange={(e) => updateField('businessValue', e.target.value)}
              placeholder="What business value will this project deliver?"
              className="min-h-[80px]"
            />
          </div>
        </div>
      </div>

      {/* Validation Messages */}
      {projectData.projectName.length > 120 && (
        <p className="text-sm text-destructive">Project name must be 120 characters or less</p>
      )}
      {projectData.objective.length > 500 && (
        <p className="text-sm text-destructive">Objective must be 500 characters or less</p>
      )}
    </div>
  );
};

export default ProjectBasicsStep;