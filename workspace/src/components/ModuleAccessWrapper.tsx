import React, { useEffect } from 'react';
import { useModulePermissions, ModuleName, AccessLevel } from '@/hooks/useModulePermissions';
import { apiClient } from '@/services/api';
import { useApiAuth } from '@/hooks/useApiAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock } from 'lucide-react';

interface ModuleAccessWrapperProps {
  projectId: string;
  module: ModuleName;
  requiredAccess?: AccessLevel;
  children: React.ReactNode;
}

export function ModuleAccessWrapper({ 
  projectId, 
  module, 
  requiredAccess = 'read', 
  children 
}: ModuleAccessWrapperProps) {
  const { user } = useApiAuth();
  const { hasPermission, loading } = useModulePermissions(projectId);

  // Log module access attempt
  useEffect(() => {
    if (!user || !projectId || loading) return;

    const logAccess = async () => {
      try {
        await apiClient.logModuleAccess({
          userId: user.id,
          projectId: projectId,
          module: module,
          accessType: 'accessed',
          accessLevel: requiredAccess
        });
      } catch (error) {
        console.error('Error logging module access:', error);
      }
    };

    logAccess();
  }, [user, projectId, module, requiredAccess, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasAccess = hasPermission(module, requiredAccess);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <Alert className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            You don't have {requiredAccess} access to this module. Contact your project administrator for access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}