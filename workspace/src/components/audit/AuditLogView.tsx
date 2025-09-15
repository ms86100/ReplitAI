import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, User, FileText, Filter, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiClient } from '@/services/api';

interface AuditEntry {
  id: string;
  user_id: string;
  module: string;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string;
  created_at: string;
  user_email?: string;
}

interface AuditLogViewProps {
  projectId: string;
}

const MODULES = [
  { value: 'overview', label: 'Overview' },
  { value: 'tasks_milestones', label: 'Tasks & Milestones' },
  { value: 'roadmap', label: 'Roadmap' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'stakeholders', label: 'Stakeholders' },
  { value: 'risk_register', label: 'Risk Register' },
  { value: 'discussions', label: 'Discussions' },
  { value: 'task_backlog', label: 'Task Backlog' },
  { value: 'team_capacity', label: 'Team Capacity' },
  { value: 'retrospectives', label: 'Retrospectives' },
];

const ACTION_COLORS = {
  created: 'default',
  updated: 'secondary',
  deleted: 'destructive',
} as const;

export function AuditLogView({ projectId }: AuditLogViewProps) {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<AuditEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLog();
  }, [projectId]);

  useEffect(() => {
    filterEntries();
  }, [auditEntries, searchQuery, selectedModule, selectedAction]);

  const fetchAuditLog = async () => {
    setLoading(true);
    
    try {
      const response = await apiClient.getAuditLog(projectId);
      
      if (!response.success) {
        console.error('Error fetching audit log:', response.error);
        setLoading(false);
        return;
      }

      setAuditEntries(response.data || []);
    } catch (error) {
      console.error('Error fetching audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterEntries = () => {
    let filtered = auditEntries;

    if (searchQuery) {
      filtered = filtered.filter(entry =>
        entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.entity_type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedModule !== 'all') {
      filtered = filtered.filter(entry => entry.module === selectedModule);
    }

    if (selectedAction !== 'all') {
      filtered = filtered.filter(entry => entry.action === selectedAction);
    }

    setFilteredEntries(filtered);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return '✨';
      case 'updated':
        return '✏️';
      case 'deleted':
        return '🗑️';
      default:
        return '📝';
    }
  };

  const getModuleLabel = (module: string) => {
    return MODULES.find(m => m.value === module)?.label || module;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activity History
        </CardTitle>
        <CardDescription>
          Track all changes made within this project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {MODULES.map(module => (
                <SelectItem key={module.value} value={module.value}>
                  {module.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedAction} onValueChange={setSelectedAction}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Audit Entries */}
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading activity history...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {auditEntries.length === 0 ? 'No activity recorded yet.' : 'No activities match your filters.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="text-lg mt-1">
                    {getActionIcon(entry.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{entry.user_email}</span>
                      <Badge variant={ACTION_COLORS[entry.action as keyof typeof ACTION_COLORS] || 'default'} className="text-xs">
                        {entry.action}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getModuleLabel(entry.module)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {entry.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </span>
                    </div>
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