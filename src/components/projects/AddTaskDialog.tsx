import React, { useState } from 'react';
import { useTaskContext, Priority } from '@/context/TaskContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import RecurrenceSettingsForm from '@/components/tasks/RecurrenceSettingsForm';
import { RecurrencePattern } from '@/context/TaskTypes';

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  parentTaskId?: string;
}

const AddTaskDialog: React.FC<AddTaskDialogProps> = ({ 
  open, 
  onOpenChange, 
  projectId,
  parentTaskId
}) => {
  const { addTask } = useTaskContext();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<Priority>('medium');
  const [notes, setNotes] = useState('');
  const [estimatedTime, setEstimatedTime] = useState<number | undefined>(undefined);
  
  // Recurrence states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>({
    frequency: 'daily',
    interval: 1
  });

  const handleAddTask = () => {
    if (title.trim()) {
      addTask({
        title,
        description,
        dueDate,
        priority,
        projectId,
        parentId: parentTaskId,
        notes,
        estimatedTime,
        isRecurring,
        recurrencePattern: isRecurring ? recurrencePattern : undefined
      });
      
      // Clear form
      setTitle('');
      setDescription('');
      setDueDate(undefined);
      setPriority('medium');
      setNotes('');
      setEstimatedTime(undefined);
      setIsRecurring(false);
      setRecurrencePattern({
        frequency: 'daily',
        interval: 1
      });
      
      // Close dialog
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parentTaskId ? 'Add Subtask' : 'Add Task'}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input 
              id="task-title" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="task-description">Description (optional)</Label>
            <Textarea 
              id="task-description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description"
            />
          </div>
          
          <div className="grid gap-2">
            <Label>Due Date (optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="grid gap-2">
            <Label>Priority</Label>
            <RadioGroup value={priority} onValueChange={(val) => setPriority(val as Priority)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="low" />
                <Label htmlFor="low" className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-task-low mr-2"></div>
                  Low
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="medium" />
                <Label htmlFor="medium" className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-task-medium mr-2"></div>
                  Medium
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="high" />
                <Label htmlFor="high" className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-task-high mr-2"></div>
                  High
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="task-estimatedTime">Estimated Time (minutes, optional)</Label>
            <Input 
              id="task-estimatedTime" 
              type="number"
              min="0"
              value={estimatedTime === undefined ? '' : estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="Estimated time in minutes"
            />
          </div>
          
          {/* Only show recurrence for tasks without a parent */}
          {!parentTaskId && (
            <RecurrenceSettingsForm
              enabled={isRecurring}
              onEnabledChange={setIsRecurring}
              pattern={recurrencePattern}
              onPatternChange={setRecurrencePattern}
            />
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="task-notes">Notes (optional)</Label>
            <Textarea 
              id="task-notes" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter task notes"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddTask}>
            Add {parentTaskId ? 'Subtask' : 'Task'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddTaskDialog;