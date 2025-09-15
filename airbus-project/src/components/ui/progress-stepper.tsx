import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressStepperProps {
  current: number;
  total: number;
  labels?: string[];
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({
  current,
  total,
  labels = []
}) => {
  return (
    <div className="w-full space-y-md">
      {/* Progress bar */}
      <div className="relative w-full bg-surface-alt rounded-full h-2">
        <div 
          className="absolute top-0 left-0 h-2 bg-gradient-to-r from-brand-primary to-brand-accent rounded-full transition-all duration-300 ease-out"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
      
      {/* Step dots with labels */}
      <div className="flex justify-between items-center">
        {Array.from({ length: total }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < current;
          const isCurrent = stepNumber === current;
          const isPending = stepNumber > current;
          
          return (
            <div key={stepNumber} className="flex flex-col items-center space-y-xs">
              <div
                className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-all duration-200",
                  {
                    "bg-brand-primary border-brand-primary text-brand-on-primary": isCompleted || isCurrent,
                    "bg-surface-default border-border text-text-muted": isPending
                  }
                )}
              >
                {isCompleted ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  stepNumber
                )}
              </div>
              {labels[index] && (
                <span className={cn(
                  "text-xs text-center max-w-20",
                  {
                    "text-brand-primary font-medium": isCurrent,
                    "text-text-primary": isCompleted,
                    "text-text-muted": isPending
                  }
                )}>
                  {labels[index]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};