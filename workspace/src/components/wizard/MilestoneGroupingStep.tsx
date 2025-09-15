import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SimpleSelect, SimpleSelectItem } from '@/components/ui/simple-select';
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Calendar, AlertTriangle, X, Edit2 } from 'lucide-react';
import { ProjectData, Task, Milestone } from '../ProjectWizard';

interface MilestoneGroupingStepProps {
  projectData: ProjectData;
  setProjectData: (data: ProjectData) => void;
}

const MilestoneGroupingStep: React.FC<MilestoneGroupingStepProps> = ({ projectData, setProjectData }) => {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState<Date | undefined>(
    projectData.endDate ? new Date(projectData.endDate) : undefined
  );

  // Initialize with default milestone if none exist
  useEffect(() => {
    if (projectData.milestones.length === 0 && projectData.tasks.length > 0) {
      const defaultMilestone: Milestone = {
        id: crypto.randomUUID(),
        name: 'Milestone 1',
        dueDate: projectData.endDate,
        tasks: [...projectData.tasks]
      };
      
      setProjectData({
        ...projectData,
        milestones: [defaultMilestone]
      });
    }
  }, [projectData.tasks.length]);

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    const updatedMilestones = projectData.milestones.map(milestone => ({
      ...milestone,
      tasks: milestone.tasks.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      )
    }));

    setProjectData({
      ...projectData,
      milestones: updatedMilestones
    });
  };

  const deleteTask = (taskId: string) => {
    const updatedMilestones = projectData.milestones.map(milestone => ({
      ...milestone,
      tasks: milestone.tasks.filter(task => task.id !== taskId)
    }));

    setProjectData({
      ...projectData,
      milestones: updatedMilestones
    });
  };

  const addMilestone = () => {
    if (!newMilestoneName.trim()) return;

    const newMilestone: Milestone = {
      id: crypto.randomUUID(),
      name: newMilestoneName.trim(),
      dueDate: newMilestoneDueDate?.toISOString().split('T')[0] || projectData.endDate,
      tasks: []
    };

    setProjectData({
      ...projectData,
      milestones: [...projectData.milestones, newMilestone]
    });

    setNewMilestoneName('');
    setNewMilestoneDueDate(projectData.endDate ? new Date(projectData.endDate) : undefined);
  };

  const updateMilestone = (milestoneId: string, updates: Partial<Milestone>) => {
    setProjectData({
      ...projectData,
      milestones: projectData.milestones.map(milestone => 
        milestone.id === milestoneId ? { ...milestone, ...updates } : milestone
      )
    });
  };

  const moveTaskToMilestone = (taskId: string, targetMilestoneId: string) => {
    const updatedMilestones = projectData.milestones.map(milestone => ({
      ...milestone,
      tasks: milestone.tasks.filter(task => task.id !== taskId)
    }));

    const taskToMove = projectData.milestones
      .flatMap(m => m.tasks)
      .find(task => task.id === taskId);

    if (taskToMove) {
      const targetMilestone = updatedMilestones.find(m => m.id === targetMilestoneId);
      if (targetMilestone) {
        targetMilestone.tasks.push(taskToMove);
      }
    }

    setProjectData({
      ...projectData,
      milestones: updatedMilestones
    });
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, milestoneId: string) => {
    e.preventDefault();
    if (draggedTask) {
      moveTaskToMilestone(draggedTask.id, milestoneId);
      setDraggedTask(null);
    }
  };

  const isValidToSubmit = () => {
    return projectData.milestones.length > 0 && 
           projectData.milestones.every(m => m.tasks.length > 0);
  };

  const suggestMilestones = () => {
    if (projectData.tasks.length <= 10) return;
    
    // Auto-suggest 2-3 milestones based on task count
    const chunkSize = Math.ceil(projectData.tasks.length / 3);
    const chunks = [];
    
    for (let i = 0; i < projectData.tasks.length; i += chunkSize) {
      chunks.push(projectData.tasks.slice(i, i + chunkSize));
    }

    const suggestedMilestones: Milestone[] = chunks.map((tasks, index) => ({
      id: crypto.randomUUID(),
      name: `Phase ${index + 1}`,
      dueDate: projectData.endDate,
      tasks
    }));

    setProjectData({
      ...projectData,
      milestones: suggestedMilestones
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-muted-foreground">
          Now, let's organize your tasks into milestones. How would you like to group them?
        </p>
        {projectData.tasks.length > 10 && (
          <Button
            variant="outline"
            onClick={suggestMilestones}
            className="mt-2"
          >
            Auto-suggest 3 milestones
          </Button>
        )}
      </div>

      {/* Add New Milestone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Milestone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <Label htmlFor="milestoneName" className="text-sm font-medium">Milestone Name</Label>
              <Input
                id="milestoneName"
                value={newMilestoneName}
                onChange={(e) => setNewMilestoneName(e.target.value)}
                placeholder="Enter milestone name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="milestoneDueDate" className="text-sm font-medium">Due Date</Label>
              <div className="mt-1">
                <DatePicker
                  date={newMilestoneDueDate}
                  onDateChange={setNewMilestoneDueDate}
                  placeholder="Select due date"
                  minDate={projectData.startDate ? new Date(projectData.startDate) : undefined}
                  maxDate={projectData.endDate ? new Date(projectData.endDate) : undefined}
                  className="w-full"
                />
              </div>
            </div>
            <div>
            <Button 
              onClick={addMilestone} 
              disabled={!newMilestoneName.trim()} 
              className="w-full bg-brand-primary hover:bg-brand-primary/90 text-brand-on-primary"
            >
              Add Milestone
            </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestone Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {projectData.milestones.map((milestone, index) => (
          <Card 
            key={milestone.id}
            className={`${projectData.milestones.length > 1 && index > 0 ? 'min-h-[600px]' : 'h-fit'}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, milestone.id)}
          >
            <CardHeader className="pb-3">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Milestone Name</label>
                  <Input
                    value={milestone.name}
                    onChange={(e) => updateMilestone(milestone.id, { name: e.target.value })}
                    onBlur={() => {
                      // Auto-save on blur - validation happens inline
                      if (!milestone.name.trim()) {
                        updateMilestone(milestone.id, { name: 'Unnamed Milestone' });
                      }
                    }}
                    className="font-semibold border border-border rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Enter milestone name"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Due Date</label>
                  <DatePicker
                    date={milestone.dueDate ? new Date(milestone.dueDate) : undefined}
                    onDateChange={(date) => 
                      updateMilestone(milestone.id, { 
                        dueDate: date?.toISOString().split('T')[0] || projectData.endDate 
                      })
                    }
                    placeholder="Select due date"
                    minDate={projectData.startDate ? new Date(projectData.startDate) : undefined}
                    maxDate={projectData.endDate ? new Date(projectData.endDate) : undefined}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                  <SimpleSelect
                    value={milestone.status || 'planning'}
                    onValueChange={(value) => updateMilestone(milestone.id, { status: value })}
                    placeholder="Select status"
                    className="w-full"
                  >
                    <SimpleSelectItem value="planning">Planning</SimpleSelectItem>
                    <SimpleSelectItem value="in_progress">In Progress</SimpleSelectItem>
                    <SimpleSelectItem value="on_hold">On Hold</SimpleSelectItem>
                    <SimpleSelectItem value="completed">Completed</SimpleSelectItem>
                    <SimpleSelectItem value="cancelled">Cancelled</SimpleSelectItem>
                  </SimpleSelect>
                </div>
                 <div className="flex items-center justify-between">
                   <Badge variant="outline" className="w-fit">
                     {milestone.tasks.length} task{milestone.tasks.length !== 1 ? 's' : ''}
                   </Badge>
                   <Button
                     size="sm"
                     variant="ghost"
                     onClick={() => {
                       setProjectData({
                         ...projectData,
                         milestones: projectData.milestones.filter(m => m.id !== milestone.id)
                       });
                     }}
                     className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                   >
                     <X className="h-3 w-3" />
                   </Button>
                 </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              {milestone.tasks.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground border-dashed border-2 rounded">
                  <p className="text-sm">Drop tasks here</p>
                </div>
              ) : (
                milestone.tasks.map((task) => (
                  <Card 
                    key={task.id}
                    className="p-3 mt-2 cursor-move hover:shadow-md transition-shadow group"
                    draggable
                    onDragStart={() => handleDragStart(task)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Input
                          value={task.title}
                          onChange={(e) => updateTask(task.id, { title: e.target.value })}
                          className="border-none p-0 h-auto focus-visible:ring-0 font-medium text-sm"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      
                       <div className="space-y-2">
                         <div className="flex items-center gap-2">
                           <DatePicker
                             date={task.dueDate ? new Date(task.dueDate) : undefined}
                             onDateChange={(date) => 
                               updateTask(task.id, { 
                                 dueDate: date?.toISOString().split('T')[0] || milestone.dueDate 
                               })
                             }
                             placeholder="Task due date"
                             minDate={projectData.startDate ? new Date(projectData.startDate) : undefined}
                             maxDate={milestone.dueDate ? new Date(milestone.dueDate) : undefined}
                             className="flex-1 text-xs"
                           />
                         </div>
                         <div className="flex items-center gap-2">
                           <SimpleSelect
                             value={task.status || 'todo'}
                             onValueChange={(value) => updateTask(task.id, { status: value })}
                             placeholder="Status"
                             className="flex-1"
                           >
                             <SimpleSelectItem value="todo">To Do</SimpleSelectItem>
                             <SimpleSelectItem value="in_progress">In Progress</SimpleSelectItem>
                             <SimpleSelectItem value="review">Review</SimpleSelectItem>
                             <SimpleSelectItem value="completed">Completed</SimpleSelectItem>
                             <SimpleSelectItem value="blocked">Blocked</SimpleSelectItem>
                           </SimpleSelect>
                           <SimpleSelect
                             value={task.priority || 'medium'}
                             onValueChange={(value) => updateTask(task.id, { priority: value })}
                             placeholder="Priority"
                             className="flex-1"
                           >
                             <SimpleSelectItem value="low">Low</SimpleSelectItem>
                             <SimpleSelectItem value="medium">Medium</SimpleSelectItem>
                             <SimpleSelectItem value="high">High</SimpleSelectItem>
                             <SimpleSelectItem value="urgent">Urgent</SimpleSelectItem>
                           </SimpleSelect>
                         </div>
                       </div>
                    </div>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Validation Message */}
      {!isValidToSubmit() && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-800">
                Each milestone must have at least 1 task to continue.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MilestoneGroupingStep;