import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Calendar, LayoutGrid, Users, Settings, ArrowLeft, AlertTriangle, MessageCircle, BarChart3, RotateCcw, Shield, Activity, DollarSign, Link } from 'lucide-react';
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
  { 
    id: 'jira-sync', 
    title: 'Jira Task Sync', 
    icon: Link, 
    path: 'jira-sync',
    description: 'Bi-directional task synchronization with Jira',
    module: 'jira_sync' as ModuleName
  },
];

export function ProjectSidebar({ projectId }: ProjectSidebarProps) {
  const [, setLocation] = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const currentPath = window.location.pathname;
  const [showAuditLog, setShowAuditLog] = useState(false);
  const { isProjectOwner, canRead, loading } = useModulePermissions(projectId);

  

  const isActive = (path: string) => currentPath.includes(`/project/${projectId}/${path}`);
  const hasActiveRoute = sidebarItems.some((item) => isActive(item.path));

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";

  return (
    <div className="w-64 bg-gradient-to-b from-brand-light to-background border-r border-border/50 flex flex-col h-full shadow-lg">
      {/* Premium Header Section */}
      <div className="p-6 border-b border-border/30 bg-gradient-to-r from-airbus-primary/5 to-transparent">
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2 w-full justify-start mb-4 text-airbus-primary border-airbus-primary/20 hover:bg-airbus-primary hover:text-white transition-all font-medium"
          onClick={() => setLocation('/')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </div>

      <div className="flex-1 py-6">
        {/* Project Navigation Section */}
        <div className="px-6 mb-6">
          <h3 className="text-xs font-bold text-airbus-primary uppercase tracking-wider mb-1">
            PROJECT NAVIGATION
          </h3>
          <div className="h-0.5 w-8 bg-gradient-to-r from-airbus-primary to-airbus-accent rounded-full"></div>
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
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => setLocation(`/project/${projectId}/${item.path}`)}
                  className={`flex items-center gap-3 px-4 py-3 mx-3 rounded-xl text-sm font-medium transition-all duration-300 w-full justify-start group ${
                    itemIsActive
                      ? "bg-gradient-to-r from-airbus-primary to-airbus-accent text-white shadow-lg transform scale-[1.02]"
                      : "text-sidebar-foreground hover:bg-gradient-to-r hover:from-airbus-light hover:to-airbus-primary/10 hover:text-airbus-primary hover:scale-[1.01] hover:shadow-md"
                  }`}
                  data-testid={`link-${item.id}`}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.title}</span>
                </Button>
              );
            })
          )}
          
          {/* Access Control moved to main navigation */}
          <AccessControlDialog 
            projectId={projectId} 
            trigger={
              <button className="flex items-center gap-3 px-4 py-3 mx-3 rounded-xl text-sm font-medium transition-all duration-300 text-sidebar-foreground hover:bg-gradient-to-r hover:from-airbus-light hover:to-airbus-primary/10 hover:text-airbus-primary hover:scale-[1.01] hover:shadow-md w-full text-left group">
                <Shield className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Access Control</span>
              </button>
            } 
          />
        </nav>
      </div>

      {/* System Section */}
      <div className="pb-6 border-t border-border/30 pt-6">
        <div className="px-6 mb-6">
          <h3 className="text-xs font-bold text-airbus-primary uppercase tracking-wider mb-1">
            SYSTEM
          </h3>
          <div className="h-0.5 w-6 bg-gradient-to-r from-airbus-primary to-airbus-accent rounded-full"></div>
        </div>
        
        <nav className="px-3 space-y-1">
          <button 
            onClick={() => setLocation(`/project/${projectId}`)}
            className="flex items-center gap-3 px-4 py-3 mx-3 rounded-xl text-sm font-medium transition-all duration-300 text-sidebar-foreground hover:bg-gradient-to-r hover:from-airbus-light hover:to-airbus-primary/10 hover:text-airbus-primary hover:scale-[1.01] hover:shadow-md w-full text-left group"
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Settings</span>
          </button>
          
          <Dialog open={showAuditLog} onOpenChange={setShowAuditLog}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 mx-3 rounded-xl text-sm font-medium transition-all duration-300 text-sidebar-foreground hover:bg-gradient-to-r hover:from-airbus-light hover:to-airbus-primary/10 hover:text-airbus-primary hover:scale-[1.01] hover:shadow-md w-full text-left group">
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