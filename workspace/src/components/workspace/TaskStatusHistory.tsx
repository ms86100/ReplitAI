import React, { useState, useEffect } from 'react';
import { Clock, User, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface TaskStatusHistoryProps {
  taskId: string;
  taskTitle: string;
}

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  changed_at: string;
  notes?: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
}

export function TaskStatusHistory({ taskId, taskTitle }: TaskStatusHistoryProps) {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [users, setUsers] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatusHistory();
  }, [taskId]);

  const fetchStatusHistory = async () => {
    try {
      setLoading(true);
      
      // Fetch task status history
      const historyResponse = await apiClient.getTaskStatusHistory(taskId);
      if (historyResponse.success && historyResponse.data) {
        const historyData = Array.isArray(historyResponse.data) ? historyResponse.data : historyResponse.data.history || [];
        setHistory(historyData);

        // Fetch user profiles for the changed_by field
        if (historyData.length > 0) {
          const userIds = [...new Set(historyData.map((h: any) => h.changed_by).filter(Boolean))];
          
          if (userIds.length > 0) {
            const profilesResponse = await apiClient.getUserProfiles(userIds);
            if (profilesResponse.success && profilesResponse.data?.profiles) {
              const userMap = new Map<string, UserProfile>();
              profilesResponse.data.profiles.forEach((profile: any) => {
                userMap.set(profile.id, profile);
              });
              setUsers(userMap);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching status history:', error);
      toast({
        title: "Error loading status history",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (status: string | null) => {
    if (!status) return 'Created';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status) {
      case 'todo': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserName = (userId: string) => {
    const user = users.get(userId);
    return user?.full_name || user?.email || 'Unknown User';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Status History
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Track changes for "{taskTitle}"
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No status changes recorded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {entry.old_status && (
                        <>
                          <Badge className={getStatusColor(entry.old_status)}>
                            {formatStatus(entry.old_status)}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </>
                      )}
                      <Badge className={getStatusColor(entry.new_status)}>
                        {formatStatus(entry.new_status)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{getUserName(entry.changed_by)}</span>
                      <span>•</span>
                      <span>{format(new Date(entry.changed_at), 'MMM dd, yyyy at h:mm a')}</span>
                    </div>
                    
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        "{entry.notes}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}