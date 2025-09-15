import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from './button';

interface WizardHeaderProps {
  title: string;
  subtitle: string;
  step: number;
  of: number;
  onBack?: () => void;
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({
  title,
  subtitle,
  step,
  of,
  onBack
}) => {
  return (
    <div className="text-center space-y-lg mb-xl">
      <div className="flex items-center justify-between">
        {onBack ? (
          <Button variant="ghost" onClick={onBack} className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <div />
        )}
        <div className="text-sm text-muted-foreground">
          Step {step} of {of}
        </div>
        <div />
      </div>
      
      <div className="space-y-sm">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
};