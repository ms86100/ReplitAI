import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';

interface Week {
  id: string;
  week_start: string;
  week_end: string;
  week_index: number;
}

interface DailyAttendance {
  date: string;
  day_of_week: string;
  status: 'P' | 'A';
}

interface DailyAttendanceModalProps {
  memberId: string;
  memberName: string;
  weekId: string;
  week?: Week;
  availabilityId?: string;
  currentPercent: number;
  onClose: () => void;
  onUpdate: (memberId: string, weekId: string, percent: number, daysPresent: number) => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DailyAttendanceModal: React.FC<DailyAttendanceModalProps> = ({
  memberId,
  memberName,
  weekId,
  week,
  availabilityId,
  currentPercent,
  onClose,
  onUpdate,
}) => {
  const [attendance, setAttendance] = useState<Record<string, 'P' | 'A'>>({});
  const [overridePercent, setOverridePercent] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (week) {
      generateWeekDays();
      // Always try to fetch existing attendance using memberId and weekId
      fetchExistingAttendance();
    }
  }, [week, memberId, weekId]);

  const generateWeekDays = () => {
    if (!week) return;

    const startDate = new Date(week.week_start);
    const endDate = new Date(week.week_end);
    const defaultAttendance: Record<string, 'P' | 'A'> = {};

    // Generate all days in the week
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = DAYS_OF_WEEK[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]; // Adjust Sunday to be last
      
      // Default to Present for weekdays, Absent for weekends
      defaultAttendance[dateStr] = currentDate.getDay() === 0 || currentDate.getDay() === 6 ? 'A' : 'P';
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    setAttendance(defaultAttendance);
  };

  const fetchExistingAttendance = async () => {
    try {
      // Use combined key as availability ID
      const availabilityId = `${memberId}-${weekId}`;
      const response = await apiClient.getDailyAttendance(availabilityId);
      if (response.success) {
        const existingAttendance: Record<string, 'P' | 'A'> = {};
        (response.data || []).forEach((day: DailyAttendance) => {
          existingAttendance[day.date] = day.status;
        });
        setAttendance(prev => ({ ...prev, ...existingAttendance }));
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const toggleAttendance = (date: string) => {
    setAttendance(prev => ({
      ...prev,
      [date]: prev[date] === 'P' ? 'A' : 'P'
    }));
  };

  const calculatePercentFromAttendance = () => {
    // Only count working days (exclude weekends)
    const workingDayEntries = Object.entries(attendance).filter(([date, _]) => {
      const dayOfWeek = new Date(date).getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclude Sunday (0) and Saturday (6)
    });
    
    const totalWorkingDays = workingDayEntries.length;
    const presentWorkingDays = workingDayEntries.filter(([_, status]) => status === 'P').length;
    
    return totalWorkingDays > 0 ? Math.round((presentWorkingDays / totalWorkingDays) * 100) : 100;
  };

  const getDaysData = () => {
    if (!week) return [];

    const startDate = new Date(week.week_start);
    const endDate = new Date(week.week_end);
    const days = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = DAYS_OF_WEEK[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1];
      
      // Only include working days (Monday to Friday)
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        days.push({
          date: dateStr,
          dayOfWeek,
          displayDate: currentDate.toLocaleDateString(),
          status: attendance[dateStr] || 'P'
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const dailyAttendanceData = Object.entries(attendance).map(([date, status]) => {
        const dayOfWeek = DAYS_OF_WEEK[new Date(date).getDay() === 0 ? 6 : new Date(date).getDay() - 1];
        return { date, day_of_week: dayOfWeek, status };
      });

      const finalPercent = overridePercent !== null ? overridePercent : calculatePercentFromAttendance();
      const daysPresent = Object.values(attendance).filter(status => status === 'P').length;

      // Save daily attendance
      await apiClient.saveDailyAttendance(memberId, weekId, dailyAttendanceData);

      onUpdate(memberId, weekId, finalPercent, daysPresent);
      toast({ title: 'Success', description: 'Daily attendance saved successfully.' });
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to save daily attendance. Try again.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const daysData = getDaysData();
  const calculatedPercent = calculatePercentFromAttendance();
  const finalPercent = overridePercent !== null ? overridePercent : calculatedPercent;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Daily Attendance - {memberName}</DialogTitle>
          {week && (
            <p className="text-sm text-muted-foreground">
              Week {week.week_index}: {new Date(week.week_start).toLocaleDateString()} - {new Date(week.week_end).toLocaleDateString()}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Click days to toggle Present (P) / Absent (A)</span>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {daysData.map((day) => (
                <div
                  key={day.date}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    day.status === 'P' 
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                  }`}
                  onClick={() => toggleAttendance(day.date)}
                >
                  <div>
                    <div className="font-medium">{day.dayOfWeek}</div>
                    <div className="text-sm text-muted-foreground">{day.displayDate}</div>
                  </div>
                  <Badge 
                    variant={day.status === 'P' ? 'default' : 'destructive'}
                    className="font-mono"
                  >
                    {day.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Calculated Availability</div>
              <div className="text-2xl font-bold">{calculatedPercent}%</div>
              <div className="text-sm text-muted-foreground">
                {Object.entries(attendance).filter(([date, status]) => {
                  const dayOfWeek = new Date(date).getDay();
                  return status === 'P' && dayOfWeek !== 0 && dayOfWeek !== 6; // Only count present working days
                }).length} of {Object.entries(attendance).filter(([date, _]) => {
                  const dayOfWeek = new Date(date).getDay();
                  return dayOfWeek !== 0 && dayOfWeek !== 6; // Only count working days
                }).length} working days present
              </div>
            </div>

            <div>
              <Label htmlFor="override-percent">Override Percentage (Optional)</Label>
              <Input
                id="override-percent"
                type="number"
                min="0"
                max="100"
                value={overridePercent || ''}
                onChange={(e) => setOverridePercent(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Leave empty to use calculated %"
              />
            </div>

            {overridePercent !== null && overridePercent !== calculatedPercent && (
              <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                  Using override: {overridePercent}% (calculated: {calculatedPercent}%)
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};