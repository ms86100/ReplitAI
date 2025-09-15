import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Trash2, Shield, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';

interface ModulePermission {
  id: string;
  user_id: string;
  module: string;
  access_level: 'read' | 'write';
  granted_by: string;
  user_email?: string;
}

interface AccessControlDialogProps {
  projectId: string;
  trigger?: React.ReactNode;
}

const MODULES = [
  { value: 'budget', label: 'Budget' },
  { value: 'tasks', label: 'Tasks & Milestones' },
  { value: 'roadmap', label: 'Roadmap' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'stakeholders', label: 'Stakeholders' },
  { value: 'risks', label: 'Risk Register' },
  { value: 'discussions', label: 'Discussions' },
  { value: 'backlog', label: 'Task Backlog' },
  { value: 'capacity', label: 'Team Capacity' },
  { value: 'retrospective', label: 'Retrospectives' },
  { value: 'access_control', label: 'Access Control' },
];

export function AccessControlDialog({ projectId, trigger }: AccessControlDialogProps) {
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedAccess, setSelectedAccess] = useState<'read' | 'write'>('read');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPermissions();
    }
  }, [open, projectId]);

  const fetchPermissions = async () => {
    try {
      const response = await apiClient.getModulePermissions(projectId);
      
      if (!response.success) {
        toast({
          title: "Error",
          description: response.error || "Failed to fetch permissions",
          variant: "destructive",
        });
        return;
      }

      // Ensure we always set an array, even if the API returns something else
      const permissionsData = response.data;
      setPermissions(Array.isArray(permissionsData) ? permissionsData : []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([]); // Ensure permissions is always an array
      toast({
        title: "Error",
        description: "Failed to fetch permissions",
        variant: "destructive",
      });
    }
  };

  const inviteUser = async () => {
    if (!userEmail || !selectedModule) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.grantModulePermission({
        projectId: projectId,
        userEmail: userEmail,
        module: selectedModule,
        accessLevel: selectedAccess,
      });

      if (!response.success) {
        toast({
          title: "Error",
          description: response.error || "Failed to grant permission",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Success",
        description: `${selectedAccess} access granted to ${userEmail} for ${selectedModule}`,
      });

      setUserEmail('');
      setSelectedModule('');
      setSelectedAccess('read');
      fetchPermissions();
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removePermission = async (permissionId: string) => {
    try {
      const response = await apiClient.revokeModulePermission(permissionId);

      if (!response.success) {
        toast({
          title: "Error",
          description: response.error || "Failed to remove permission",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Permission removed",
      });

      fetchPermissions();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove permission",
        variant: "destructive",
      });
    }
  };

  const groupedPermissions = (permissions || []).reduce((acc, permission) => {
    if (!acc[permission.user_email!]) {
      acc[permission.user_email!] = [];
    }
    acc[permission.user_email!].push(permission);
    return acc;
  }, {} as Record<string, ModulePermission[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Shield className="h-4 w-4 mr-2" />
            Manage Access
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Access Control</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invite User Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Invite Collaborator
              </CardTitle>
              <CardDescription>
                Grant module-level access to team members
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="email">User Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Module</Label>
                  <Select value={selectedModule} onValueChange={setSelectedModule}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select module" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODULES.map(module => (
                        <SelectItem key={module.value} value={module.value}>
                          {module.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Access Level</Label>
                  <Select value={selectedAccess} onValueChange={(value) => setSelectedAccess(value as 'read' | 'write')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read Only</SelectItem>
                      <SelectItem value="write">Read & Write</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={inviteUser} disabled={loading}>
                Grant Access
              </Button>
            </CardContent>
          </Card>

          {/* Current Permissions */}
          <Card>
            <CardHeader>
              <CardTitle>Current Permissions</CardTitle>
              <CardDescription>
                Manage existing collaborator access
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(groupedPermissions).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No collaborators have been granted access yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([email, userPermissions]) => (
                    <div key={email} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{email}</h4>
                        <Badge variant="secondary">
                          {userPermissions.length} module{userPermissions.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {userPermissions.map(permission => (
                          <div key={permission.id} className="flex items-center justify-between bg-muted/50 rounded p-2">
                            <div className="flex items-center gap-2">
                              {permission.access_level === 'write' ? (
                                <Shield className="h-4 w-4 text-primary" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">
                                {MODULES.find(m => m.value === permission.module)?.label || permission.module}
                              </span>
                              <Badge variant={permission.access_level === 'write' ? 'default' : 'secondary'} className="text-xs">
                                {permission.access_level}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePermission(permission.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}