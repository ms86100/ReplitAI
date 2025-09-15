import React from 'react';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useProjectContext } from '@/hooks/useProjectContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { LogOut, User, Settings, Menu } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, signOut } = useApiAuth();
  const { isProjectSelected } = useProjectContext();

  const getRoleBadgeVariant = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'project_coordinator':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getRoleDisplayName = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'project_coordinator':
        return 'Project Coordinator';
      default:
        return 'User';
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-surface-default">
        {isProjectSelected && <AppSidebar />}
        
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <header className="sticky top-0 z-40 w-full border-b border-border bg-surface-default/95 backdrop-blur-sm shadow-sm">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center gap-4">
                {isProjectSelected && <SidebarTrigger className="hover:bg-surface-alt" />}
                <div className="text-lg font-semibold text-text-primary">
                  Professional Project Management
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* TODO: Add userRole back from API when available */}
                <Badge variant="default" className="shadow-sm">
                  User
                </Badge>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-border shadow-sm hover:shadow-md hover:bg-surface-alt">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="/placeholder-avatar.jpg" alt={user?.email} />
                        <AvatarFallback className="bg-gradient-primary text-brand-on-primary font-semibold text-sm">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-64 bg-surface-default border border-border shadow-lg" 
                    align="end" 
                    sideOffset={8}
                  >
                    <DropdownMenuLabel className="font-normal p-4">
                      <div className="flex flex-col space-y-2">
                        <p className="text-sm font-semibold leading-none text-text-primary">{user?.email}</p>
                        <p className="text-xs leading-none text-text-muted font-medium">
                          User
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem className="p-3 text-text-primary hover:bg-surface-alt cursor-pointer">
                      <User className="mr-3 h-4 w-4" />
                      <span>Profile Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="p-3 text-text-primary hover:bg-surface-alt cursor-pointer">
                      <Settings className="mr-3 h-4 w-4" />
                      <span>Preferences</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem 
                      onClick={signOut} 
                      className="p-3 text-destructive hover:bg-destructive/5 cursor-pointer"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 bg-surface-alt/30">
            <div className="max-w-7xl mx-auto animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;