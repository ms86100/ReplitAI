import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/services/api';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useToast } from '@/hooks/use-toast';

interface AddTaskFromBacklogDialogProps {
  milestoneId: string;
  projectId: string;
  onTaskAdded: () => void;
}

interface BacklogItem {
  id: string;
  title: string;
  description: string;
  priority: string;
  owner_id: string;
  target_date: string;
  status: string;
}

export function AddTaskFromBacklogDialog({ milestoneId, projectId, onTaskAdded }: AddTaskFromBacklogDialogProps) {
  const { user } = useApiAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchBacklogItems();
    }
  }, [isOpen, projectId]);

  const fetchBacklogItems = async () => {
    try {
      const response = await apiClient.getBacklog(projectId);
      if (response.success && response.data?.items) {
        // Filter out items that have been moved to tasks (status: 'done')
        const availableItems = response.data.items.filter((item: BacklogItem) => item.status !== 'done');
        setBacklogItems(availableItems);
      }
    } catch (error) {
      console.error('Error fetching backlog items:', error);
    }
  };

  const handleAddTasks = async () => {
    if (!user || selectedItems.length === 0) return;

    try {
      // Use the API to move backlog items to tasks in milestone
      for (const itemId of selectedItems) {
        const response = await apiClient.moveBacklogToMilestone(projectId, itemId, milestoneId);
        if (!response.success) {
          throw new Error(response.error || 'Failed to move backlog item');
        }
      }
      
      toast({
        title: 'Success',
        description: `${selectedItems.length} task(s) added to milestone from backlog`
      });
      
      setSelectedItems([]);
      setIsOpen(false);
      onTaskAdded();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to add tasks from backlog',
        variant: 'destructive'
      });
    }
  };

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Task from Backlog
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Tasks from Backlog</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {backlogItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No items in backlog</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {backlogItems.map((item) => (
                  <Card key={item.id} className={`cursor-pointer transition-colors ${
                    selectedItems.includes(item.id) ? 'bg-muted' : ''
                  }`}>
                    <CardHeader 
                      className="py-3"
                      onClick={() => handleItemToggle(item.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleItemToggle(item.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">{item.title}</CardTitle>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={getPriorityBadgeVariant(item.priority)}>
                              {item.priority}
                            </Badge>
                            {item.target_date && (
                              <span className="text-xs text-muted-foreground">
                                Due: {new Date(item.target_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedItems.length} item(s) selected
                </span>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddTasks}
                    disabled={selectedItems.length === 0}
                  >
                    Add {selectedItems.length} Task(s)
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}