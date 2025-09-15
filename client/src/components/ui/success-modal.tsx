import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { Check, Home, Eye } from 'lucide-react';

interface SuccessModalProps {
  show: boolean;
  title: string;
  body: string;
  onProjectOverview: () => void;
  onHomepage: () => void;
  onClose: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  show,
  title,
  body,
  onProjectOverview,
  onHomepage,
  onClose
}) => {
  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center justify-center mb-lg">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center">
              <Check className="h-8 w-8 text-brand-on-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl font-bold text-text-primary">
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-lg">
          <p className="text-center text-text-muted">{body}</p>
          
          <div className="flex flex-col gap-sm">
            <Button 
              onClick={onProjectOverview}
              className="w-full min-w-[160px] h-10 font-semibold bg-brand-primary hover:bg-brand-primary/90 text-brand-on-primary"
            >
              <Eye className="h-4 w-4 mr-2" />
              Go to Project Overview
            </Button>
            <Button 
              variant="outline"
              onClick={onHomepage}
              className="w-full min-w-[160px] h-10 font-semibold"
            >
              <Home className="h-4 w-4 mr-2" />
              Back to Homepage
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};