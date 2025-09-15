import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStepsProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressSteps({ currentStep, totalSteps }: ProgressStepsProps) {
  const steps = [
    { id: 1, name: "Upload", icon: "upload" },
    { id: 2, name: "Configure", icon: "settings" },
    { id: 3, name: "Restore", icon: "database" },
    { id: 4, name: "Verify", icon: "check" },
    { id: 5, name: "Complete", icon: "check-circle" },
  ];

  return (
    <div className="mb-8" data-testid="progress-steps">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-foreground">Database Restoration</h2>
        <div className="text-sm text-muted-foreground" data-testid="step-counter">
          Step {currentStep} of {totalSteps}
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                "step-indicator w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                currentStep > step.id
                  ? "bg-green-500 text-white" // completed
                  : currentStep === step.id
                  ? "bg-primary text-primary-foreground" // active
                  : "bg-muted text-muted-foreground" // inactive
              )}
              data-testid={`step-indicator-${step.id}`}
            >
              {currentStep > step.id ? (
                <CheckIcon className="w-4 h-4" />
              ) : (
                step.id
              )}
            </div>
            <span 
              className={cn(
                "ml-2 text-sm font-medium",
                currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
              )}
              data-testid={`step-label-${step.id}`}
            >
              {step.name}
            </span>
            {index < steps.length - 1 && (
              <div className="flex-1 h-px bg-border ml-4 mr-4"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
