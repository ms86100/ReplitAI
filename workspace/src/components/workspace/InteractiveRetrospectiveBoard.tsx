import React, { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners } from '@dnd-kit/core';
import { SortableContext, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useApiAuth } from '@/hooks/useApiAuth';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SimpleSelect, SimpleSelectItem } from '@/components/ui/simple-select';
import { Plus, ThumbsUp, Target, Trash2, MoreHorizontal, ArrowLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RetrospectiveCard } from './RetrospectiveCard';
import { InteractiveRetrospectiveCard } from './InteractiveRetrospectiveCard';
import { InteractiveDroppableColumn } from './InteractiveDroppableColumn';
import { FRAMEWORK_TEMPLATES } from './RetrospectiveView';

interface InteractiveRetrospectiveBoardProps {
  retrospective: {
    id: string;
    framework: string;
    project_id: string;
    iteration_id: string;
    status: string;
    columns?: RetrospectiveColumn[];
  };
  onBack: () => void;
}

interface RetrospectiveColumn {
  id: string;
  retrospective_id: string;
  title: string;
  subtitle?: string;
  column_order: number;
  cards?: RetrospectiveCard[];
}

interface RetrospectiveCard {
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
}

interface ActionItemForm {
  what_task: string;
  when_sprint: string;
  who_responsible: string;
  how_approach: string;
}

const CARD_COLORS = [
  'hsl(var(--accent-light))',
  'hsl(var(--primary-light))', 
  'hsl(var(--surface-alt))',
  'hsl(var(--secondary))',
  'hsl(142 76% 90%)', // success light
  'hsl(38 92% 90%)', // warning light
  'hsl(199 89% 90%)' // info light
];

const getCardColor = (index: number) => {
  return CARD_COLORS[index % CARD_COLORS.length];
};

export function InteractiveRetrospectiveBoard({ retrospective, onBack }: InteractiveRetrospectiveBoardProps) {
  const { user } = useApiAuth();
  const { toast } = useToast();

  const [columns, setColumns] = useState<RetrospectiveColumn[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<RetrospectiveCard | null>(null);
  
  // Dialog states
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  const [showActionItemDialog, setShowActionItemDialog] = useState(false);
  const [selectedCard, setSelectedCard] = useState<RetrospectiveCard | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');

  // Form states
  const [newCardText, setNewCardText] = useState('');
  const [actionItemForm, setActionItemForm] = useState<ActionItemForm>({
    what_task: '',
    when_sprint: '',
    who_responsible: '',
    how_approach: ''
  });

  useEffect(() => {
    if (retrospective.columns) {
      const frameworkTemplate = FRAMEWORK_TEMPLATES[retrospective.framework];
      if (frameworkTemplate) {
        // Update column titles based on framework
        const updatedColumns = retrospective.columns.map((col, index) => ({
          ...col,
          title: frameworkTemplate.columns[index]?.title || col.title,
          subtitle: frameworkTemplate.columns[index]?.subtitle || col.subtitle
        }));
        setColumns(updatedColumns);
      } else {
        setColumns(retrospective.columns);
      }
      setLoading(false);
    } else {
      fetchRetrospectiveData();
    }
    fetchStakeholders();
  }, [retrospective.id, retrospective.framework]);

  const fetchRetrospectiveData = async () => {
    try {
      const response = await apiClient.getRetrospectives(retrospective.project_id);
      if (response.success) {
        const retros = Array.isArray(response.data) ? response.data : [];
        const currentRetro = retros.find(r => r.id === retrospective.id);
        if (currentRetro?.columns) {
          const frameworkTemplate = FRAMEWORK_TEMPLATES[retrospective.framework];
          // Sort columns by order and cards by order
          const sortedColumns = currentRetro.columns
            .sort((a, b) => a.column_order - b.column_order)
            .map((col, index) => ({
              ...col,
              title: frameworkTemplate?.columns[index]?.title || col.title,
              subtitle: frameworkTemplate?.columns[index]?.subtitle || col.subtitle,
              cards: col.cards?.sort((a, b) => a.card_order - b.card_order) || []
            }));
          setColumns(sortedColumns);
        }
      }
    } catch (error) {
      console.error('Error fetching retrospective data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load retrospective data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStakeholders = async () => {
    try {
      const response = await apiClient.getStakeholders(retrospective.project_id);
      if (response.success) {
        const stakeholdersList = Array.isArray(response.data) ? response.data : response.data?.stakeholders || [];
        setStakeholders(stakeholdersList);
      }
    } catch (error) {
      console.error('Error fetching stakeholders:', error);
    }
  };

  const handleEditCard = async (cardId: string, newText: string) => {
    try {
      const response = await apiClient.updateRetrospectiveCard(cardId, { text: newText });
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Card updated successfully'
        });
        await fetchRetrospectiveData();
      }
    } catch (error) {
      console.error('Error updating card:', error);
      toast({
        title: 'Error',
        description: 'Failed to update card',
        variant: 'destructive'
      });
    }
  };

  const handleAddCard = (columnId: string) => {
    setSelectedColumnId(columnId);
    setShowAddCardDialog(true);
  };

  const handleSubmitCard = async () => {
    if (!newCardText.trim() || !selectedColumnId) return;

    try {
      const response = await apiClient.createRetrospectiveCard(selectedColumnId, {
        text: newCardText,
        card_order: 0 // Will be handled by backend
      });

      if (response.success) {
        toast({
          title: 'Success',
          description: 'Card added successfully'
        });
        setNewCardText('');
        setShowAddCardDialog(false);
        setSelectedColumnId('');
        await fetchRetrospectiveData();
      }
    } catch (error) {
      console.error('Error adding card:', error);
      toast({
        title: 'Error',
        description: 'Failed to add card',
        variant: 'destructive'
      });
    }
  };

  const handleVote = async (cardId: string) => {
    try {
      const response = await apiClient.voteOnRetrospectiveCard(cardId);
      if (response.success) {
        await fetchRetrospectiveData();
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast({
        title: 'Error',
        description: 'Failed to vote on card',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const response = await apiClient.deleteRetrospectiveCard(cardId);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Card deleted successfully'
        });
        await fetchRetrospectiveData();
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete card',
        variant: 'destructive'
      });
    }
  };

  const handleCreateActionItem = (card: RetrospectiveCard) => {
    setSelectedCard(card);
    setActionItemForm({
      what_task: card.text,
      when_sprint: '',
      who_responsible: '',
      how_approach: ''
    });
    setShowActionItemDialog(true);
  };

  const handleSubmitActionItem = async () => {
    if (!selectedCard || !actionItemForm.what_task.trim()) return;

    try {
      // First create the action item
      const actionResponse = await apiClient.createRetrospectiveActionItem(retrospective.id, {
        ...actionItemForm,
        from_card_id: selectedCard.id
      });

      if (actionResponse.success) {
        // Automatically create task in backlog with "From Retrospective" tag
        const backlogData = {
          title: actionItemForm.what_task,
          description: `${actionItemForm.how_approach ? actionItemForm.how_approach + '\n\n' : ''}Created from retrospective action item.\n\nOriginal card: "${selectedCard.text}"\nWhen: ${actionItemForm.when_sprint}\nWho: ${actionItemForm.who_responsible}`,
          priority: 'medium',
          source_type: 'retrospective',
          source_id: actionResponse.data?.actionItem?.id,
          owner_id: stakeholders.find(s => s.name === actionItemForm.who_responsible)?.id,
          tags: ['From Retrospective'] // Add the retrospective tag
        };

        const backlogResponse = await apiClient.createBacklogItem(retrospective.project_id, backlogData);
        
        if (backlogResponse.success) {
          // Update action item to link to the created backlog task
          await apiClient.updateRetrospectiveActionItem(actionResponse.data?.actionItem?.id, {
            backlog_task_id: backlogResponse.data?.item?.id
          });
          
          toast({
            title: 'Success',
            description: 'Action item created and automatically added to task backlog'
          });
        } else {
          toast({
            title: 'Partial Success',
            description: 'Action item created but failed to add to backlog'
          });
        }
        
        setShowActionItemDialog(false);
        setSelectedCard(null);
        setActionItemForm({
          what_task: '',
          when_sprint: '',
          who_responsible: '',
          how_approach: ''
        });
      }
    } catch (error) {
      console.error('Error creating action item:', error);
      toast({
        title: 'Error',
        description: 'Failed to create action item',
        variant: 'destructive'
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = findCardById(active.id as string);
    setActiveCard(card);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const cardId = active.id as string;
    const newColumnId = over.id as string;

    // Find current card and column
    const card = findCardById(cardId);
    if (!card) return;

    // If dropped in same column, just reorder
    if (card.column_id === newColumnId) {
      // Handle reordering within same column - for now, just refresh
      await fetchRetrospectiveData();
      return;
    }

    // Move card to new column
    try {
      const response = await apiClient.moveRetrospectiveCard(cardId, newColumnId);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Card moved successfully'
        });
        // Refresh data to see the changes
        await fetchRetrospectiveData();
      } else {
        console.error('Move response error:', response.error);
        toast({
          title: 'Error', 
          description: response.error || 'Failed to move card',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error moving card:', error);
      toast({
        title: 'Error',
        description: 'Failed to move card',
        variant: 'destructive'
      });
    }
  };

  const findCardById = (cardId: string): RetrospectiveCard | null => {
    for (const column of columns) {
      const card = column.cards?.find(c => c.id === cardId);
      if (card) return card;
    }
    return null;
  };

  const getUserDisplayName = (userId: string) => {
    return user?.id === userId ? 'You' : 'Team Member';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="hover:bg-white/80">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Retrospective Board
            </h1>
            <p className="text-muted-foreground">
              Framework: {FRAMEWORK_TEMPLATES[retrospective.framework]?.name || retrospective.framework}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="capitalize bg-white/50 backdrop-blur-sm">
            {retrospective.status}
          </Badge>
          <div className="text-sm text-muted-foreground">
            {columns.reduce((acc, col) => acc + (col.cards?.length || 0), 0)} cards
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCorners}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 min-h-[calc(100vh-280px)]">
          {columns.map((column) => (
            <div key={column.id} className="flex flex-col">
              <InteractiveDroppableColumn
                column={column}
                cards={column.cards || []}
                getCardColor={getCardColor}
                getUserDisplayName={getUserDisplayName}
                onVote={handleVote}
                onDelete={handleDeleteCard}
                onCreateAction={handleCreateActionItem}
                onEditCard={handleEditCard}
                onAddCard={handleAddCard}
                userId={user?.id}
              />
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <InteractiveRetrospectiveCard
              card={activeCard}
              cardColor={getCardColor(0)}
              userDisplayName={getUserDisplayName(activeCard.created_by)}
              onVote={() => {}}
              onDelete={() => {}}
              onCreateAction={() => {}}
              isOwner={activeCard.created_by === user?.id}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add Card Dialog */}
      <Dialog open={showAddCardDialog} onOpenChange={setShowAddCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cardText">Card Text</Label>
              <Textarea
                id="cardText"
                value={newCardText}
                onChange={(e) => setNewCardText(e.target.value)}
                placeholder="Enter your retrospective item..."
                className="min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddCardDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitCard} disabled={!newCardText.trim()}>
                Add Card
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Action Item Dialog */}
      <Dialog open={showActionItemDialog} onOpenChange={setShowActionItemDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Create Action Item & Task
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              This will create an action item and automatically add it to the task backlog
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="what">What (Task Description)</Label>
              <Textarea
                id="what"
                value={actionItemForm.what_task}
                onChange={(e) => setActionItemForm(prev => ({ ...prev, what_task: e.target.value }))}
                placeholder="Describe the action item..."
                className="min-h-[80px]"
              />
            </div>
            <div>
              <Label htmlFor="when">When (Sprint/Timeline)</Label>
              <Input
                id="when"
                value={actionItemForm.when_sprint}
                onChange={(e) => setActionItemForm(prev => ({ ...prev, when_sprint: e.target.value }))}
                placeholder="Next sprint, Q1 2024, etc."
              />
            </div>
            <div>
              <Label htmlFor="who">Who (Responsible Person)</Label>
              <SimpleSelect
                value={actionItemForm.who_responsible}
                onValueChange={(value) => setActionItemForm(prev => ({ ...prev, who_responsible: value }))}
                placeholder="Select responsible person"
              >
                {stakeholders.map((stakeholder) => (
                  <SimpleSelectItem key={stakeholder.id} value={stakeholder.name}>
                    {stakeholder.name}
                  </SimpleSelectItem>
                ))}
              </SimpleSelect>
            </div>
            <div>
              <Label htmlFor="how">How (Approach/Method)</Label>
              <Textarea
                id="how"
                value={actionItemForm.how_approach}
                onChange={(e) => setActionItemForm(prev => ({ ...prev, how_approach: e.target.value }))}
                placeholder="Describe the approach or method..."
                className="min-h-[80px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowActionItemDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitActionItem} disabled={!actionItemForm.what_task.trim()}>
                Create Action Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}