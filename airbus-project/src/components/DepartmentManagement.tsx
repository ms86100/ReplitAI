import { useState, useEffect } from "react";
import { useApiAuth } from "@/hooks/useApiAuth";
import { apiClient } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Department {
  id: string;
  name: string;
  created_at: string;
}

export default function DepartmentManagement() {
  const { user } = useApiAuth();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserRole();
    }
  }, [user]);

  useEffect(() => {
    if (userRole === "admin") {
      fetchDepartments();
    }
  }, [userRole]);

  const fetchUserRole = async () => {
    if (!user) return;
    
    try {
      const response = await apiClient.getUserRole(user.id);
      
      if (response.success) {
        setUserRole(response.data?.role || null);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await apiClient.getDepartments();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch departments');
      }
      
      setDepartments(Array.isArray(response.data) ? response.data : response.data?.departments || []);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch departments",
        variant: "destructive",
      });
    }
  };

  const createDepartment = async () => {
    if (!newDepartmentName.trim()) {
      toast({
        title: "Error",
        description: "Department name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.createDepartment(newDepartmentName.trim());

      if (!response.success) {
        throw new Error(response.error || 'Failed to create department');
      }

      toast({
        title: "Success",
        description: "Department created successfully",
      });
      
      setNewDepartmentName("");
      fetchDepartments();
    } catch (error: any) {
      console.error("Error creating department:", error);
      toast({
        title: "Error",
        description: error.message?.includes("already exists") 
          ? "Department name already exists" 
          : error.message || "Failed to create department",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this department?")) {
      return;
    }

    try {
      const response = await apiClient.deleteDepartment(id);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete department');
      }

      toast({
        title: "Success",
        description: "Department deleted successfully",
      });
      
      fetchDepartments();
    } catch (error: any) {
      console.error("Error deleting department:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete department",
        variant: "destructive",
      });
    }
  };

  if (userRole !== "admin") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Access denied. Admin role required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Department Management</CardTitle>
          <CardDescription>
            Create and manage departments for project coordinators
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Department name"
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && createDepartment()}
            />
            <Button 
              onClick={createDepartment} 
              disabled={loading}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Departments ({departments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-muted-foreground">No departments created yet.</p>
          ) : (
            <div className="space-y-2">
              {departments.map((department) => (
                <div
                  key={department.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{department.name}</Badge>
                    <span className="text-sm text-muted-foreground">
                      Created {new Date(department.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteDepartment(department.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}