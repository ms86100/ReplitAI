import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { InteractiveRetrospectiveCard } from './InteractiveRetrospectiveCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface InteractiveDroppableColumnProps {
  column: {
    id: string;
    title: string;
    subtitle?: string;
  };
  cards: any[];
  getCardColor: (index: number) => string;
  getUserDisplayName: (userId: string) => string;
  onVote: (cardId: string) => void;
  onDelete: (cardId: string) => void;
  onCreateAction: (card: any) => void;
  onEditCard?: (cardId: string, text: string) => void;
  onAddCard: (columnId: string) => void;
  userId?: string;
}

export function InteractiveDroppableColumn({
  column,
  cards,
  getCardColor,
  getUserDisplayName,
  onVote,
  onDelete,
  onCreateAction,
  onEditCard,
  onAddCard,
  userId
}: InteractiveDroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col h-full min-h-[400px] rounded-lg border-2 transition-all duration-300 ${
        isOver 
          ? 'bg-gradient-to-br from-primary/10 to-accent/10 border-primary/50 border-dashed shadow-xl scale-[1.02] transform' 
          : 'bg-gradient-to-br from-background via-muted/10 to-background border-border hover:shadow-lg hover:border-primary/20'
      }`}
    >
      {/* Enhanced Column Header */}
      <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-lg bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            {column.title}
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAddCard(column.id)}
            className="h-8 w-8 p-0 hover:bg-white/60 border border-primary/20 rounded-full"
          >
            <Plus className="h-4 w-4 text-primary" />
          </Button>
        </div>
        {column.subtitle && (
          <p className="text-sm text-muted-foreground font-medium mb-2">{column.subtitle}</p>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 px-2 py-1 bg-white/60 rounded-full">
            <span className="text-xs font-medium text-primary">{cards.length}</span>
            <span className="text-xs text-muted-foreground">cards</span>
          </div>
          {cards.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-white/60 rounded-full">
              <span className="text-xs font-medium text-blue-600">
                {cards.reduce((sum, card) => sum + (card.votes || 0), 0)}
              </span>
              <span className="text-xs text-muted-foreground">votes</span>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Cards Container */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-dashed border-primary/20 flex items-center justify-center mb-4">
                <Plus className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-3">No cards in this column yet</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
                Start adding retrospective items to capture team feedback
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddCard(column.id)}
                className="text-xs border-primary/30 hover:bg-primary/5 hover:border-primary/50"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add first card
              </Button>
            </div>
          ) : (
            cards.map((card, index) => (
              <InteractiveRetrospectiveCard
                key={card.id}
                card={card}
                cardColor={getCardColor(index)}
                userDisplayName={getUserDisplayName(card.created_by)}
                onVote={() => onVote(card.id)}
                onDelete={() => onDelete(card.id)}
                onCreateAction={() => onCreateAction(card)}
                onEdit={onEditCard}
                isOwner={card.created_by === userId}
                voters={card.voters || []}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Enhanced Drop Zone Indicator */}
      {isOver && (
        <div className="p-4 border-t-2 border-primary border-dashed bg-gradient-to-r from-primary/10 to-accent/10 animate-pulse">
          <div className="text-center text-sm text-primary font-semibold flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            Drop card here
            <Plus className="h-4 w-4" />
          </div>
        </div>
      )}
    </div>
  );
}