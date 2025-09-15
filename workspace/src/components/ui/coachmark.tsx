import React, { useState } from 'react';
import { Button } from './button';
import { X } from 'lucide-react';
import { LottiePlayer } from './lottie-player';

interface CoachmarkProps {
  title: string;
  body: string;
  targetElementId?: string;
  actionText: string;
  onAction?: () => void;
  onDismiss?: () => void;
  lottieAsset?: string;
  show?: boolean;
}

export const Coachmark: React.FC<CoachmarkProps> = ({
  title,
  body,
  targetElementId,
  actionText,
  onAction,
  onDismiss,
  lottieAsset,
  show = true
}) => {
  const [isVisible, setIsVisible] = useState(show);

  if (!isVisible) return null;

  const handleAction = () => {
    onAction?.();
    setIsVisible(false);
  };

  const handleDismiss = () => {
    onDismiss?.();
    setIsVisible(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-surface-elevated border border-border-subtle rounded-radius-md shadow-elevated p-lg max-w-sm mx-md">
        <div className="flex justify-between items-start mb-md">
          <h3 className="font-semibold text-text-primary">{title}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {lottieAsset && (
          <div className="flex justify-center mb-md">
            <LottiePlayer 
              src={lottieAsset}
              loop={true}
              autoplay={true}
              className="w-20 h-20"
            />
          </div>
        )}
        
        <p className="text-text-muted mb-lg text-sm">{body}</p>
        
        <div className="flex gap-sm">
          <Button onClick={handleAction} className="flex-1">
            {actionText}
          </Button>
          <Button variant="outline" onClick={handleDismiss}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
};