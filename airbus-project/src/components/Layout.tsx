import React from 'react';
import { useApiAuth } from '@/hooks/useApiAuth';
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
import { Plane, LogOut, User, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useApiAuth();

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
    <div className="min-h-screen bg-gradient-to-br from-surface-default to-surface-alt">
      {/* Professional Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-surface-default/80 backdrop-blur-md shadow-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-primary rounded-lg shadow-airbus">
              <Plane className="h-7 w-7 text-brand-on-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-text-primary tracking-tight">Purple Cow</h1>
              <p className="text-sm text-text-muted font-medium">Professional Project Management</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Role badge removed - can be added back by fetching user role separately */}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-12 w-12 rounded-full border border-border shadow-sm hover:shadow-card">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="/placeholder-avatar.jpg" alt={user?.email} />
                    <AvatarFallback className="bg-gradient-primary text-brand-on-primary font-semibold">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 bg-surface-default border-border shadow-elevated" align="end" forceMount>
                <DropdownMenuLabel className="font-normal p-4">
                  <div className="flex flex-col space-y-2">
                    <p className="text-sm font-semibold leading-none text-text-primary">{user?.email}</p>
                    <p className="text-xs leading-none text-text-muted font-medium">
                      User
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="p-3 text-text-primary hover:bg-surface-alt">
                  <User className="mr-3 h-4 w-4" />
                  <span>Profile Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="p-3 text-text-primary hover:bg-surface-alt">
                  <Settings className="mr-3 h-4 w-4" />
                  <span>Preferences</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={signOut} className="p-3 text-destructive hover:bg-destructive/5">
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content with Professional Spacing */}
      <main className="container py-8 animate-fade-in">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;