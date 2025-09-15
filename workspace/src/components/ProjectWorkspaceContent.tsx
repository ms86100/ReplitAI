import React from 'react';
import { RoadmapView } from '@/components/workspace/RoadmapView';
import { KanbanView } from '@/components/workspace/KanbanView';
import { StakeholdersView } from '@/components/workspace/StakeholdersView';
import { StatusManagementView } from '@/components/workspace/StatusManagementView';
import { RiskRegisterView } from '@/components/workspace/RiskRegisterView';
import { DiscussionLog } from '@/components/workspace/DiscussionLog';
import { TaskBacklog } from '@/components/workspace/TaskBacklog';
import { TeamCapacityModule } from '@/components/workspace/TeamCapacityModule';
import { RetrospectiveView } from '@/components/workspace/RetrospectiveView';
import { ProjectBudgetManagement } from '@/components/workspace/ProjectBudgetManagement';
import { ProjectAccessControl } from '@/components/workspace/ProjectAccessControl';
import { ProjectAnalyticsDashboard } from '@/components/analytics/ProjectAnalyticsDashboard';
import { ModuleAccessWrapper } from '@/components/ModuleAccessWrapper';
import { ModuleName } from '@/hooks/useModulePermissions';

interface ProjectWorkspaceContentProps {
  projectId: string;
  currentModule?: string;
}

export function ProjectWorkspaceContent({ projectId, currentModule = 'roadmap' }: ProjectWorkspaceContentProps) {
  const getModuleConfig = (module: string): { component: React.ReactNode; moduleName: ModuleName; requiredAccess: 'read' | 'write' } => {
    switch (module) {
      case 'overview':
        return { 
          component: <ProjectAnalyticsDashboard projectId={projectId} />, 
          moduleName: 'overview' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'analytics':
        return { 
          component: <ProjectAnalyticsDashboard projectId={projectId} />, 
          moduleName: 'overview' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'roadmap':
        return { 
          component: <RoadmapView />, 
          moduleName: 'roadmap' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'kanban':
        return { 
          component: <KanbanView projectId={projectId} />, 
          moduleName: 'kanban' as ModuleName, 
          requiredAccess: 'write' 
        };
      case 'stakeholders':
        return { 
          component: <StakeholdersView projectId={projectId} />, 
          moduleName: 'stakeholders' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'discussions':
        return { 
          component: <DiscussionLog projectId={projectId} projectName="Current Project" />, 
          moduleName: 'discussions' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'backlog':
        return { 
          component: <TaskBacklog projectId={projectId} />, 
          moduleName: 'task_backlog' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'status':
        return { 
          component: (
            <div>
              <h1 className="text-2xl font-bold mb-6">Tasks & Milestones</h1>
              <StatusManagementView projectId={projectId} />
            </div>
          ), 
          moduleName: 'tasks_milestones' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'risks':
        return { 
          component: <RiskRegisterView projectId={projectId} />, 
          moduleName: 'risk_register' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'capacity':
        return { 
          component: <TeamCapacityModule projectId={projectId} />, 
          moduleName: 'team_capacity' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'retrospective':
        return { 
          component: <RetrospectiveView projectId={projectId} />, 
          moduleName: 'retrospectives' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'budget':
        return { 
          component: <ProjectBudgetManagement projectId={projectId} />, 
          moduleName: 'budget' as ModuleName, 
          requiredAccess: 'read' 
        };
      case 'access-control':
        return { 
          component: <ProjectAccessControl projectId={projectId} />, 
          moduleName: 'access_control' as ModuleName, 
          requiredAccess: 'write' 
        };
      default:
        return { 
          component: <RoadmapView />, 
          moduleName: 'roadmap' as ModuleName, 
          requiredAccess: 'read' 
        };
    }
  };

  const config = getModuleConfig(currentModule);

  return (
    <div className="flex-1 overflow-hidden">
      <ModuleAccessWrapper 
        projectId={projectId} 
        module={config.moduleName} 
        requiredAccess={config.requiredAccess}
      >
        <div className="p-6">
          {config.component}
        </div>
      </ModuleAccessWrapper>
    </div>
  );
}