import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, LayoutGrid, Users, Settings, ArrowLeft, AlertTriangle, MessageCircle, BarChart3, RotateCcw, Shield, Activity, DollarSign } from 'lucide-react';
import { AccessControlDialog } from '@/components/access-control/AccessControlDialog';
import { AuditLogView } from '@/components/audit/AuditLogView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useModulePermissions, ModuleName } from '@/hooks/useModulePermissions';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

interface ProjectSidebarProps {
  projectId: string;
}

const sidebarItems: Array<{
  id: string;
  title: string;
  icon: any;
  path: string;
  description: string;
  module: ModuleName;
}> = [
  { 
    id: 'overview', 
    title: 'Dashboard', 
    icon: BarChart3, 
    path: 'overview',
    description: 'Project dashboard and insights',
    module: 'overview' as ModuleName
  },
  { 
    id: 'budget', 
    title: 'Budget', 
    icon: DollarSign, 
    path: 'budget',
    description: 'Manage project budget and expenses',
    module: 'budget' as ModuleName
  },
  { 
    id: 'tasks', 
    title: 'Tasks & Milestones', 
    icon: Calendar, 
    path: 'status',
    description: 'Manage tasks and milestones',
    module: 'tasks_milestones' as ModuleName
  },
  { 
    id: 'roadmap', 
    title: 'Roadmap', 
    icon: Calendar, 
    path: 'roadmap',
    description: 'Timeline view of milestones and tasks',
    module: 'roadmap' as ModuleName
  },
  { 
    id: 'kanban', 
    title: 'Kanban', 
    icon: LayoutGrid, 
    path: 'kanban',
    description: 'Drag and drop tasks by status',
    module: 'kanban' as ModuleName
  },
  { 
    id: 'stakeholders', 
    title: 'Stakeholders', 
    icon: Users, 
    path: 'stakeholders',
    description: 'Project stakeholder registry',
    module: 'stakeholders' as ModuleName
  },
  { 
    id: 'risks', 
    title: 'Risk Register', 
    icon: AlertTriangle, 
    path: 'risks',
    description: 'Identify and manage project risks',
    module: 'risk_register' as ModuleName
  },
  { 
    id: 'discussions', 
    title: 'Discussions', 
    icon: MessageCircle, 
    path: 'discussions',
    description: 'Project discussions and meetings',
    module: 'discussions' as ModuleName
  },
  { 
    id: 'backlog', 
    title: 'Task Backlog', 
    icon: Settings, 
    path: 'backlog',
    description: 'Manage task backlog',
    module: 'task_backlog' as ModuleName
  },
  { 
    id: 'capacity', 
    title: 'Team Capacity', 
    icon: BarChart3, 
    path: 'capacity',
    description: 'Manage team capacity planning',
    module: 'team_capacity' as ModuleName
  },
  { 
    id: 'retrospective', 
    title: 'Retrospectives', 
    icon: RotateCcw, 
    path: 'retrospective',
    description: 'Sprint retrospectives and team feedback',
    module: 'retrospectives' as ModuleName
  },
];

export function ProjectSidebar({ projectId }: ProjectSidebarProps) {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const currentPath = location.pathname;
  const [showAuditLog, setShowAuditLog] = useState(false);
  const { isProjectOwner, canRead, loading } = useModulePermissions(projectId);

  

  const isActive = (path: string) => currentPath.includes(`/project/${projectId}/${path}`);
  const hasActiveRoute = sidebarItems.some((item) => isActive(item.path));

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";

  return (
    <div className="w-64 bg-sidebar border-r border-border flex flex-col h-full">
      {/* Header Section */}
      <div className="p-6 border-b border-border">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 w-full justify-start"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </div>

      <div className="flex-1 py-6">
        {/* Project Navigation Section */}
        <div className="px-6 mb-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            PROJECT NAVIGATION
          </h3>
        </div>
        
        <nav className="px-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            sidebarItems.map((item) => {
              const itemIsActive = isActive(item.path);
              
              // Check if user has permission to view this module
              if (!canRead(item.module)) {
                return null; // Hide modules user doesn't have access to
              }

              return (
                <NavLink
                  key={item.id}
                  to={`/project/${projectId}/${item.path}`}
                  className={`flex items-center gap-3 px-3 py-2.5 mx-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    itemIsActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.title}</span>
                </NavLink>
              );
            })
          )}
          
          {/* Access Control moved to main navigation */}
          <AccessControlDialog 
            projectId={projectId} 
            trigger={
              <button className="flex items-center gap-3 px-3 py-2.5 mx-3 rounded-lg text-sm font-medium transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-left">
                <Shield className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Access Control</span>
              </button>
            } 
          />
        </nav>
      </div>

      {/* System Section */}
      <div className="pb-6">
        <div className="px-6 mb-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            SYSTEM
          </h3>
        </div>
        
        <nav className="px-3 space-y-1">
          <button 
            onClick={() => navigate(`/project/${projectId}`)}
            className="flex items-center gap-3 px-3 py-2.5 mx-3 rounded-lg text-sm font-medium transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-left"
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Settings</span>
          </button>
          
          <Dialog open={showAuditLog} onOpenChange={setShowAuditLog}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 px-3 py-2.5 mx-3 rounded-lg text-sm font-medium transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-left">
                <Activity className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Activity Log</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Project Activity History</DialogTitle>
              </DialogHeader>
              <AuditLogView projectId={projectId} />
            </DialogContent>
          </Dialog>
        </nav>
      </div>
    </div>
  );
}