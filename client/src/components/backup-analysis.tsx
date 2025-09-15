import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileArchiveIcon, DatabaseIcon, LayersIcon } from "lucide-react";
import { BackupInfo } from "@/lib/types";

interface BackupAnalysisProps {
  backupInfo: BackupInfo;
}

export function BackupAnalysis({ backupInfo }: BackupAnalysisProps) {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card data-testid="backup-analysis-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Backup Analysis</span>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-muted-foreground">Analysis Complete</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-accent rounded-lg p-4" data-testid="file-size-info">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-accent-foreground">File Size</span>
              <FileArchiveIcon className="h-5 w-5 text-accent-foreground opacity-60" />
            </div>
            <div className="text-2xl font-bold text-accent-foreground mt-1">
              {formatBytes(backupInfo.fileSize)}
            </div>
          </div>
          
          <div className="bg-accent rounded-lg p-4" data-testid="database-version-info">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-accent-foreground">Database Version</span>
              <DatabaseIcon className="h-5 w-5 text-accent-foreground opacity-60" />
            </div>
            <div className="text-2xl font-bold text-accent-foreground mt-1">
              {backupInfo.version}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-foreground">Detected Schemas</h4>
          <div className="grid grid-cols-2 gap-3" data-testid="schemas-grid">
            {backupInfo.schemas.map((schema) => (
              <div
                key={schema.name}
                className="flex items-center space-x-3 p-3 bg-secondary rounded-lg"
                data-testid={`schema-${schema.name}`}
              >
                <LayersIcon className="h-4 w-4 text-secondary-foreground opacity-60" />
                <span className="text-sm font-medium text-secondary-foreground">
                  {schema.name}
                </span>
                <Badge variant="default" className="text-xs">
                  {schema.tableCount} tables
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
