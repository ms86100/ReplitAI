import { useState, useEffect } from "react";
import { apiClient } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SimpleSelect, SimpleSelectItem } from "@/components/ui/simple-select";
import { Badge } from "@/components/ui/badge";

interface Department {
  id: string;
  name: string;
}

interface DepartmentSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onDepartmentAssigned: () => void;
}

export default function DepartmentSelectionDialog({
  isOpen,
  onClose,
  userId,
  onDepartmentAssigned,
}: DepartmentSelectionDialogProps) {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
    }
  }, [isOpen]);

  const fetchDepartments = async () => {
    try {
      const response = await apiClient.getDepartments();
      if (response.success && response.data) {
        setDepartments(Array.isArray(response.data) ? response.data : response.data.departments || []);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast({
        title: "Error",
        description: "Failed to fetch departments",
        variant: "destructive",
      });
    }
  };

  const assignDepartment = async () => {
    if (!selectedDepartmentId) {
      toast({
        title: "Error",
        description: "Please select a department",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.assignUserDepartment(userId, selectedDepartmentId);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to assign department");
      }

      toast({
        title: "Success",
        description: "Department assigned successfully",
      });
      
      onDepartmentAssigned();
      onClose();
    } catch (error: any) {
      console.error("Error assigning department:", error);
      toast({
        title: "Error",
        description: "Failed to assign department",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="dept-dialog-description">
        <DialogHeader>
          <DialogTitle>Select Your Department</DialogTitle>
          <DialogDescription id="dept-dialog-description">
            You must select a department before you can create projects. Please choose from the available departments below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {departments.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">No departments available.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please contact an administrator to create departments.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-sm font-medium">Available Departments:</label>
              <SimpleSelect value={selectedDepartmentId} onValueChange={setSelectedDepartmentId} placeholder="Select a department">
                {departments.map((department) => (
                  <SimpleSelectItem key={department.id} value={department.id}>
                    <Badge variant="outline" className="mr-2">
                      {department.name}
                    </Badge>
                  </SimpleSelectItem>
                ))}
              </SimpleSelect>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={assignDepartment}
            disabled={loading || !selectedDepartmentId || departments.length === 0}
            className="w-full"
          >
            {loading ? "Assigning..." : "Assign Department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}