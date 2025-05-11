import React, { useState } from 'react';
import { useTaskContext, Priority } from '@/context/TaskContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Repeat } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import RecurrenceSettingsForm from './RecurrenceSettingsForm';
import { RecurrencePattern } from '@/context/TaskTypes';
import { Separator } from '../ui/separator';

interface AddTaskFormDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerElement?: React.ReactNode;
}

const AddTaskFormDialog: React.FC<AddTaskFormDialogProps> = ({ 
  open, 
  onOpenChange,
  triggerElement 
}) => {
  const { projects, addTask } = useTaskContext();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [projectId, setProjectId] = useState<string>('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | ''>('');
  
  // Recurrence states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>({
    frequency: 'daily',
    interval: 1
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setProjectId('');
    setDueDate(undefined);
    setNotes('');
    setEstimatedHours('');
    setEstimatedMinutes('');
    setIsRecurring(false);
    setRecurrencePattern({
      frequency: 'daily',
      interval: 1
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !projectId) return;
    
    // Convert hours and minutes to total minutes
    const totalMinutes = 
      (typeof estimatedHours === 'number' ? estimatedHours * 60 : 0) + 
      (typeof estimatedMinutes === 'number' ? estimatedMinutes : 0);
    
    addTask({
      title,
      description,
      priority,
      projectId,
      dueDate,
      notes,
      estimatedTime: totalMinutes > 0 ? totalMinutes : undefined,
      isRecurring: isRecurring,
      recurrencePattern: isRecurring ? recurrencePattern : undefined
    });
    
    resetForm();
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  const handleProjectChange = (value: string) => {
    setProjectId(value);
  };

  const dialogContent = (
    <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add New Task</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="project">Project</Label>
          <Select 
            value={projectId} 
            onValueChange={handleProjectChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="title">Task Title</Label>
          <Input 
            id="title" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea 
            id="description" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter task description"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select 
            value={priority} 
            onValueChange={(value: Priority) => setPriority(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Due Date (Optional)</Label>
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
                {dueDate ? format(dueDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={(date) => setDueDate(date)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="space-y-2">
          <Label>Estimated Time (Optional)</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label htmlFor="hours" className="text-xs">Hours</Label>
              <Input 
                id="hours" 
                type="number"
                min="0"
                step="1"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value ? parseInt(e.target.value, 10) : '')}
                placeholder="0"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="minutes" className="text-xs">Minutes</Label>
              <Input 
                id="minutes" 
                type="number"
                min="0"
                max="59"
                step="1"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value ? parseInt(e.target.value, 10) : '')}
                placeholder="0"
              />
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        
        <Separator />
        
        <RecurrenceSettingsForm
          enabled={isRecurring}
          onEnabledChange={setIsRecurring}
          pattern={recurrencePattern}
          onPatternChange={setRecurrencePattern}
        />
        
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea 
            id="notes" 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes"
          />
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <DialogClose asChild>
            <Button variant="outline" type="button">Cancel</Button>
          </DialogClose>
          <Button type="submit">Create Task</Button>
        </div>
      </form>
    </DialogContent>
  );

  if (triggerElement) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          {triggerElement}
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialogContent}
    </Dialog>
  );
};

export default AddTaskFormDialog;