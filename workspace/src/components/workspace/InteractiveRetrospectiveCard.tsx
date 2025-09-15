import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, MoreHorizontal, Edit2, Save, X, Trash2, Target, User, GripVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface InteractiveRetrospectiveCardProps {
  card: {
    id: string;
    column_id: string;
    text: string;
    votes: number;
    card_order: number;
    created_by: string;
    created_at?: string;
  };
  cardColor: string;
  userDisplayName: string;
  onVote: () => void;
  onDelete: () => void;
  onCreateAction: () => void;
  onEdit?: (cardId: string, text: string) => void;
  isOwner: boolean;
  voters?: Array<{ user_id: string; user_name: string }>;
}

export function InteractiveRetrospectiveCard({
  card,
  cardColor,
  userDisplayName,
  onVote,
  onDelete,
  onCreateAction,
  onEdit,
  isOwner,
  voters = []
}: InteractiveRetrospectiveCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(card.text);
  const [showVoters, setShowVoters] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: card.id,
    data: {
      type: 'card',
      card
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleEditSave = () => {
    if (onEdit && editText.trim() !== card.text) {
      onEdit(card.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditText(card.text);
    setIsEditing(false);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`relative group transition-all duration-200 ${
        isDragging ? 'opacity-50 shadow-lg scale-105 z-50' : 'hover:shadow-md'
      }`}
    >
      <CardContent className="p-4 space-y-3" style={{ backgroundColor: cardColor }}>
        {/* Drag Handle and Card Content */}
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity mt-1"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </div>
          
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[60px] resize-none border-primary/20"
                  placeholder="Enter card text..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEditSave}>
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEditCancel}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm leading-relaxed break-words">{card.text}</p>
              </div>
            )}
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{userDisplayName}</span>
            </div>
            {card.created_at && (
              <span>• {new Date(card.created_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Voting Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onVote();
              }}
              className="h-8 px-2 hover:bg-primary/10"
            >
              <ThumbsUp className="h-3 w-3 mr-1" />
              {card.votes}
            </Button>
            
            {voters.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVoters(!showVoters);
                }}
                className="h-8 px-2 text-xs hover:bg-primary/10"
              >
                {voters.length} voter{voters.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateAction();
                }}
              >
                <Target className="h-4 w-4 mr-2" />
                Create Action Item
              </DropdownMenuItem>
              {isOwner && onEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Card
                </DropdownMenuItem>
              )}
              {isOwner && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Card
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Voters Popup */}
        {showVoters && voters.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-background border rounded-md shadow-lg z-50">
            <div className="text-xs font-medium mb-1">Voters:</div>
            <div className="space-y-1">
              {voters.map((voter, index) => (
                <div key={index} className="text-xs text-muted-foreground">
                  {voter.user_name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* High Vote Badge */}
        {card.votes >= 3 && (
          <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs">
            🔥 Popular
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}