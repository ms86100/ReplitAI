import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeftIcon, ArrowRightIcon, UploadIcon } from "lucide-react";
import { ProgressSteps } from "@/components/progress-steps";
import { BackupAnalysis } from "@/components/backup-analysis";
import { DatabaseConfiguration } from "@/components/database-config";
import { CostOptimization } from "@/components/cost-optimization";
import { StatusSidebar } from "@/components/status-sidebar";
import { apiRequest } from "@/lib/queryClient";
import { MigrationJob, DatabaseConfig, OptimizationSettings } from "@/lib/types";

export default function Migration() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [config, setConfig] = useState<DatabaseConfig>({
    host: import.meta.env.VITE_DB_HOST || "localhost",
    port: parseInt(import.meta.env.VITE_DB_PORT || "5432"),
    database: import.meta.env.VITE_DB_NAME || "postgres",
    username: import.meta.env.VITE_DB_USER || "postgres",
    password: import.meta.env.VITE_DB_PASSWORD || "",
  });
  const [optimization, setOptimization] = useState<OptimizationSettings>({
    selectiveRestore: true,
    compression: true,
    batching: true,
    excludeSchemas: ["pg_catalog", "information_schema"],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current job data
  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["/api/jobs", currentJobId],
    enabled: !!currentJobId,
    refetchInterval: 2000,
  }) as { data: MigrationJob | undefined; isLoading: boolean };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("backup", file);
      const response = await apiRequest("POST", "/api/upload-backup", formData);
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      setCurrentStep(2);
      toast({
        title: "Upload Successful",
        description: "Backup file uploaded and analysis started.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Restoration mutation
  const restoreMutation = useMutation({
    mutationFn: async ({ jobId, config, optimization }: { 
      jobId: string; 
      config: DatabaseConfig; 
      optimization: OptimizationSettings; 
    }) => {
      const response = await apiRequest("POST", `/api/restore/${jobId}`, {
        config,
        optimization,
      });
      return response.json();
    },
    onSuccess: () => {
      setCurrentStep(3);
      toast({
        title: "Restoration Started",
        description: "Database restoration process has begun.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", currentJobId] });
    },
    onError: (error) => {
      toast({
        title: "Restoration Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.backup') && !file.name.endsWith('.sql')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a .backup or .sql file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartRestoration = () => {
    if (!currentJobId) return;
    restoreMutation.mutate({ jobId: currentJobId, config, optimization });
  };

  const handleTestConnection = async () => {
    try {
      const response = await apiRequest('POST', '/api/test-connection', { config });
      const result = await response.json();
      
      if (result.connected) {
        toast({
          title: "Connection Successful",
          description: "Successfully connected to the database.",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Could not connect to the database.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Test Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const getStepFromJobStatus = (status: string) => {
    switch (status) {
      case "pending":
      case "analyzing": return 1;
      case "configuring": return 2;
      case "restoring": return 3;
      case "verifying": return 4;
      case "completed": return 5;
      default: return currentStep;
    }
  };

  const effectiveStep = job ? getStepFromJobStatus(job.status) : currentStep;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border" data-testid="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-database text-primary-foreground text-sm"></i>
              </div>
              <h1 className="text-xl font-semibold text-foreground">Database Migration Tool</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">Supabase → Replit PostgreSQL</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProgressSteps currentStep={effectiveStep} totalSteps={5} />

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Upload */}
            {effectiveStep === 1 && (
              <Card data-testid="upload-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <UploadIcon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Upload Supabase Backup
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Select your Supabase backup file (.backup or .sql) to begin the restoration process.
                    </p>
                    
                    <div>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".backup,.sql"
                        onChange={handleFileUpload}
                        className="hidden"
                        data-testid="file-input"
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full max-w-xs"
                        data-testid="button-upload"
                      >
                        {isUploading ? "Uploading..." : "Choose File"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Analysis & Configuration */}
            {effectiveStep === 2 && job?.backupInfo && (
              <>
                <BackupAnalysis backupInfo={job.backupInfo} />
                <DatabaseConfiguration
                  config={config}
                  onChange={setConfig}
                  onTestConnection={handleTestConnection}
                  isTestingConnection={false}
                />
                <CostOptimization
                  settings={optimization}
                  onChange={setOptimization}
                />
              </>
            )}

            {/* Steps 3-5: Progress display */}
            {effectiveStep >= 3 && job && (
              <Card data-testid="progress-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      {job.status === "restoring" && "Restoring Database..."}
                      {job.status === "verifying" && "Verifying Data Integrity..."}
                      {job.status === "completed" && "Migration Completed Successfully!"}
                      {job.status === "failed" && "Migration Failed"}
                    </h3>
                    
                    {job.status !== "completed" && job.status !== "failed" && (
                      <div className="w-full bg-secondary rounded-full h-2 mb-4">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                    
                    {job.errorMessage && (
                      <div className="text-red-500 text-sm mt-2" data-testid="error-message">
                        {job.errorMessage}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          {job && (
            <StatusSidebar
              job={job}
              onTestConnection={handleTestConnection}
              onDownloadScript={() => {
                toast({ title: "Feature Coming Soon", description: "Script download will be available soon." });
              }}
              onScheduleLater={() => {
                toast({ title: "Feature Coming Soon", description: "Scheduling will be available soon." });
              }}
            />
          )}
        </div>

        {/* Action Buttons */}
        {job && (
          <div className="flex items-center justify-between pt-8 border-t border-border">
            <Button
              variant="secondary"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={effectiveStep <= 1}
              data-testid="button-back"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            <div className="flex space-x-3">
              {effectiveStep === 2 && (
                <Button
                  onClick={handleStartRestoration}
                  disabled={restoreMutation.isPending || job.status === "restoring"}
                  className="px-8"
                  data-testid="button-start-restoration"
                >
                  {restoreMutation.isPending ? "Starting..." : "Start Restoration"}
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
