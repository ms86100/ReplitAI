import { useState } from "react"
import { Home, FolderOpen, Users, Settings, Plane, BarChart3, Calendar, Bell, RotateCcw, Shield, Map, Kanban, MessageSquare, Archive, AlertTriangle, Activity, ArrowLeft } from "lucide-react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { useProjectContext } from "@/hooks/useProjectContext"
import { Button } from "@/components/ui/button"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"

const dashboardNavigation = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Team Capacity", url: "/team-capacity", icon: BarChart3 },
  { title: "Retrospectives", url: "/retrospectives", icon: RotateCcw },
  { title: "Access Control", url: "/access-control", icon: Shield },
]

const getProjectNavigation = (projectId: string) => [
  { title: "Dashboard", url: `/project/${projectId}`, icon: Home },
  { title: "Project List", url: "/", icon: FolderOpen },
  { title: "Budget", url: `/project/${projectId}/budget`, icon: BarChart3 },
  { title: "Tasks & Milestones", url: `/project/${projectId}/tasks`, icon: Calendar },
  { title: "Roadmap", url: `/project/${projectId}/roadmap`, icon: Map },
  { title: "Kanban", url: `/project/${projectId}/kanban`, icon: Kanban },
  { title: "Stakeholders", url: `/project/${projectId}/stakeholders`, icon: Users },
  { title: "Risk Register", url: `/project/${projectId}/risks`, icon: AlertTriangle },
  { title: "Discussions", url: `/project/${projectId}/discussions`, icon: MessageSquare },
  { title: "Task Backlog", url: `/project/${projectId}/backlog`, icon: Archive },
  { title: "Team Capacity", url: `/project/${projectId}/capacity`, icon: BarChart3 },
  { title: "Retrospectives", url: `/project/${projectId}/retrospective`, icon: RotateCcw },
  { title: "Access Control", url: `/project/${projectId}/access-control`, icon: Shield },
]

const settings = [
  { title: "Settings", url: "/settings", icon: Settings },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname
  const isCollapsed = state === "collapsed"
  const { selectedProjectId, isProjectSelected } = useProjectContext()
  const navigate = useNavigate()
  
  const navigation = isProjectSelected && selectedProjectId 
    ? getProjectNavigation(selectedProjectId) 
    : dashboardNavigation

  const isActive = (path: string) => {
    if (path === '/') {
      return currentPath === '/'
    }
    return currentPath.startsWith(path)
  }

  const getNavCls = (path: string) =>
    isActive(path) 
      ? "bg-brand-primary text-brand-on-primary font-medium shadow-sm" 
      : "hover:bg-surface-alt text-text-primary"

  return (
    <Sidebar
      collapsible="icon"
    >
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-primary rounded-lg shadow-sm">
            <Plane className="h-6 w-6 text-brand-on-primary" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-heading font-bold text-text-primary">Purple Cow</h2>
              <p className="text-xs text-text-muted">Enterprise Platform</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        {isProjectSelected && (
          <div className="mb-4 px-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/projects')}
              className="w-full justify-start gap-2 text-text-muted hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              {!isCollapsed && "Back to Projects"}
            </Button>
          </div>
        )}
        
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            {!isCollapsed ? (isProjectSelected ? 'Project Navigation' : 'Main Navigation') : ''}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === '/'}
                      className={`${getNavCls(item.url)} flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            {!isCollapsed ? 'System' : ''}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {settings.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className={`${getNavCls(item.url)} flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}