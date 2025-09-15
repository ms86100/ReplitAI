import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { ProjectWorkspaceContent } from '@/components/ProjectWorkspaceContent';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { User, LogOut, Settings } from 'lucide-react';

const ProjectWorkspace = () => {
  const { id: projectId, module = 'roadmap' } = useParams();
  const { user, loading } = useApiAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !projectId) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full flex-col">
        {/* Header */}
        <header className="h-16 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-6 w-6" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-primary-foreground rounded-sm"></div>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">Purple Cow</h1>
                  <p className="text-xs text-muted-foreground">Enterprise Platform</p>
                </div>
              </div>
              <div className="ml-8">
                <h2 className="text-base font-medium text-foreground">Professional Project Management</h2>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="default" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                User
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                        S
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{user?.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/auth')}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          <ProjectSidebar projectId={projectId} />
          <main className="flex-1 overflow-auto">
            <ProjectWorkspaceContent projectId={projectId} currentModule={module} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ProjectWorkspace;