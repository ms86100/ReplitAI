import React, { useState, useEffect } from 'react';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MessageSquare, Plus, Edit2, Clock, CheckCircle, Trash2, Users, X, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface Discussion {
  id: string;
  meeting_title: string;
  meeting_date: string;
  summary_notes: string;
  attendees: any;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ActionItem {
  id: string;
  discussion_id: string;
  task_description: string;
  owner_id: string;
  target_date: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ChangeLogEntry {
  id: string;
  discussion_id: string;
  action_item_id?: string;
  change_type: string;
  field_name: string;
  old_value?: string;
  new_value?: string;
  changed_by: string;
  created_at: string;
}

interface Stakeholder {
  id: string;
  name: string;
  email: string;
}

interface ProjectMember {
  id: string;
  user_id: string;
  profiles?: {
    full_name: string;
    email: string;
  } | null;
}

interface DiscussionLogProps {
  projectId: string;
  projectName: string;
}

export function DiscussionLog({ projectId, projectName }: DiscussionLogProps) {
  const { user } = useApiAuth();
  const { toast } = useToast();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);
  const [showDiscussionDialog, setShowDiscussionDialog] = useState(false);
  const [showActionItemDialog, setShowActionItemDialog] = useState(false);
  const [editingDiscussion, setEditingDiscussion] = useState<Discussion | null>(null);
  const [editingActionItem, setEditingActionItem] = useState<ActionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('discussions');
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [discussionForm, setDiscussionForm] = useState({
    meeting_title: '',
    meeting_date: '',
    summary_notes: '',
    attendees: [] as string[]
  });

  const [actionItemForm, setActionItemForm] = useState({
    task_description: '',
    owner_id: '',
    target_date: '',
    status: 'open'
  });

  useEffect(() => {
    if (projectId) {
      fetchDiscussions();
      fetchActionItems();
      fetchChangeLog();
      fetchStakeholders();
      fetchProjectMembers();
    }
  }, [projectId]);

  const fetchDiscussions = async () => {
    try {
      const response = await apiClient.getDiscussions(projectId);
      
      if (response.success) {
        const discussionData = Array.isArray(response.data) 
          ? response.data 
          : (response.data && typeof response.data === 'object' && 'discussions' in response.data)
            ? (response.data as any).discussions || []
            : [];
        
        setDiscussions(discussionData);
      } else {
        console.error('❌ Error fetching discussions:', response.error);
        toast({
          title: 'Error',
          description: 'Failed to load discussions',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('❌ Error fetching discussions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load discussions',
        variant: 'destructive'
      });
    }
  };

  const fetchActionItems = async () => {
    try {
      const response = await apiClient.getActionItems(projectId);
      
      if (response.success) {
        const actionItemData = Array.isArray(response.data) 
          ? response.data 
          : (response.data && typeof response.data === 'object' && 'actionItems' in response.data)
            ? (response.data as any).actionItems || []
            : [];
        
        setActionItems(actionItemData);
      } else {
        console.error('❌ Error fetching action items:', response.error);
        toast({
          title: 'Error',
          description: 'Failed to load action items',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('❌ Error fetching action items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load action items',
        variant: 'destructive'
      });
    }
  };

  const fetchChangeLog = async () => {
    try {
      const response = await apiClient.getChangeLog(projectId);
      if (response.success) {
        setChangeLog(response.data || []);
      } else {
        console.error('Error fetching change log:', response.error);
        setChangeLog([]);
      }
    } catch (error) {
      console.error('Error fetching change log:', error);
      setChangeLog([]);
    }
  };

  const fetchStakeholders = async () => {
    try {
      const response = await apiClient.getStakeholders(projectId);
      
      if (response.success) {
        // Handle different response formats from stakeholder service
        const stakeholdersList = Array.isArray(response.data) ? response.data : response.data?.stakeholders || [];
        setStakeholders(stakeholdersList);
      } else {
        console.error('Error fetching stakeholders:', response.error);
      }
    } catch (error) {
      console.error('Error fetching stakeholders:', error);
    }
  };

  const fetchProjectMembers = async () => {
    try {
      const response = await apiClient.getProjectMembers(projectId);
      if (response.success) {
        setProjectMembers(response.data || []);
      } else {
        console.error('Error fetching project members:', response.error);
        setProjectMembers([]);
      }
    } catch (error) {
      console.error('Error fetching project members:', error);
      setProjectMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const resetDiscussionForm = () => {
    setDiscussionForm({
      meeting_title: '',
      meeting_date: '',
      summary_notes: '',
      attendees: []
    });
    setEditingDiscussion(null);
  };

  const resetActionItemForm = () => {
    setActionItemForm({
      task_description: '',
      owner_id: '',
      target_date: '',
      status: 'open'
    });
    setEditingActionItem(null);
  };

  const handleDiscussionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const discussionData = {
        ...discussionForm,
        attendees: discussionForm.attendees
      };

      if (editingDiscussion) {
        const response = await apiClient.updateDiscussion(projectId, editingDiscussion.id, discussionData);
        
        if (response.success) {
          toast({
            title: 'Success',
            description: 'Discussion updated successfully'
          });
        } else {
          throw new Error(response.error || 'Failed to update discussion');
        }
      } else {
        const response = await apiClient.createDiscussion(projectId, discussionData);
        
        if (response.success) {
          toast({
            title: 'Success',
            description: 'Discussion created successfully'
          });
        } else {
          throw new Error(response.error || 'Failed to create discussion');
        }
      }

      setShowDiscussionDialog(false);
      resetDiscussionForm();
      fetchDiscussions();
    } catch (error) {
      console.error('Error saving discussion:', error);
      toast({
        title: 'Error',
        description: 'Failed to save discussion',
        variant: 'destructive'
      });
    }
  };

  const handleActionItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDiscussion || !actionItemForm.task_description.trim()) return;

    try {
      const actionItemData = {
        ...actionItemForm,
        discussion_id: selectedDiscussion.id,
      };

      if (editingActionItem) {
        const response = await apiClient.updateActionItem(projectId, editingActionItem.id, actionItemData);
        
        if (response.success) {
          toast({
            title: 'Success',
            description: 'Action item updated successfully'
          });
        } else {
          throw new Error(response.error || 'Failed to update action item');
        }
      } else {
        const response = await apiClient.createActionItem(projectId, actionItemData);
        
        if (response.success) {
          toast({
            title: 'Success',
            description: 'Action item created successfully'
          });
        } else {
          throw new Error(response.error || 'Failed to create action item');
        }
      }

      setShowActionItemDialog(false);
      resetActionItemForm();
      fetchActionItems();
    } catch (error) {
      console.error('Error saving action item:', error);
      toast({
        title: 'Error',
        description: 'Failed to save action item',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteDiscussion = async (discussionId: string) => {
    try {
      const response = await apiClient.deleteDiscussion(projectId, discussionId);

      if (response.success) {
        toast({
          title: 'Success',
          description: 'Discussion deleted successfully'
        });
        
        fetchDiscussions();
        if (selectedDiscussion?.id === discussionId) {
          setSelectedDiscussion(null);
        }
      } else {
        throw new Error(response.error || 'Failed to delete discussion');
      }
    } catch (error) {
      console.error('Error deleting discussion:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete discussion',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteActionItem = async (actionItemId: string) => {
    try {
      const response = await apiClient.deleteActionItem(projectId, actionItemId);

      if (response.success) {
        toast({
          title: 'Success',
          description: 'Action item deleted successfully'
        });
        
        fetchActionItems();
      } else {
        throw new Error(response.error || 'Failed to delete action item');
      }
    } catch (error) {
      console.error('Error deleting action item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete action item',
        variant: 'destructive'
      });
    }
  };

  const convertToBacklog = async (actionItem: ActionItem) => {
    if (!user) return;

    try {
      const backlogData = {
        title: actionItem.task_description,
        description: `Converted from action item - Discussion: ${selectedDiscussion?.meeting_title}`,
        ownerId: actionItem.owner_id || undefined,
        targetDate: actionItem.target_date || undefined,
        priority: 'medium',
        sourceType: 'action_item',
        sourceId: actionItem.id
      };

      const response = await apiClient.createBacklogItem(projectId, backlogData);

      if (response.success) {
        toast({
          title: 'Success',
          description: 'Action item converted to backlog item successfully'
        });
        
        // Mark the action item as completed
        await apiClient.updateActionItem(projectId, actionItem.id, { status: 'completed' });
        fetchActionItems();
      } else {
        throw new Error(response.error || 'Failed to convert action item');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to convert action item to backlog',
        variant: 'destructive'
      });
    }
  };

  const openEditDiscussion = (discussion: Discussion) => {
    setEditingDiscussion(discussion);
    setDiscussionForm({
      meeting_title: discussion.meeting_title,
      meeting_date: discussion.meeting_date,
      summary_notes: discussion.summary_notes,
      attendees: Array.isArray(discussion.attendees) ? discussion.attendees : []
    });
    setShowDiscussionDialog(true);
  };

  const openEditActionItem = (actionItem: ActionItem) => {
    setEditingActionItem(actionItem);
    setActionItemForm({
      task_description: actionItem.task_description,
      owner_id: actionItem.owner_id || '',
      target_date: actionItem.target_date || '',
      status: actionItem.status
    });
    setShowActionItemDialog(true);
  };

  const getAttendeeOptions = () => {
    const options: { value: string; label: string }[] = [];
    
    stakeholders.forEach(stakeholder => {
      options.push({
        value: stakeholder.id,
        label: `${stakeholder.name} (${stakeholder.email || 'No email'})`
      });
    });
    
    projectMembers.forEach(member => {
      if (member.profiles) {
        options.push({
          value: member.user_id,
          label: `${member.profiles.full_name || 'Unknown'} (${member.profiles.email || 'No email'})`
        });
      }
    });
    
    return options;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Discussion Log</h1>
          <p className="text-muted-foreground">Manage project discussions for {projectName}</p>
        </div>
        <Dialog open={showDiscussionDialog} onOpenChange={setShowDiscussionDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetDiscussionForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Discussion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingDiscussion ? 'Edit Discussion' : 'Create Discussion'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleDiscussionSubmit} className="space-y-4">
              <div>
                <Label htmlFor="meeting_title">Meeting Title</Label>
                <Input
                  id="meeting_title"
                  value={discussionForm.meeting_title}
                  onChange={(e) => setDiscussionForm(prev => ({ ...prev, meeting_title: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="meeting_date">Meeting Date</Label>
                <Input
                  id="meeting_date"
                  type="date"
                  value={discussionForm.meeting_date}
                  onChange={(e) => setDiscussionForm(prev => ({ ...prev, meeting_date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="summary_notes">Summary Notes</Label>
                <Textarea
                  id="summary_notes"
                  value={discussionForm.summary_notes}
                  onChange={(e) => setDiscussionForm(prev => ({ ...prev, summary_notes: e.target.value }))}
                  rows={4}
                />
              </div>
              <div>
                <Label>Meeting Attendees</Label>
                <div className="border rounded-lg p-4 space-y-3 max-h-48 overflow-y-auto">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Stakeholders</div>
                  {stakeholders.map((stakeholder) => (
                    <div key={`stakeholder-${stakeholder.id}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`stakeholder-${stakeholder.id}`}
                        checked={discussionForm.attendees.includes(stakeholder.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setDiscussionForm(prev => ({
                              ...prev,
                              attendees: [...prev.attendees, stakeholder.id]
                            }));
                          } else {
                            setDiscussionForm(prev => ({
                              ...prev,
                              attendees: prev.attendees.filter(id => id !== stakeholder.id)
                            }));
                          }
                        }}
                      />
                      <Label 
                        htmlFor={`stakeholder-${stakeholder.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {stakeholder.name} ({stakeholder.email})
                      </Label>
                    </div>
                  ))}
                  
                  <div className="text-sm font-medium text-muted-foreground mb-2 mt-4">Project Members</div>
                  {projectMembers.map((member) => (
                    <div key={`member-${member.user_id}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`member-${member.user_id}`}
                        checked={discussionForm.attendees.includes(member.user_id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setDiscussionForm(prev => ({
                              ...prev,
                              attendees: [...prev.attendees, member.user_id]
                            }));
                          } else {
                            setDiscussionForm(prev => ({
                              ...prev,
                              attendees: prev.attendees.filter(id => id !== member.user_id)
                            }));
                          }
                        }}
                      />
                      <Label 
                        htmlFor={`member-${member.user_id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {member.profiles?.full_name || 'Unknown'} ({member.profiles?.email || 'No email'})
                      </Label>
                    </div>
                  ))}
                  
                  {stakeholders.length === 0 && projectMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No stakeholders or project members found. Add some to select attendees.
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Selected: {discussionForm.attendees.length} attendee(s)
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowDiscussionDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingDiscussion ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="discussions">Discussions</TabsTrigger>
          <TabsTrigger value="action-items">Action Items</TabsTrigger>
          <TabsTrigger value="change-log">Change Log</TabsTrigger>
        </TabsList>

        <TabsContent value="discussions">
          {/* Search */}
          <div className="flex items-center gap-4 mb-6">
            <Input
              placeholder="Search discussions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          
          <div className="grid gap-4">
            {discussions
              .filter(discussion =>
                discussion.meeting_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                discussion.summary_notes?.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((discussion) => (
              <Card key={discussion.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      {discussion.meeting_title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDiscussion(discussion);
                          setActiveTab('action-items');
                        }}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDiscussion(discussion)}
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
                            <AlertDialogTitle>Delete Discussion</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this discussion? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteDiscussion(discussion.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(discussion.meeting_date), 'PPP')}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{discussion.summary_notes}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="action-items">
          <div className="space-y-4">
            {selectedDiscussion && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Action Items for: {selectedDiscussion.meeting_title}</CardTitle>
                    <Dialog open={showActionItemDialog} onOpenChange={setShowActionItemDialog}>
                      <DialogTrigger asChild>
                        <Button onClick={resetActionItemForm}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Action Item
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>
                            {editingActionItem ? 'Edit Action Item' : 'Create Action Item'}
                          </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleActionItemSubmit} className="space-y-4">
                          <div>
                            <Label htmlFor="task_description">Task Description</Label>
                            <Textarea
                              id="task_description"
                              value={actionItemForm.task_description}
                              onChange={(e) => setActionItemForm(prev => ({ ...prev, task_description: e.target.value }))}
                              rows={3}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="owner_id">Owner</Label>
                            <Select 
                              value={actionItemForm.owner_id} 
                              onValueChange={(value) => setActionItemForm(prev => ({ ...prev, owner_id: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select owner" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAttendeeOptions().map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="target_date">Target Date</Label>
                            <Input
                              id="target_date"
                              type="date"
                              value={actionItemForm.target_date}
                              onChange={(e) => setActionItemForm(prev => ({ ...prev, target_date: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="status">Status</Label>
                            <Select 
                              value={actionItemForm.status} 
                              onValueChange={(value) => setActionItemForm(prev => ({ ...prev, status: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="blocked">Blocked</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setShowActionItemDialog(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">
                              {editingActionItem ? 'Update' : 'Create'}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Search for action items */}
                  <div className="flex items-center gap-4 mb-4">
                    <Input
                      placeholder="Search action items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    {actionItems
                      .filter(item => item.discussion_id === selectedDiscussion.id)
                      .filter(item =>
                        item.task_description.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((actionItem) => (
                        <div key={actionItem.id} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex-1">
                            <p className="font-medium">{actionItem.task_description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={actionItem.status === 'completed' ? 'default' : 'secondary'}>
                                {actionItem.status === 'completed' ? (
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                ) : (
                                  <Clock className="h-3 w-3 mr-1" />
                                )}
                                {actionItem.status}
                              </Badge>
                              {actionItem.target_date && (
                                <span className="text-sm text-muted-foreground">
                                  Due: {format(new Date(actionItem.target_date), 'PPP')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {actionItem.status !== 'completed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => convertToBacklog(actionItem)}
                                title="Convert to Backlog Item"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            )}
                            {actionItem.status === 'completed' && (
                              <Badge variant="secondary" className="text-xs">
                                Converted
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditActionItem(actionItem)}
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
                                  <AlertDialogTitle>Delete Action Item</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this action item? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteActionItem(actionItem.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {!selectedDiscussion && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a discussion to view its action items</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="change-log">
          <Card>
            <CardHeader>
              <CardTitle>Change Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {changeLog.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 p-3 border rounded">
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{entry.change_type}</span> - {entry.field_name}
                      </p>
                      {entry.old_value && entry.new_value && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Changed from "{entry.old_value}" to "{entry.new_value}"
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), 'PPp')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}