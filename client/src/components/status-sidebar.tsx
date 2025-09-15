import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { PlugIcon, DownloadIcon, ClockIcon } from "lucide-react";
import { MigrationJob } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusSidebarProps {
  job: MigrationJob;
  onTestConnection: () => void;
  onDownloadScript: () => void;
  onScheduleLater: () => void;
}

export function StatusSidebar({ 
  job, 
  onTestConnection,
  onDownloadScript,
  onScheduleLater 
}: StatusSidebarProps) {
  const getStatusColor = (status: string, isActive: boolean) => {
    if (isActive) return "bg-yellow-500";
    if (status === "completed") return "bg-green-500";
    if (status === "failed") return "bg-red-500";
    return "bg-border";
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending": return "Pending";
      case "analyzing": return "Analyzing backup...";
      case "configuring": return "Configuring connection...";
      case "restoring": return "Restoring database...";
      case "verifying": return "Verifying data...";
      case "completed": return "Completed";
      case "failed": return "Failed";
      default: return "Unknown";
    }
  };

  const statusSteps = [
    { key: "upload", label: "Backup file uploaded", minStatus: "analyzing" },
    { key: "analyze", label: "Schema analysis complete", minStatus: "configuring" },
    { key: "config", label: "Configuring connection...", minStatus: "restoring" },
    { key: "restore", label: "Database restoration", minStatus: "verifying" },
    { key: "verify", label: "Data verification", minStatus: "completed" },
  ];

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card data-testid="status-card">
        <CardHeader>
          <CardTitle>Restoration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {statusSteps.map((step, index) => {
              const isCompleted = job.status === "completed" || 
                (statusSteps.findIndex(s => s.minStatus === job.status) > index);
              const isActive = statusSteps[index]?.minStatus === job.status;
              const isPending = !isCompleted && !isActive;

              return (
                <div key={step.key} className="flex items-center space-x-3" data-testid={`status-step-${step.key}`}>
                  <div 
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      getStatusColor(job.status, isActive),
                      isActive && "animate-pulse"
                    )}
                  />
                  <span className={cn(
                    "text-sm",
                    isPending ? "text-muted-foreground" : "text-foreground"
                  )}>
                    {isPending ? `Pending: ${step.label}` : 
                     isActive ? getStatusText(job.status) :
                     step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resource Usage */}
      <Card data-testid="resource-usage-card">
        <CardHeader>
          <CardTitle>Estimated Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">Storage</span>
                <span className="text-muted-foreground">
                  {job.backupInfo ? job.backupInfo.estimatedStorage : formatBytes(job.fileSize * 1.2)}
                </span>
              </div>
              <Progress value={15} className="h-2" data-testid="storage-progress" />
              <span className="text-xs text-muted-foreground">15% of allocated space</span>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">Memory</span>
                <span className="text-muted-foreground">
                  {job.backupInfo?.estimatedMemory || "~24 MB"}
                </span>
              </div>
              <Progress value={8} className="h-2" data-testid="memory-progress" />
              <span className="text-xs text-muted-foreground">8% during peak restoration</span>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">Estimated Time</span>
                <span className="text-muted-foreground">
                  {job.backupInfo?.estimatedTime || "~2 minutes"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card data-testid="quick-actions-card">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button 
              className="w-full" 
              onClick={onTestConnection}
              data-testid="button-test-connection"
            >
              <PlugIcon className="w-4 h-4 mr-2" />
              Test Connection
            </Button>
            
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={onDownloadScript}
              data-testid="button-download-script"
            >
              <DownloadIcon className="w-4 h-4 mr-2" />
              Download Script
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={onScheduleLater}
              data-testid="button-schedule-later"
            >
              <ClockIcon className="w-4 h-4 mr-2" />
              Schedule Later
            </Button>
          </div>
        </CardContent>
      </CardContent>
    </Card>
  );
}
