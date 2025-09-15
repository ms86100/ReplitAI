import React, { useState, useEffect } from 'react';
import { useApiAuth } from '@/hooks/useApiAuth';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Shield } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ModulePermission {
  id: string;
  project_id: string;
  project_name: string;
  user_id: string;
  user_email: string;
  module: string;
  access_level: 'read' | 'write';
  granted_by: string;
  created_at: string;
}

interface ProjectAccessControlProps {
  projectId: string;
}

const MODULES = [
  { name: 'budget', label: 'Budget' },
  { name: 'tasks', label: 'Tasks & Milestones' },
  { name: 'roadmap', label: 'Roadmap' },
  { name: 'kanban', label: 'Kanban' },
  { name: 'stakeholders', label: 'Stakeholders' },
  { name: 'risks', label: 'Risk Register' },
  { name: 'discussions', label: 'Discussions' },
  { name: 'backlog', label: 'Task Backlog' },
  { name: 'capacity', label: 'Team Capacity' },
  { name: 'retrospective', label: 'Retrospectives' },
  { name: 'access_control', label: 'Access Control' },
];

export function ProjectAccessControl({ projectId }: ProjectAccessControlProps) {
  const { user } = useApiAuth();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedAccess, setSelectedAccess] = useState<'read' | 'write'>('read');

  useEffect(() => {
    if (user && projectId) {
      fetchPermissions();
    }
  }, [user, projectId]);

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

  const grantAccess = async () => {
    if (!userEmail || selectedModules.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in user email and select at least one module",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Grant access for each selected module using the API
      const permissionPromises = selectedModules.map(module => 
        apiClient.grantModulePermission({
          projectId: projectId,
          userEmail: userEmail,
          module,
          accessLevel: selectedAccess,
        })
      );

      const results = await Promise.all(permissionPromises);
      const errors = results.filter(result => !result.success);
      
      if (errors.length > 0) {
        throw new Error(`Failed to grant access to ${errors.length} modules`);
      }

      toast({
        title: "Success",
        description: "Access granted successfully",
      });

      // Reset form
      setUserEmail('');
      setSelectedModules([]);
      setSelectedAccess('read');

      // Refresh permissions
      fetchPermissions();
    } catch (error) {
      console.error('Error granting access:', error);
      toast({
        title: "Error",
        description: "Failed to grant access",
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
        throw new Error(response.error || 'Failed to remove permission');
      }

      toast({
        title: "Success",
        description: "Permission removed successfully",
      });

      fetchPermissions();
    } catch (error) {
      console.error('Error removing permission:', error);
      toast({
        title: "Error",
        description: "Failed to remove permission",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold">Project Access Control</h1>
      </div>

      {/* Grant Access Form */}
      <Card>
        <CardHeader>
          <CardTitle>Grant Module Access</CardTitle>
          <CardDescription>
            Invite collaborators and assign specific module permissions for this project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="User email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
            />
            <Select value={selectedAccess} onValueChange={(value: 'read' | 'write') => setSelectedAccess(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="write">Write</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select Modules</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {MODULES.map((module) => (
                <div key={module.name} className="flex items-center space-x-2">
                  <Checkbox
                    id={module.name}
                    checked={selectedModules.includes(module.name)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedModules([...selectedModules, module.name]);
                      } else {
                        setSelectedModules(selectedModules.filter(m => m !== module.name));
                      }
                    }}
                  />
                  <Label 
                    htmlFor={module.name}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {module.label}
                  </Label>
                </div>
              ))}
            </div>
            {selectedModules.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedModules.map(module => (
                  <Badge key={module} variant="secondary">
                    {MODULES.find(m => m.name === module)?.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button onClick={grantAccess} disabled={loading} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Grant Access to {selectedModules.length} Module{selectedModules.length !== 1 ? 's' : ''}
          </Button>
        </CardContent>
      </Card>

      {/* Current Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Current Project Permissions</CardTitle>
          <CardDescription>
            Manage existing module permissions for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Email</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Access Level</TableHead>
                <TableHead>Granted Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(permissions || []).map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">{permission.user_email}</TableCell>
                  <TableCell>
                    {MODULES.find(m => m.name === permission.module)?.label || permission.module}
                  </TableCell>
                  <TableCell>
                    <Badge variant={permission.access_level === 'write' ? 'default' : 'secondary'}>
                      {permission.access_level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(permission.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removePermission(permission.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {permissions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No permissions granted yet for this project
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}