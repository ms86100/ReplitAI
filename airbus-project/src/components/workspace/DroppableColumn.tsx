import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { RetrospectiveCard } from './RetrospectiveCard';

interface DroppableColumnProps {
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
  userId?: string;
}

export function DroppableColumn({
  column,
  cards,
  getCardColor,
  getUserDisplayName,
  onVote,
  onDelete,
  onCreateAction,
  userId
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 p-4 min-h-[200px] rounded-lg transition-colors ${
        isOver ? 'bg-primary/10 border-2 border-primary border-dashed' : 'bg-gradient-to-br from-background to-muted/20'
      }`}
    >
      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        {cards.map((card, index) => (
          <RetrospectiveCard
            key={card.id}
            card={card}
            cardColor={getCardColor(index)}
            userDisplayName={getUserDisplayName(card.created_by)}
            onVote={() => onVote(card.id)}
            onDelete={() => onDelete(card.id)}
            onCreateAction={() => onCreateAction(card)}
            isOwner={card.created_by === userId}
          />
        ))}
      </SortableContext>
    </div>
  );
}