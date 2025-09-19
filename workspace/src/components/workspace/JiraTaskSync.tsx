import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Link,
  History
} from 'lucide-react';

interface JiraIntegration {
  id: string;
  project_id: string;
  jira_base_url: string;
  jira_email: string;
  jira_project_key: string;
  enabled: boolean;
  sync_enabled: boolean;
  auto_sync: boolean;
  last_sync: string | null;
  created_at: string;
}

interface JiraSyncHistory {
  id: string;
  jira_issue_key: string | null;
  sync_direction: string;
  operation: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface JiraTaskSyncProps {
  projectId: string;
}

// Helper to get auth token from localStorage
const getAuthToken = (): string | null => {
  try {
    const storedAuth = localStorage.getItem('auth_session') || localStorage.getItem('app_session');
    if (storedAuth) {
      const session = JSON.parse(storedAuth);
      return session?.access_token || session?.token || session?.accessToken || null;
    }
    return null;
  } catch {
    return null;
  }
};

export function JiraTaskSync({ projectId }: JiraTaskSyncProps) {
  const [integration, setIntegration] = useState<JiraIntegration | null>(null);
  const [syncHistory, setSyncHistory] = useState<JiraSyncHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUnsyncDialogOpen, setIsUnsyncDialogOpen] = useState(false);
  const [taskToUnsync, setTaskToUnsync] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    jira_base_url: '',
    jira_email: '',
    jira_api_token: '',
    jira_project_key: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchIntegration();
    fetchSyncHistory();
  }, [projectId]);

  const fetchIntegration = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      const response = await fetch(`/api/jira-service/projects/${projectId}/integration`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setIntegration(result.data);
        if (result.data) {
          setFormData({
            jira_base_url: result.data.jira_base_url || '',
            jira_email: result.data.jira_email || '',
            jira_api_token: '', // Never populate API token for security
            jira_project_key: result.data.jira_project_key || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching Jira integration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSyncHistory = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      
      const response = await fetch(`/api/jira-service/projects/${projectId}/sync-history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setSyncHistory(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching sync history:', error);
    }
  };

  const testConnection = async () => {
    if (!integration) {
      toast({
        title: "Configuration Required",
        description: "Please configure Jira integration first",
        variant: "destructive"
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const token = getAuthToken();
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to test the connection",
          variant: "destructive"
        });
        return;
      }
      
      const response = await fetch(`/api/jira-service/projects/${projectId}/test-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setConnectionStatus('success');
        toast({
          title: "Connection Successful",
          description: "Jira connection is working properly"
        });
      } else {
        setConnectionStatus('error');
        toast({
          title: "Connection Failed", 
          description: result.error || "Unable to connect to Jira",
          variant: "destructive"
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "Connection Error",
        description: "Failed to test Jira connection",
        variant: "destructive"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveConfiguration = async () => {
    if (!formData.jira_base_url || !formData.jira_email || !formData.jira_api_token || !formData.jira_project_key) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to save configuration",
          variant: "destructive"
        });
        return;
      }
      
      const response = await fetch(`/api/jira-service/projects/${projectId}/integration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Configuration Saved",
          description: "Jira integration has been configured successfully"
        });
        setIsConfigOpen(false);
        fetchIntegration();
      } else {
        toast({
          title: "Configuration Failed",
          description: result.error || "Failed to save configuration",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save Jira configuration",
        variant: "destructive"
      });
    }
  };

  const handleImportFromJira = async () => {
    if (!integration) {
      toast({
        title: "Configuration Required",
        description: "Please configure Jira integration first",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to sync",
          variant: "destructive"
        });
        return;
      }
      
      const response = await fetch(`/api/jira-service/projects/${projectId}/import-from-jira`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        const { imported, skipped, total } = result.data;
        toast({
          title: "Import Successful",
          description: `Imported ${imported} tasks from Jira (${skipped} already existed). Total: ${total} issues found.`
        });
        fetchSyncHistory();
        fetchIntegration();
      } else {
        toast({
          title: "Import Failed",
          description: result.error || "Failed to import from Jira",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Import Error",
        description: "Failed to import tasks from Jira",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportToJira = async () => {
    if (!integration) {
      toast({
        title: "Configuration Required",
        description: "Please configure Jira integration first",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to sync",
          variant: "destructive"
        });
        return;
      }
      
      const response = await fetch(`/api/jira-service/projects/${projectId}/export-to-jira`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        const { exported, total } = result.data;
        toast({
          title: "Export Successful",
          description: `Exported ${exported} tasks to Jira (${total} total tasks checked).`
        });
        fetchSyncHistory();
        fetchIntegration();
      } else {
        toast({
          title: "Export Failed",
          description: result.error || "Failed to export to Jira",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Export Error",
        description: "Failed to export tasks to Jira",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFullSync = async () => {
    if (!integration) {
      toast({
        title: "Configuration Required",
        description: "Please configure Jira integration first",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to sync",
          variant: "destructive"
        });
        return;
      }
      
      const response = await fetch(`/api/jira-service/projects/${projectId}/full-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        const { import: importData, export: exportData } = result.data;
        toast({
          title: "Full Sync Successful",
          description: `Imported ${importData.imported} tasks from Jira and exported ${exportData.exported} tasks to Jira.`
        });
        fetchSyncHistory();
        fetchIntegration();
      } else {
        toast({
          title: "Full Sync Failed",
          description: result.error || "Failed to perform full sync",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Sync Error",
        description: "Failed to perform full synchronization",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Jira Task Sync
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-jira-sync">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Jira Task Sync
          </div>
          <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-configure-jira">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Configure Jira Integration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You'll need to generate a Jira API token from your Atlassian account settings. 
                    Visit{' '}
                    <a 
                      href="https://id.atlassian.com/manage-profile/security/api-tokens" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Atlassian API Tokens
                    </a>
                    {' '}to create one.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="jira_base_url">Jira Base URL *</Label>
                    <Input
                      id="jira_base_url"
                      value={formData.jira_base_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, jira_base_url: e.target.value }))}
                      placeholder="https://yourcompany.atlassian.net"
                      data-testid="input-jira-url"
                    />
                  </div>
                  <div>
                    <Label htmlFor="jira_project_key">Project Key *</Label>
                    <Input
                      id="jira_project_key"
                      value={formData.jira_project_key}
                      onChange={(e) => setFormData(prev => ({ ...prev, jira_project_key: e.target.value }))}
                      placeholder="PROJ"
                      data-testid="input-project-key"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="jira_email">Email *</Label>
                  <Input
                    id="jira_email"
                    type="email"
                    value={formData.jira_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, jira_email: e.target.value }))}
                    placeholder="your-email@company.com"
                    data-testid="input-jira-email"
                  />
                </div>
                
                <div>
                  <Label htmlFor="jira_api_token">API Token *</Label>
                  <Input
                    id="jira_api_token"
                    type="password"
                    value={formData.jira_api_token}
                    onChange={(e) => setFormData(prev => ({ ...prev, jira_api_token: e.target.value }))}
                    placeholder="Your Jira API token"
                    data-testid="input-api-token"
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveConfiguration} data-testid="button-save-config">
                    Save Configuration
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!integration ? (
          <div className="text-center py-8">
            <Link className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Jira Integration</h3>
            <p className="text-muted-foreground mb-4">
              Configure Jira integration to enable bi-directional task synchronization
            </p>
            <Button onClick={() => setIsConfigOpen(true)} data-testid="button-setup-jira">
              Set up Jira Integration
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="history">Sync History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="status" className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {connectionStatus === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : connectionStatus === 'error' ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">{integration.jira_project_key}</p>
                      <p className="text-sm text-muted-foreground">
                        {integration.jira_base_url}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`${integration.jira_base_url}/browse/${integration.jira_project_key}`, '_blank')}
                    data-testid="button-open-jira"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Jira
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testConnection}
                  disabled={isTestingConnection}
                  data-testid="button-test-connection"
                >
                  {isTestingConnection ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Sync Enabled</Label>
                    <Switch
                      checked={integration.sync_enabled}
                      disabled // TODO: Implement toggle functionality
                      data-testid="switch-sync-enabled"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Allow tasks to be synchronized with Jira
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Auto Sync</Label>
                    <Switch
                      checked={integration.auto_sync}
                      disabled // TODO: Implement toggle functionality
                      data-testid="switch-auto-sync"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync changes to Jira
                  </p>
                </div>
              </div>

              {/* Sync Operations */}
              <div className="space-y-3">
                <Separator />
                <h3 className="font-medium text-sm">Sync Operations</h3>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleImportFromJira()}
                    disabled={isSyncing}
                    className="flex-1"
                    data-testid="button-import-from-jira"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Import from Jira
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportToJira()}
                    disabled={isSyncing}
                    className="flex-1"
                    data-testid="button-export-to-jira"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Export to Jira
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleFullSync()}
                    disabled={isSyncing}
                    className="flex-1"
                    data-testid="button-full-sync"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Full Sync
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Import from Jira:</strong> Brings your Jira issues (SAG-1, SAG-2, etc.) into this project's backlog<br />
                  <strong>Export to Jira:</strong> Sends project tasks to Jira as new issues<br />
                  <strong>Full Sync:</strong> Two-way synchronization between project and Jira
                </p>
              </div>

              {integration.last_sync && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Last sync: {new Date(integration.last_sync).toLocaleString()}
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="space-y-4">
              <div className="space-y-2">
                {syncHistory.length > 0 ? (
                  syncHistory.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {entry.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : entry.status === 'error' ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {entry.operation} {entry.jira_issue_key ? `(${entry.jira_issue_key})` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.created_at).toLocaleString()}
                          </p>
                          {entry.error_message && (
                            <p className="text-xs text-red-500 mt-1">{entry.error_message}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={entry.status === 'success' ? 'default' : 'destructive'}>
                        {entry.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No sync history available</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}