import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Link, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Clock
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  jira_synced?: boolean;
  jira_sync_enabled?: boolean;
  jira_issue_key?: string | null;
  jira_last_sync?: string | null;
}

interface JiraIntegration {
  id: string;
  project_id: string;
  jira_base_url: string;
  jira_project_key: string;
  enabled: boolean;
  sync_enabled: boolean;
}

interface JiraSyncToggleProps {
  task: Task;
  projectId: string;
  onSyncStatusChange?: (synced: boolean, issueKey?: string) => void;
  mode?: 'create' | 'edit' | 'view'; // Different modes for different contexts
}

export function JiraSyncToggle({ task, projectId, onSyncStatusChange, mode = 'view' }: JiraSyncToggleProps) {
  const [integration, setIntegration] = useState<JiraIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [wantSync, setWantSync] = useState(false); // For create mode
  const { toast } = useToast();

  useEffect(() => {
    fetchIntegration();
  }, [projectId]);

  const fetchIntegration = async () => {
    try {
      const response = await fetch(`/api/jira-service/projects/${projectId}/integration`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setIntegration(result.data);
      }
    } catch (error) {
      console.error('Error fetching Jira integration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncToJira = async () => {
    if (!integration || !task.id) {
      toast({
        title: "Sync Failed",
        description: "Integration not configured or task not saved",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);

    try {
      const response = await fetch(`/api/jira-service/projects/${projectId}/tasks/${task.id}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Sync Successful",
          description: `Task synced to Jira: ${result.data.jira_issue_key}`
        });
        onSyncStatusChange?.(true, result.data.jira_issue_key);
      } else {
        toast({
          title: "Sync Failed",
          description: result.error || "Failed to sync task to Jira",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Sync Error",
        description: "Failed to sync task to Jira",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const unsyncFromJira = async () => {
    if (!task.id) return;

    setIsSyncing(true);

    try {
      const response = await fetch(`/api/jira-service/projects/${projectId}/tasks/${task.id}/sync`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Unsync Successful",
          description: "Task unsynced from Jira"
        });
        onSyncStatusChange?.(false);
      } else {
        toast({
          title: "Unsync Failed",
          description: result.error || "Failed to unsync task from Jira",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Unsync Error",
        description: "Failed to unsync task from Jira",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleSyncStatus = async (enabled: boolean) => {
    if (!task.id) return;

    try {
      const response = await fetch(`/api/jira-service/projects/${projectId}/tasks/${task.id}/sync-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ jira_sync_enabled: enabled })
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Sync Status Updated",
          description: `Sync ${enabled ? 'enabled' : 'disabled'} for this task`
        });
        onSyncStatusChange?.(task.jira_synced || false, task.jira_issue_key || undefined);
      } else {
        toast({
          title: "Update Failed",
          description: result.error || "Failed to update sync status",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Update Error",
        description: "Failed to update sync status",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading Jira sync options...
      </div>
    );
  }

  // No integration configured
  if (!integration || !integration.sync_enabled) {
    if (mode === 'create') {
      return (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Jira integration is not configured for this project. 
            Tasks will be created locally only.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  }

  // Create mode - show option to sync when creating
  if (mode === 'create') {
    return (
      <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
        <div className="flex items-center justify-between">
          <Label htmlFor="jira-sync-toggle" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            Sync with Jira
          </Label>
          <Switch
            id="jira-sync-toggle"
            checked={wantSync}
            onCheckedChange={setWantSync}
            data-testid="switch-create-sync"
          />
        </div>
        
        {wantSync && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              This task will be created in Jira project <strong>{integration.jira_project_key}</strong> 
              when you save it.
            </AlertDescription>
          </Alert>
        )}
        
        <p className="text-xs text-muted-foreground">
          {wantSync 
            ? "The task will be automatically synced to your Jira instance."
            : "The task will only be created locally. You can sync it later if needed."
          }
        </p>
      </div>
    );
  }

  // View/Edit mode - show current sync status and controls
  return (
    <div className="space-y-3" data-testid="jira-sync-controls">
      {/* Sync Status Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4" />
          <Label>Jira Sync</Label>
        </div>
        
        {task.jira_synced && task.jira_issue_key ? (
          <div className="flex items-center gap-2">
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Synced
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`${integration.jira_base_url}/browse/${task.jira_issue_key}`, '_blank')}
              data-testid="button-open-jira-issue"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              {task.jira_issue_key}
            </Button>
          </div>
        ) : (
          <Badge variant="outline" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Not Synced
          </Badge>
        )}
      </div>

      {/* Sync Controls */}
      <div className="flex items-center justify-between gap-2">
        {task.jira_synced && task.jira_issue_key ? (
          <>
            <div className="flex items-center gap-2">
              <Switch
                checked={task.jira_sync_enabled || false}
                onCheckedChange={toggleSyncStatus}
                disabled={isSyncing}
                data-testid="switch-sync-enabled"
              />
              <Label className="text-sm">
                {task.jira_sync_enabled ? 'Auto-sync enabled' : 'Auto-sync disabled'}
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={unsyncFromJira}
              disabled={isSyncing}
              data-testid="button-unsync"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Unsyncing...
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Unsync
                </>
              )}
            </Button>
          </>
        ) : (
          <Button
            onClick={syncToJira}
            disabled={isSyncing}
            size="sm"
            data-testid="button-sync-to-jira"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Link className="h-3 w-3 mr-1" />
                Sync to Jira
              </>
            )}
          </Button>
        )}
      </div>

      {/* Last Sync Info */}
      {task.jira_last_sync && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last synced: {new Date(task.jira_last_sync).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// Status indicator component for task cards
interface JiraSyncStatusProps {
  task: Task;
  integration?: JiraIntegration | null;
  size?: 'sm' | 'md';
}

export function JiraSyncStatus({ task, integration, size = 'sm' }: JiraSyncStatusProps) {
  if (!integration?.sync_enabled || !task.jira_synced || !task.jira_issue_key) {
    return null;
  }

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div 
      className="flex items-center gap-1 cursor-pointer" 
      onClick={() => window.open(`${integration.jira_base_url}/browse/${task.jira_issue_key}`, '_blank')}
      title={`Synced with Jira: ${task.jira_issue_key}`}
      data-testid="jira-sync-status"
    >
      <Link className={`${iconSize} text-blue-500`} />
      <span className="text-xs text-blue-600 font-medium">
        {task.jira_issue_key}
      </span>
    </div>
  );
}