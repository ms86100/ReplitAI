import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { format, addWeeks, differenceInWeeks, differenceInBusinessDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  description?: string;
  member_count?: number;
}

interface TeamCapacityTrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  teams: Team[];
  onTrackerCreated: (iteration: any) => void;
}

export const TeamCapacityTrackerDialog: React.FC<TeamCapacityTrackerDialogProps> = ({
  open,
  onOpenChange,
  projectId,
  teams,
  onTrackerCreated,
}) => {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    type: 'capacity_tracker' as const,
    team_id: '',
    working_days: 0,
  });

  const handleClose = () => {
    setForm({
      name: '',
      type: 'capacity_tracker',
      team_id: '',
      working_days: 0,
    });
    setStartDate(undefined);
    setEndDate(undefined);
    onOpenChange(false);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    if (date && endDate) {
      const workingDays = differenceInBusinessDays(endDate, date);
      setForm({ ...form, working_days: Math.max(1, workingDays) });
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    if (startDate && date) {
      const workingDays = differenceInBusinessDays(date, startDate);
      setForm({ ...form, working_days: Math.max(1, workingDays) });
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.team_id || !startDate || !endDate) {
      toast({ 
        title: 'Validation Error', 
        description: 'Please fill in all required fields', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      setLoading(true);
      
      const iterationData = {
        name: form.name,
        type: form.type,
        team_id: form.team_id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        weeks_count: Math.ceil(form.working_days / 5),
      };

      
      const response = await apiClient.createIteration(projectId, iterationData);
      
      if (response.success) {
        const createdIteration = {
          ...response.data,
          team_id: form.team_id, // Ensure team_id is included
          team_name: teams.find(t => t.id === form.team_id)?.name || 'Unknown Team'
        };
        
        
        
        // Call the tracker created callback BEFORE closing dialog
        onTrackerCreated(createdIteration);
        
        toast({ 
          title: 'Success', 
          description: 'Team capacity tracker created successfully!' 
        });
        
        // Close dialog after a short delay to ensure navigation happens
        setTimeout(() => {
          handleClose();
        }, 100);
      } else {
        throw new Error(response.error || 'Failed to create capacity tracker');
      }
    } catch (error) {
      console.error('Error creating capacity tracker:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to create capacity tracker. Please try again.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedTeam = teams.find(t => t.id === form.team_id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Create Team Capacity Tracker
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tracker-name">Tracker Name *</Label>
              <Input
                id="tracker-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Q1 Capacity Planning"
                required
              />
            </div>

            <div>
              <Label htmlFor="team-select">Select Team *</Label>
              <Select value={form.team_id} onValueChange={(value) => setForm({ ...form, team_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{team.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {team.member_count || 0} members
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedTeam && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Selected Team: {selectedTeam.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  {selectedTeam.description && <p>{selectedTeam.description}</p>}
                  <p>Team Members: {selectedTeam.member_count || 0}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : undefined;
                  handleStartDateChange(date);
                }}
                required
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date *</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : undefined;
                  handleEndDateChange(date);
                }}
                min={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                required
              />
            </div>
          </div>

          {startDate && endDate && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm">
                <p><strong>Duration:</strong> {form.working_days} working days ({Math.ceil(form.working_days / 5)} weeks)</p>
                <p className="text-muted-foreground mt-1">
                  Based on a 5-day working week (excludes weekends)
                </p>
              </div>
            </div>
          )}

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">What is a Team Capacity Tracker?</h4>
            <p className="text-sm text-muted-foreground">
              A capacity tracker helps you monitor and plan team availability over a specific period. 
              You can track daily attendance, manage leaves, and get insights into team utilization patterns.
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={loading || !form.name.trim() || !form.team_id || !startDate || !endDate}
            >
              {loading ? 'Creating...' : 'Create Capacity Tracker'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};