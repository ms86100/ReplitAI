import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ArrowRight, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SimpleSelect, SimpleSelectItem } from '@/components/ui/simple-select';
import { apiClient } from '@/services/api';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useToast } from '@/hooks/use-toast';

interface TaskBacklogProps {
  projectId: string;
}

interface BacklogItem {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  owner_id: string;
  target_date: string;
  source_type: string;
  source_id: string;
  created_at: string;
  updated_at: string;
}

interface Stakeholder {
  id: string;
  name: string;
  email?: string;
  department?: string;
}

interface Milestone {
  id: string;
  name: string;
  status: string;
}

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
];

export function TaskBacklog({ projectId }: TaskBacklogProps) {
  const { user } = useApiAuth();
  const { toast } = useToast();
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);
  const [movingItem, setMovingItem] = useState<BacklogItem | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    owner_id: '',
    target_date: ''
  });

  const [selectedMilestone, setSelectedMilestone] = useState('');

  useEffect(() => {
    fetchBacklogItems();
    fetchStakeholders();
    fetchMilestones();
  }, [projectId]);

  const fetchBacklogItems = async () => {
    try {
      const response = await apiClient.getBacklog(projectId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch backlog items');
      }
      setBacklogItems(response.data.items || []);
    } catch (error) {
      console.error('Error fetching backlog items:', error);
    }
  };

  const fetchStakeholders = async () => {
    try {
      const response = await apiClient.getStakeholders(projectId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch stakeholders');
      }
      setStakeholders(response.data.stakeholders || []);
    } catch (error) {
      console.error('Error fetching stakeholders:', error);
    }
  };

  const fetchMilestones = async () => {
    try {
      const response = await apiClient.getRoadmap(projectId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch milestones');
      }
      // Extract milestones from roadmap response
      setMilestones(response.data.milestones || []);
    } catch (error) {
      console.error('Error fetching milestones:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title.trim()) return;

    try {
      const response = await apiClient.createBacklogItem(projectId, {
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        ownerId: formData.owner_id || undefined,
        targetDate: formData.target_date || undefined,
        sourceType: 'manual'
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to create backlog item');
      }
      
      toast({
        title: 'Success',
        description: 'Backlog item created successfully'
      });
      
      resetForm();
      fetchBacklogItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to create backlog item',
        variant: 'destructive'
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !formData.title.trim()) return;

    try {
      const response = await apiClient.updateBacklogItem(projectId, editingItem.id, {
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        ownerId: formData.owner_id || undefined,
        targetDate: formData.target_date || undefined
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update backlog item');
      }
      
      toast({
        title: 'Success',
        description: 'Backlog item updated successfully'
      });
      
      setShowEditDialog(false);
      setEditingItem(null);
      resetForm();
      fetchBacklogItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update backlog item',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      const response = await apiClient.deleteBacklogItem(projectId, itemId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete backlog item');
      }
      
      toast({
        title: 'Success',
        description: 'Backlog item deleted successfully'
      });
      
      fetchBacklogItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete backlog item',
        variant: 'destructive'
      });
    }
  };

  const handleMoveToMilestone = async () => {
    if (!movingItem || !selectedMilestone || !user) return;

    try {
      const response = await apiClient.moveBacklogToMilestone(projectId, movingItem.id, selectedMilestone);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to move item to milestone');
      }
      
      toast({
        title: 'Success',
        description: 'Item moved to milestone successfully'
      });
      
      setShowMoveDialog(false);
      setMovingItem(null);
      setSelectedMilestone('');
      fetchBacklogItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to move item to milestone',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      owner_id: '',
      target_date: ''
    });
    setShowAddDialog(false);
  };

  const openEditDialog = (item: BacklogItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      priority: item.priority,
      owner_id: item.owner_id || '',
      target_date: item.target_date || ''
    });
    setShowEditDialog(true);
  };

  const openMoveDialog = (item: BacklogItem) => {
    setMovingItem(item);
    setShowMoveDialog(true);
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

  const getStakeholderName = (ownerId: string) => {
    const stakeholder = stakeholders.find(s => s.id === ownerId);
    return stakeholder?.name || 'Unknown';
  };

  const filteredBacklogItems = backlogItems.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Task Backlog</h2>
          <p className="text-muted-foreground">Manage your project backlog and move items to milestones</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Backlog Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add Backlog Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter item title"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter item description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <SimpleSelect
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                    placeholder="Select priority"
                  >
                    {priorityOptions.map(option => (
                      <SimpleSelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SimpleSelectItem>
                    ))}
                  </SimpleSelect>
                </div>
                <div>
                  <Label htmlFor="owner">Owner</Label>
                  <SimpleSelect
                    value={formData.owner_id}
                    onValueChange={(value) => setFormData({ ...formData, owner_id: value })}
                    placeholder="Select owner"
                  >
                    <SimpleSelectItem value="">No owner assigned</SimpleSelectItem>
                    {stakeholders.map(stakeholder => (
                      <SimpleSelectItem key={stakeholder.id} value={stakeholder.id}>
                        {stakeholder.name}
                      </SimpleSelectItem>
                    ))}
                  </SimpleSelect>
                </div>
              </div>
              <div>
                <Label htmlFor="target_date">Target Date</Label>
                <Input
                  id="target_date"
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">Add Item</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search backlog items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-4">
        {filteredBacklogItems.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Badge variant={getPriorityBadgeVariant(item.priority)}>
                      {item.priority}
                    </Badge>
                    {item.source_type === 'action_item' && (
                      <Badge variant="outline">From Discussion</Badge>
                    )}
                    {item.source_type === 'retrospective' && (
                      <Badge variant="outline">Converted from Retrospective</Badge>
                    )}
                    {item.target_date && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.target_date).toLocaleDateString()}
                      </div>
                    )}
                    {item.owner_id && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {getStakeholderName(item.owner_id)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openMoveDialog(item)}
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Move to Milestone
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(item)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Backlog Item</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this backlog item? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(item.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        
        {filteredBacklogItems.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? 'No backlog items found matching your search.' : 'No backlog items yet. Create your first item to get started.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Backlog Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter item title"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter item description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-priority">Priority</Label>
                <SimpleSelect
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  placeholder="Select priority"
                >
                  {priorityOptions.map(option => (
                    <SimpleSelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SimpleSelectItem>
                  ))}
                </SimpleSelect>
              </div>
              <div>
                <Label htmlFor="edit-owner">Owner</Label>
                <SimpleSelect
                  value={formData.owner_id}
                  onValueChange={(value) => setFormData({ ...formData, owner_id: value })}
                  placeholder="Select owner"
                >
                  <SimpleSelectItem value="">No owner assigned</SimpleSelectItem>
                  {stakeholders.map(stakeholder => (
                    <SimpleSelectItem key={stakeholder.id} value={stakeholder.id}>
                      {stakeholder.name}
                    </SimpleSelectItem>
                  ))}
                </SimpleSelect>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-target-date">Target Date</Label>
              <Input
                id="edit-target-date"
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Item</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move to Milestone Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Milestone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a milestone to move "{movingItem?.title}" to:
            </p>
            <div>
              <Label htmlFor="milestone">Milestone</Label>
              <SimpleSelect
                value={selectedMilestone}
                onValueChange={setSelectedMilestone}
                placeholder="Select milestone"
              >
                {milestones.map(milestone => (
                  <SimpleSelectItem key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </SimpleSelectItem>
                ))}
              </SimpleSelect>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowMoveDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleMoveToMilestone}
                disabled={!selectedMilestone}
              >
                Move to Milestone
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
