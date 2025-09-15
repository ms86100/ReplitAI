import { useState, useEffect } from 'react';
import { apiClient } from '@/services/api';
import { useApiAuth } from '@/hooks/useApiAuth';

export type ModuleName = 
  | 'overview'
  | 'tasks_milestones'
  | 'roadmap'
  | 'kanban'
  | 'stakeholders'
  | 'risk_register'
  | 'discussions'
  | 'task_backlog'
  | 'team_capacity'
  | 'retrospectives'
  | 'budget'
  | 'access_control';

export type AccessLevel = 'read' | 'write';

interface ModulePermissions {
  [key: string]: AccessLevel | null;
}

export function useModulePermissions(projectId: string) {
  const { user } = useApiAuth();
  const [permissions, setPermissions] = useState<ModulePermissions>({});
  const [isProjectOwner, setIsProjectOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !projectId) {
      setLoading(false);
      return;
    }

    checkPermissions();
  }, [user, projectId]);

  const checkPermissions = async () => {
    if (!user) return;

    try {
      // Get project details including ownership
      const projectResponse = await apiClient.getProject(projectId);
      if (!projectResponse.success) {
        console.error('Error fetching project:', projectResponse.error);
        setLoading(false);
        return;
      }

      const isOwner = projectResponse.data.created_by === user.id;
      setIsProjectOwner(isOwner);

      // Check if user is admin by getting user profile/role
      const profileResponse = await apiClient.getProfile(user.id);
      const isAdminUser = profileResponse.success && profileResponse.data?.role === 'admin';
      setIsAdmin(isAdminUser);

      // If user is project owner or admin, they have full access
      if (isOwner || isAdminUser) {
        const fullPermissions: ModulePermissions = {
          overview: 'write',
          tasks_milestones: 'write',
          roadmap: 'write',
          kanban: 'write',
          stakeholders: 'write',
          risk_register: 'write',
          discussions: 'write',
          task_backlog: 'write',
          team_capacity: 'write',
          retrospectives: 'write',
          budget: 'write',
          access_control: 'write',
        };
        setPermissions(fullPermissions);
        setLoading(false);
        return;
      }

      // Fetch specific module permissions for this user
      const permissionsResponse = await apiClient.getModulePermissions(projectId);
      
      if (!permissionsResponse.success) {
        console.error('Error fetching permissions:', permissionsResponse.error);
        setLoading(false);
        return;
      }

      const userPermissions: ModulePermissions = {};
      const permissionsData = permissionsResponse.data || [];
      
      if (permissionsData.length > 0) {
        permissionsData.forEach((permission: any) => {
          userPermissions[permission.module] = permission.access_level as AccessLevel;
        });
      }

      setPermissions(userPermissions);
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (module: ModuleName, requiredAccess: AccessLevel = 'read'): boolean => {
    // During loading, deny access to prevent showing unauthorized modules
    if (loading) {
      return false;
    }
    
    if (isProjectOwner || isAdmin) {
      return true;
    }
    
    const modulePermission = permissions[module];
    
    if (!modulePermission) {
      return false;
    }
    
    if (requiredAccess === 'read') {
      return modulePermission === 'read' || modulePermission === 'write';
    }
    
    return modulePermission === 'write';
  };

  const canRead = (module: ModuleName): boolean => {
    return hasPermission(module, 'read');
  };
  
  const canWrite = (module: ModuleName): boolean => {
    return hasPermission(module, 'write');
  };

  return {
    permissions,
    isProjectOwner,
    isAdmin,
    loading,
    hasPermission,
    canRead,
    canWrite,
    refreshPermissions: checkPermissions,
  };
}