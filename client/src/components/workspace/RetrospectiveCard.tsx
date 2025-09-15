import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ThumbsUp, MoreHorizontal, Target, Trash2, User } from 'lucide-react';

interface RetrospectiveCardProps {
  card: {
    id: string;
    text: string;
    votes: number;
    created_by: string;
  };
  cardColor: string;
  userDisplayName: string;
  onVote: () => void;
  onDelete: () => void;
  onCreateAction: () => void;
  isOwner: boolean;
}

export function RetrospectiveCard({ 
  card, 
  cardColor, 
  userDisplayName, 
  onVote, 
  onDelete, 
  onCreateAction,
  isOwner 
}: RetrospectiveCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`${cardColor} p-4 rounded-lg group border-2 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 ${
        isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Drag handle area - only the text area should be draggable */}
      <div {...listeners} className="mb-3 cursor-grab">
        <p className="text-sm font-medium leading-relaxed">{card.text}</p>
      </div>
      
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-current/20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs opacity-75">
            <User className="h-3 w-3" />
            <span className="font-medium">{userDisplayName}</span>
          </div>
        </div>
        
        {/* Interactive buttons - should NOT be draggable */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onVote();
            }}
            className="h-7 px-2 hover:bg-white/50"
          >
            <ThumbsUp className="h-3 w-3 mr-1" />
            <span className="text-xs font-semibold">{card.votes}</span>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:bg-white/50"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onCreateAction();
                }}
              >
                <Target className="h-4 w-4 mr-2" />
                Create Action Item
              </DropdownMenuItem>
              {isOwner && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDelete();
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Card
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}