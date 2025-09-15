import React, { useState, useEffect } from 'react';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SimpleSelect, SimpleSelectItem } from '@/components/ui/simple-select';
import { Badge } from '@/components/ui/badge';
import { Plus, Target, Calendar, BarChart3, Trash2, MoreHorizontal, TrendingUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { InteractiveRetrospectiveBoard } from './InteractiveRetrospectiveBoard';
import { RetrospectiveAnalytics } from './RetrospectiveAnalytics';
import { EnhancedRetrospectiveAnalytics } from './EnhancedRetrospectiveAnalytics';

interface RetrospectiveViewProps {
  projectId: string;
}


interface Retrospective {
  id: string;
  iteration_id: string;
  framework: string;
  project_id: string;
  created_by: string;
  status: string;
  created_at?: string;
}

interface RetrospectiveColumn {
  id: string;
  retrospective_id: string;
  title: string;
  subtitle?: string;
  column_order: number;
  cards?: RetrospectiveCardData[];
}

interface RetrospectiveCardData {
  id: string;
  column_id: string;
  text: string;
  votes: number;
  card_order: number;
  created_by: string;
  created_at?: string;
}

interface Stakeholder {
  id: string;
  name: string;
  email?: string;
  department?: string;
  raci?: string;
  influence_level?: string;
  notes?: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface ActionItem {
  id: string;
  retrospective_id: string;
  from_card_id: string;
  what_task: string;
  when_sprint: string;
  who_responsible: string;
  how_approach: string;
  backlog_ref_id: string;
  backlog_status: string;
  converted_to_task: boolean;
  task_id: string | null;
  created_at?: string;
}

interface CardVote {
  id: string;
  card_id: string;
  user_id: string;
  created_at: string;
}

export const FRAMEWORK_TEMPLATES = {
  classic: {
    name: "Classic",
    description: "A structured reflection on what worked, what didn't, and what to change.",
    columns: [
      { title: "What went well?", subtitle: "Things that worked successfully" },
      { title: "What could have been better?", subtitle: "Areas for improvement" },
      { title: "What will we do differently?", subtitle: "Actions to take next time" }
    ]
  },
  "4ls": {
    name: "4Ls", 
    description: "Captures knowledge and improvement areas: liked, learned, lacked, longed for.",
    columns: [
      { title: "Liked", subtitle: "What did we like?" },
      { title: "Learned", subtitle: "What did we learn?" },
      { title: "Lacked", subtitle: "What was missing or lacking?" },
      { title: "Longed For", subtitle: "What did we long for?" }
    ]
  },
  kiss: {
    name: "KISS",
    description: "Keep, Improve, Start, Stop — a straightforward way to analyze team practices.",
    columns: [
      { title: "Keep", subtitle: "What should we continue doing?" },
      { title: "Improve", subtitle: "What could be improved?" },
      { title: "Start", subtitle: "What should we try next?" },
      { title: "Stop", subtitle: "What should we avoid?" }
    ]
  },
  sailboat: {
    name: "Sailboat",
    description: "Visualizes team journey with metaphorical elements: wind, anchors, rocks, and island.",
    columns: [
      { title: "Wind", subtitle: "Things pushing the team forward" },
      { title: "Anchor", subtitle: "Things holding the team back" },
      { title: "Rocks", subtitle: "Risks or obstacles ahead" },
      { title: "Island", subtitle: "Goals or desired state" }
    ]
  },
  mad_sad_glad: {
    name: "Mad / Sad / Glad",
    description: "Focuses on emotional reflections of the sprint.",
    columns: [
      { title: "Mad", subtitle: "What frustrated us?" },
      { title: "Sad", subtitle: "What disappointed us?" },
      { title: "Glad", subtitle: "What made us happy?" }
    ]
  }
};

// Card colors that cycle through 7 colors
const CARD_COLORS = [
  'bg-red-100 border-red-200 text-red-900',
  'bg-blue-100 border-blue-200 text-blue-900', 
  'bg-green-100 border-green-200 text-green-900',
  'bg-yellow-100 border-yellow-200 text-yellow-900',
  'bg-purple-100 border-purple-200 text-purple-900',
  'bg-pink-100 border-pink-200 text-pink-900',
  'bg-indigo-100 border-indigo-200 text-indigo-900'
];

const getCardColor = (index: number) => {
  return CARD_COLORS[index % CARD_COLORS.length];
};

export function RetrospectiveView({ projectId }: RetrospectiveViewProps) {
  const { user } = useApiAuth();
  const { toast } = useToast();

  const [retrospectives, setRetrospectives] = useState<Retrospective[]>([]);
  const [selectedRetrospective, setSelectedRetrospective] = useState<Retrospective | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'board' | 'analytics' | 'enhanced-analytics'>('list');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [retrospectiveToDelete, setRetrospectiveToDelete] = useState<Retrospective | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    iteration_name: '',
    framework: 'classic'
  });

  useEffect(() => {
    if (user) {
      fetchRetrospectives();
      fetchStakeholders();
    }
  }, [user, projectId]);

  const fetchRetrospectives = async () => {
    try {
      const response = await apiClient.getRetrospectives(projectId);
      
      if (response.success) {
        const data = Array.isArray(response.data) 
          ? response.data 
          : (response.data && typeof response.data === 'object' && 'retrospectives' in response.data)
            ? (response.data as any).retrospectives || []
            : [];
        
        setRetrospectives(data);
      } else {
        console.error('❌ Error fetching retrospectives:', response.error);
      }
      setLoading(false);
    } catch (error) {
      console.error('❌ Error fetching retrospectives:', error);
      setLoading(false);
    }
  };

  const fetchStakeholders = async () => {
    try {
      const response = await apiClient.getStakeholders(projectId);
      if (response.success) {
        const stakeholdersList = Array.isArray(response.data) ? response.data : response.data?.stakeholders || [];
        setStakeholders(stakeholdersList);
      }
    } catch (error) {
      console.error('Error fetching stakeholders:', error);
    }
  };


  const handleCreateRetrospective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!createForm.iteration_name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an iteration name',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await apiClient.createRetrospective(projectId, {
        framework: createForm.framework,
        iterationName: createForm.iteration_name
      });

      if (response.success) {
        toast({
          title: 'Success',
          description: 'Retrospective created successfully'
        });

                        setShowCreateDialog(false);
                        setCreateForm({ iteration_name: '', framework: 'classic' });
                        fetchRetrospectives();
      } else {
        throw new Error(response.error || 'Failed to create retrospective');
      }
    } catch (error) {
      console.error('Error creating retrospective:', error);
      toast({
        title: 'Error',
        description: 'Failed to create retrospective',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteRetrospective = async () => {
    if (!retrospectiveToDelete) return;

    try {
      const response = await apiClient.deleteRetrospective(retrospectiveToDelete.id);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Retrospective deleted successfully'
        });
        setShowDeleteDialog(false);
        setRetrospectiveToDelete(null);
        fetchRetrospectives();
      } else {
        throw new Error(response.error || 'Failed to delete retrospective');
      }
    } catch (error) {
      console.error('Error deleting retrospective:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete retrospective',
        variant: 'destructive'
      });
    }
  };

  const confirmDelete = (retro: Retrospective) => {
    setRetrospectiveToDelete(retro);
    setShowDeleteDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Handle view changes based on selected retrospective
  if (view === 'board' && selectedRetrospective) {
    return (
      <InteractiveRetrospectiveBoard
        retrospective={selectedRetrospective}
        onBack={() => {
          setView('list');
          setSelectedRetrospective(null);
        }}
      />
    );
  }

  if (view === 'analytics') {
    return (
      <RetrospectiveAnalytics
        projectId={projectId}
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'enhanced-analytics') {
    return (
      <EnhancedRetrospectiveAnalytics
        projectId={projectId}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Retrospectives</h1>
          <p className="text-muted-foreground">Team retrospectives and action items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView('analytics')}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button variant="outline" onClick={() => setView('enhanced-analytics')} className="bg-gradient-to-r from-primary/5 to-accent/5">
            <TrendingUp className="h-4 w-4 mr-2" />
            Enhanced Analytics
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Retrospective
            </Button>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Retrospective</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateRetrospective} className="space-y-4">
                <div>
                  <Label htmlFor="iteration">Iteration Name *</Label>
                  <Input
                    id="iteration"
                    type="text"
                    value={createForm.iteration_name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, iteration_name: e.target.value }))}
                    placeholder="Enter iteration name (e.g., Sprint 1, Q1 2024, etc.)"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="framework">Framework</Label>
                  <SimpleSelect
                    value={createForm.framework}
                    onValueChange={(value) => setCreateForm(prev => ({ ...prev, framework: value }))}
                    placeholder="Select framework"
                  >
                    {Object.entries(FRAMEWORK_TEMPLATES).map(([key, template]) => (
                      <SimpleSelectItem key={key} value={key} className="text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium">{template.name}</span>
                          <span className="text-muted-foreground text-xs">{template.description}</span>
                        </div>
                      </SimpleSelectItem>
                    ))}
                  </SimpleSelect>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {retrospectives.length > 0 ? (
        <div className="grid gap-4">
          {retrospectives.map((retro) => (
            <Card key={retro.id} className="p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{FRAMEWORK_TEMPLATES[retro.framework]?.name || retro.framework} Retrospective</h3>
                  <p className="text-sm text-muted-foreground mt-1">{FRAMEWORK_TEMPLATES[retro.framework]?.description}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {retro.iteration_id || 'No iteration specified'}
                    </span>
                    <span>Created {new Date(retro.created_at || '').toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{retro.status}</Badge>
                  <Button 
                    onClick={() => {
                      setSelectedRetrospective(retro);
                      setView('board');
                    }}
                  >
                    Open Board
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => confirmDelete(retro)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <p className="text-muted-foreground">
                Interactive {retro.framework} retrospective board with voting and action items.
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No retrospectives yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first retrospective to start collecting team feedback.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Retrospective
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Retrospective</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this retrospective? This action cannot be undone and will permanently remove all cards, votes, and action items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRetrospective} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}